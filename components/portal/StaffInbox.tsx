import Link from "next/link";
import type { ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import { NewConversationPicker } from "@/components/portal/ChatRoom";
import { RealtimeRefresh } from "@/components/portal/RealtimeRefresh";
import { EmptyState, PageHeader } from "@/components/portal/ui";
import { loadConversations } from "@/lib/portal/chat";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/** Two-pane staff inbox; `children` is the open conversation (or nothing on the index page). */
export async function StaffInbox({ selectedId, children }: { selectedId?: string; children?: ReactNode }) {
  const [conversations, { data: clients }] = await Promise.all([
    loadConversations(),
    createClient().from("organizations").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <RealtimeRefresh channel="staff-chat-inbox" subscriptions={[{ table: "chat_messages" }]} />
      <PageHeader title="Messages" description="Live conversations with client teams. Clients reach you from Messages in their portal." />

      <div className="grid h-[calc(100vh-15rem)] min-h-[480px] border border-line bg-white lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={cn("flex min-h-0 flex-col lg:border-r lg:border-line", selectedId && "hidden lg:flex")}>
          <div className="border-b border-line p-3">
            <NewConversationPicker clients={clients ?? []} />
          </div>
          {conversations.length ? (
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {conversations.map((c) => {
                const active = c.organizationId === selectedId;
                const unread = active ? 0 : c.unread;
                return (
                  <li key={c.organizationId}>
                    <Link
                      href={portalHref(`/staff/messages/${c.organizationId}`)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block border-l-2 px-4 py-3 transition-colors",
                        active ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-paper-soft/70",
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                          {c.organizationName}
                        </span>
                        {unread ? (
                          <span className="min-w-[1.5rem] shrink-0 rounded-full bg-brand-100 px-1.5 text-center text-xs tabular-nums text-brand-700">
                            {unread}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn("mt-0.5 block truncate text-sm", unread ? "text-ink" : "text-ink-muted")}>
                        {c.lastAuthorKind === "staff" ? "Largis: " : ""}
                        {c.lastBody}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-subtle">{formatDateTime(c.lastAt)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="No conversations yet" className="flex-1">
              When a client sends a message it appears here. Use the menu above to message a client first.
            </EmptyState>
          )}
        </aside>

        <div className={cn("min-h-0 min-w-0", !selectedId && "hidden lg:block")}>
          {children ?? (
            <div className="grid h-full place-items-center">
              <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="Select a conversation">
                Pick a client on the left, or choose one from the menu to start a new conversation.
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
