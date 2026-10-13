import "server-only";
import { loadPeopleNames } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";
import type { TicketAuthorKind } from "@/lib/supabase/types";

export const CHAT_HISTORY_LIMIT = 200;
export const CHAT_MAX_LENGTH = 4000;

export type ChatMessageView = {
  id: string;
  authorId: string | null;
  authorKind: TicketAuthorKind;
  authorName: string;
  body: string;
  createdAt: string;
};

export function chatAuthorName(names: Map<string, string>, authorId: string | null, kind: TicketAuthorKind) {
  return (authorId && names.get(authorId)) || (kind === "staff" ? "Largis team" : "Former member");
}

/** The most recent messages in a client's conversation, oldest first. */
export async function loadChatThread(organizationId: string) {
  const { data, error } = await createClient()
    .from("chat_messages")
    .select("id, author_id, author_kind, body, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY_LIMIT);
  if (error) console.error("[chat] Could not load messages", error.message);

  const rows = (data ?? []).reverse();
  const names = await loadPeopleNames(rows.map((m) => m.author_id));
  const messages: ChatMessageView[] = rows.map((m) => ({
    id: m.id,
    authorId: m.author_id,
    authorKind: m.author_kind,
    authorName: chatAuthorName(names, m.author_id, m.author_kind),
    body: m.body,
    createdAt: m.created_at,
  }));
  return { messages, names: Object.fromEntries(names), truncated: rows.length === CHAT_HISTORY_LIMIT };
}

/** Unread messages from the other side, keyed by organization. */
export async function loadChatUnread() {
  const { data, error } = await createClient().rpc("chat_unread_counts");
  if (error) console.error("[chat] Unread counts unavailable", error.message);
  return new Map((data ?? []).map((r) => [r.organization_id, r.unread]));
}

export type ConversationSummary = {
  organizationId: string;
  organizationName: string;
  lastBody: string;
  lastAuthorKind: TicketAuthorKind;
  lastAt: string;
  unread: number;
};

/** Every conversation the caller can see, most recent first. */
export async function loadConversations(): Promise<ConversationSummary[]> {
  const [{ data, error }, unread] = await Promise.all([createClient().rpc("chat_conversations"), loadChatUnread()]);
  if (error) console.error("[chat] Conversations unavailable", error.message);
  return (data ?? [])
    .map((c) => ({
      organizationId: c.organization_id,
      organizationName: c.organization_name,
      lastBody: c.last_body,
      lastAuthorKind: c.last_author_kind,
      lastAt: c.last_at,
      unread: unread.get(c.organization_id) ?? 0,
    }))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
