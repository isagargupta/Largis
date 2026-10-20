import "server-only";
import { chatModel, isAssistantConfigured, openai, reasoningOptions } from "@/lib/assistant/openai";
import type { SuggestionKind } from "@/lib/supabase/types";

export { isAssistantConfigured };

const instructions: Record<SuggestionKind, string> = {
  summary: "Summarize what is known about this lead and what is still missing. Use two to four plain sentences.",
  reply:
    "Draft a short follow-up the business can send. Do not invent prices, appointment times, or promises. The draft will be reviewed by a person and is not sent automatically.",
  next_action: "Suggest one concrete next step in a single sentence under 160 characters. It will become a task title after a person approves it.",
};

export async function draftLeadSuggestion(
  kind: SuggestionKind,
  lead: {
    title: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    jobType: string | null;
    stage: string;
    source: string | null;
    notes: string | null;
    lostReason: string | null;
  },
) {
  const api = openai();
  if (!api) return { error: "The sales assistant isn't configured yet." as const };

  const model = chatModel();
  const facts = [
    `Lead: ${lead.title}`,
    `Contact: ${lead.contactName}`,
    lead.email ? `Email: ${lead.email}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.address ? `Service address: ${lead.address}` : null,
    lead.jobType ? `Job type: ${lead.jobType}` : null,
    `Stage: ${lead.stage}`,
    lead.source ? `Source: ${lead.source}` : null,
    lead.lostReason ? `Lost reason: ${lead.lostReason}` : null,
    lead.notes ? `Notes:\n${lead.notes.slice(0, 4000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await api.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You help a service business follow up on one lead. Use only the facts given. Return a JSON object with a single string field named body. " +
          instructions[kind],
      },
      { role: "user", content: facts },
    ],
    response_format: { type: "json_object" },
    ...reasoningOptions(model),
  });

  const text = response.choices[0]?.message?.content ?? "";
  const body = readBody(text, kind === "next_action" ? 200 : 4000);
  if (!body) return { error: "The assistant didn't return a usable draft." as const };
  return { body };
}

function readBody(text: string, max: number) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { body?: unknown };
    if (typeof parsed.body !== "string") return null;
    const body = parsed.body.trim();
    return body ? body.slice(0, max) : null;
  } catch {
    return null;
  }
}
