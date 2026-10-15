"use server";

import { attachmentSummary, parseAttachments } from "@/lib/attachments";
import { isEmailConfigured, hasVerifiedSender, sendEmail } from "@/lib/email";
import { chatMessageEmail } from "@/lib/emails/notifications";
import { friendlyDbError } from "@/lib/portal/action-state";
import type { ChatMessageView } from "@/lib/portal/chat";
import { displayName } from "@/lib/portal/format";
import { portalUrl } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { getOrgAccess, getProfiles, requestHost } from "@/lib/portal/session";
import { orgMemberIds, sendPushToUsers } from "@/lib/push";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { TicketAuthorKind } from "@/lib/supabase/types";
import { chatMessageSchema } from "@/lib/validations/portal";

export type ChatSendResult = { ok: true; message: ChatMessageView } | { ok: false; error: string };

/** Only the first message in a burst emails the other side. */
const QUIET_PERIOD_MS = 10 * 60 * 1000;
const MAX_CLIENT_RECIPIENTS = 25;

export async function sendChatMessage(
  organizationId: string,
  body: string,
  attachments: { path: string; name: string }[] = [],
): Promise<ChatSendResult> {
  const parsed = chatMessageSchema.safeParse({ organizationId, body, attachments });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That message can't be sent." };
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access) return { ok: false, error: "You don't have access to this conversation." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ organization_id: input.organizationId, body: input.body, attachments: input.attachments })
    .select("id, author_id, author_kind, body, attachments, created_at")
    .single();
  if (error || !data) return { ok: false, error: error ? friendlyDbError(error) : "The message could not be sent." };
  const files = parseAttachments(data.attachments);
  const preview = data.body || attachmentSummary(files);

  await supabase.rpc("chat_mark_read", { p_org: input.organizationId });

  const profile = (await getProfiles([access.user.id])).get(access.user.id);
  const senderName = displayName(profile, access.user.email ?? "A team member");

  try {
    await notifyOtherSide({
      organizationId: input.organizationId,
      messageId: data.id,
      authorKind: data.author_kind,
      createdAt: data.created_at,
      body: preview,
      senderName,
    });
  } catch (err) {
    console.error("[chat] Notification failed", err);
  }
  if (data.author_kind === "staff") {
    await sendPushToUsers(await orgMemberIds(input.organizationId), {
      title: `${senderName} · Largis`,
      body: preview,
      data: { screen: "messages", organizationId: input.organizationId },
    });
  }

  return {
    ok: true,
    message: {
      id: data.id,
      authorId: data.author_id,
      authorKind: data.author_kind,
      authorName: senderName,
      body: data.body,
      attachments: files,
      createdAt: data.created_at,
    },
  };
}

export async function markChatRead(organizationId: string) {
  if (!isUuid(organizationId)) return;
  const { error } = await createClient().rpc("chat_mark_read", { p_org: organizationId });
  if (error) console.error("[chat] Could not mark as read", error.message);
}

async function notifyOtherSide(m: {
  organizationId: string;
  messageId: string;
  authorKind: TicketAuthorKind;
  createdAt: string;
  body: string;
  senderName: string;
}) {
  if (!isEmailConfigured() || !hasVerifiedSender()) return;

  const supabase = createClient();
  const since = new Date(new Date(m.createdAt).getTime() - QUIET_PERIOD_MS).toISOString();
  const [{ count }, { data: org }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", m.organizationId)
      .eq("author_kind", m.authorKind)
      .gte("created_at", since)
      .neq("id", m.messageId),
    supabase.from("organizations").select("name").eq("id", m.organizationId).maybeSingle(),
  ]);
  if (count) return;

  const organizationName = org?.name ?? "your organisation";
  const host = requestHost();

  if (m.authorKind === "client") {
    await sendEmail({
      to: process.env.CONTACT_NOTIFY_EMAIL || siteConfig.email,
      ...chatMessageEmail({
        audience: "staff",
        organizationName,
        senderName: m.senderName,
        body: m.body,
        link: portalUrl("staff", `/staff/messages/${m.organizationId}`, host),
      }),
    });
    return;
  }

  const { data: members } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("organization_id", m.organizationId)
    .limit(MAX_CLIENT_RECIPIENTS);
  const profiles = await getProfiles((members ?? []).map((r) => r.user_id));
  const link = portalUrl("app", "/app/messages", host);

  await Promise.allSettled(
    Array.from(profiles.values())
      .filter((p) => p.email)
      .map((p) =>
        sendEmail({
          to: p.email!,
          replyTo: siteConfig.email,
          ...chatMessageEmail({
            audience: "client",
            organizationName,
            senderName: m.senderName,
            body: m.body,
            recipientName: p.full_name,
            link,
          }),
        }),
      ),
  );
}
