import type { Metadata } from "next";
import Link from "next/link";
import { ChatRoom } from "@/components/portal/ChatRoom";
import { PageHeader } from "@/components/portal/ui";
import { loadChatThread, loadChatUnread } from "@/lib/portal/chat";
import { portalHref } from "@/lib/portal/hosts";
import { getClientContext } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const [{ messages, names, truncated }, unread] = await Promise.all([loadChatThread(org.id), loadChatUnread()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description={
          <>
            Chat with the Largis team about {org.name}. For issues that need tracking and a response target, open a{" "}
            <Link href={portalHref("/app/support")} className="text-brand-700 underline underline-offset-4">
              support ticket
            </Link>
            .
          </>
        }
      />
      <ChatRoom
        organizationId={org.id}
        audience="client"
        viewerId={ctx.user.id}
        initialMessages={messages}
        names={names}
        hadUnread={(unread.get(org.id) ?? 0) > 0}
        truncated={truncated}
        counterpartLabel="the Largis team"
        emptyText="Send a message and the Largis team will reply here. You'll also get an email when they do."
        className="h-[calc(100vh-15rem)]"
      />
    </div>
  );
}
