import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffApi } from "@/lib/assistant/access";
import { buildMessages, findExcerpts, toSources, type HistoryMessage } from "@/lib/assistant/answer";
import { chatModel, openai, reasoningOptions } from "@/lib/assistant/openai";
import { displayName } from "@/lib/portal/format";
import { withinLimit } from "@/lib/portal/rate-limit";
import { getProfiles } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTION = 4000;
const HOURLY_LIMIT = { windowSeconds: 60 * 60, max: 120 };

const bodySchema = z.object({
  conversationId: z.string().uuid().nullish(),
  message: z.string().trim().min(1, "Type a question first.").max(MAX_QUESTION, `Keep questions under ${MAX_QUESTION} characters.`),
});

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

function titleFrom(question: string) {
  const line = question.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 77).trimEnd()}…` : line;
}

/**
 * Answers a staff question from the knowledge base. The response is newline-delimited JSON:
 * `meta` (conversation and sources), then `delta` text pieces, then `done` or `error`.
 */
export async function POST(request: Request) {
  const access = await requireStaffApi();
  if ("response" in access) return access.response;
  const { user } = access;

  const api = openai();
  if (!api) return fail(503, "Largis AI isn't switched on yet. An admin needs to add the OpenAI API key.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, parsed.error.issues[0]?.message ?? "That request wasn't valid.");
  const { message } = parsed.data;

  if (!(await withinLimit(createAdminClient(), "assistant", user.id, HOURLY_LIMIT))) {
    return fail(429, "You've asked a lot of questions in the last hour. Try again a little later.");
  }

  const supabase = createClient();
  let conversationId = parsed.data.conversationId ?? null;
  let history: HistoryMessage[] = [];

  if (conversationId) {
    const { data: convo } = await supabase.from("assistant_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!convo) return fail(404, "That conversation no longer exists.");
    const { data: previous } = await supabase
      .from("assistant_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);
    history = (previous ?? []).reverse();
  } else {
    const { data: convo, error } = await supabase
      .from("assistant_conversations")
      .insert({ title: titleFrom(message) })
      .select("id")
      .single();
    if (error || !convo) return fail(500, "The conversation couldn't be started. Try again.");
    conversationId = convo.id;
  }

  const { error: saveError } = await supabase
    .from("assistant_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });
  if (saveError) return fail(500, "Your question couldn't be saved. Try again.");

  const previousQuestion = [...history].reverse().find((m) => m.role === "user")?.content ?? null;
  let excerpts;
  try {
    excerpts = await findExcerpts(supabase, message, previousQuestion);
  } catch (err) {
    console.error("[assistant] Search failed", err instanceof Error ? err.message : err);
    return fail(502, "The knowledge base couldn't be searched just now. Try again in a moment.");
  }

  const sources = toSources(excerpts);
  const answered = excerpts.length > 0;
  const model = chatModel();
  const profile = (await getProfiles([user.id])).get(user.id);
  const messages = buildMessages({ question: message, history, excerpts, staffName: profile?.full_name ? displayName(profile) : null });
  const convoId = conversationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The browser went away; the answer is still saved below.
        }
      };
      send({ type: "meta", conversationId: convoId, sources, answered });

      let content = "";
      let usage: { prompt_tokens: number; completion_tokens: number } | null = null;
      let failed = false;
      try {
        const completion = await api.chat.completions.create(
          {
            model,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            max_completion_tokens: 4000,
            ...reasoningOptions(model),
          },
          { signal: request.signal },
        );
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            content += delta;
            send({ type: "delta", text: delta });
          }
          if (chunk.usage) usage = { prompt_tokens: chunk.usage.prompt_tokens, completion_tokens: chunk.usage.completion_tokens };
        }
      } catch (err) {
        if (!request.signal.aborted) {
          failed = true;
          console.error("[assistant] Answer failed", err instanceof Error ? err.message : err);
        }
      }

      if (content.trim()) {
        const { data: saved } = await supabase
          .from("assistant_messages")
          .insert({
            conversation_id: convoId,
            role: "assistant",
            content: content.slice(0, 20000),
            sources,
            answered,
            model,
            prompt_tokens: usage?.prompt_tokens ?? null,
            completion_tokens: usage?.completion_tokens ?? null,
          })
          .select("id")
          .single();
        await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
        send({ type: "done", messageId: saved?.id ?? null });
      } else if (!request.signal.aborted) {
        send({ type: "error", error: failed ? "Largis AI couldn't answer just now. Try again in a moment." : "No answer came back. Try rephrasing." });
      }
      try {
        controller.close();
      } catch {
        // Already closed by a disconnect.
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
