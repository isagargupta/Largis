import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ChatRoom } from "@/components/portal/ChatRoom";
import { StaffInbox } from "@/components/portal/StaffInbox";
import { loadChatThread, loadChatUnread } from "@/lib/portal/chat";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { getUser } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

export default async function StaffConversationPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();

  const [{ data: org }, user, thread, unread] = await Promise.all([
    createClient().from("organizations").select("id, name").eq("id", params.id).maybeSingle(),
    getUser(),
    loadChatThread(params.id),
    loadChatUnread(),
  ]);
  if (!org || !user) notFound();

  return (
    <StaffInbox selectedId={org.id}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={portalHref("/staff/messages")}
              aria-label="All conversations"
              className="-ml-1 grid h-8 w-8 shrink-0 place-items-center text-ink-muted hover:text-ink lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h2 className="truncate text-[15px] font-semibold">{org.name}</h2>
          </div>
          <Link
            href={portalHref(`/staff/clients/${org.id}`)}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-brand-700 hover:underline"
          >
            Client profile
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ChatRoom
          organizationId={org.id}
          audience="staff"
          viewerId={user.id}
          initialMessages={thread.messages}
          names={thread.names}
          hadUnread={(unread.get(org.id) ?? 0) > 0}
          truncated={thread.truncated}
          counterpartLabel={org.name}
          emptyText={`Start the conversation with ${org.name}. Their team gets an email and sees it under Messages in the client portal.`}
          className="min-h-0 flex-1 border-0"
        />
      </div>
    </StaffInbox>
  );
}
