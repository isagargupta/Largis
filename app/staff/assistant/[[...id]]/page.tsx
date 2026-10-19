import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssistantChat, type ChatMessage } from "@/components/portal/AssistantChat";
import { isAssistantConfigured } from "@/lib/assistant/openai";
import { parseSources } from "@/lib/knowledge";
import { isUuid } from "@/lib/portal/params";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Largis AI" };

export default async function AssistantPage({ params }: { params: { id?: string[] } }) {
  const { user, staff } = await requireStaff();
  const [id, ...rest] = params.id ?? [];
  if (rest.length || (id && !isUuid(id))) notFound();

  const supabase = createClient();
  const [{ data: conversations }, { count: readyCount }, messages] = await Promise.all([
    supabase.from("assistant_conversations").select("id, title, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50),
    supabase.from("kb_documents").select("id", { count: "exact", head: true }).eq("status", "ready"),
    id
      ? supabase
          .from("assistant_messages")
          .select("id, role, content, sources, answered, feedback, created_at")
          .eq("conversation_id", id)
          .order("created_at", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);
  if (id && !(conversations ?? []).some((c) => c.id === id)) {
    const { data: exists } = await supabase.from("assistant_conversations").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (!exists) notFound();
  }

  const initial: ChatMessage[] = (messages.data ?? []).map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
    sources: parseSources(m.sources),
    answered: m.answered ?? true,
    feedback: m.feedback === 1 || m.feedback === -1 ? m.feedback : null,
  }));

  return (
    <AssistantChat
      key={id ?? "new"}
      conversationId={id ?? null}
      initialMessages={initial}
      conversations={conversations ?? []}
      configured={isAssistantConfigured()}
      readyCount={readyCount ?? 0}
      canManage={staff.role === "admin" || staff.role === "manager"}
    />
  );
}
