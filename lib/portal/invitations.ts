import "server-only";
import { headers } from "next/headers";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/emails/invite";
import { friendlyDbError } from "@/lib/portal/action-state";
import { portalOrigin } from "@/lib/portal/hosts";
import { rolePermissions, staffRoleLabel } from "@/lib/portal/meta";
import { siteConfig } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import type { OrgRole, StaffRole } from "@/lib/supabase/types";

type Client = ReturnType<typeof createClient>;

type InviteInput = { email: string; fullName: string | null; inviterName: string | null } & (
  | { kind: "client"; organizationId: string; organizationName: string; orgRole: OrgRole }
  | { kind: "staff"; staffRole: StaffRole; title: string | null }
);

export type InviteOutcome =
  | { ok: true; id: string; link: string; emailed: boolean; joined: boolean }
  | { ok: false; error: string };

export function signInLink(kind: "client" | "staff", email: string) {
  const portal = kind === "staff" ? "staff" : "app";
  return `${portalOrigin(portal, headers().get("host"))}/login?email=${encodeURIComponent(email)}`;
}

export function canEmailInvites() {
  return isEmailConfigured() && hasVerifiedSender();
}

/** Replaces any pending invitation for the same person and scope, then delivers it as best it can. */
export async function issueInvitation(supabase: Client, input: InviteInput): Promise<InviteOutcome> {
  const organizationId = input.kind === "client" ? input.organizationId : null;

  let pending = supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("kind", input.kind)
    .eq("email", input.email)
    .is("accepted_at", null)
    .is("revoked_at", null);
  pending = organizationId ? pending.eq("organization_id", organizationId) : pending.is("organization_id", null);
  await pending;

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      kind: input.kind,
      email: input.email,
      full_name: input.fullName,
      organization_id: organizationId,
      org_role: input.kind === "client" ? input.orgRole : null,
      staff_role: input.kind === "staff" ? input.staffRole : null,
      title: input.kind === "staff" ? input.title : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error) console.error("[invite] Insert failed", error.message);
    return { ok: false, error: error ? friendlyDbError(error) : "The invitation could not be created." };
  }

  const joined = await applyForExistingAccount(input.email);
  const link = signInLink(input.kind, input.email);

  let emailed = false;
  if (canEmailInvites()) {
    try {
      await sendEmail({
        to: input.email,
        replyTo: siteConfig.email,
        ...invitationEmail({
          kind: input.kind,
          recipientName: input.fullName,
          organizationName: input.kind === "client" ? input.organizationName : null,
          roleLabel: input.kind === "client" ? rolePermissions[input.orgRole].label : staffRoleLabel[input.staffRole],
          inviterName: input.inviterName,
          link,
        }),
      });
      emailed = true;
    } catch (err) {
      console.error("[invite] Email failed", err);
    }
  }

  return { ok: true, id: data.id, link, emailed, joined };
}

async function applyForExistingAccount(email: string) {
  const admin = createAdminClient();
  if (!admin) return false;

  const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile) return false;

  const { data, error } = await admin.rpc("apply_invitations_for", { p_user: profile.id, p_email: email });
  if (error) console.error("[invite] Could not apply invitation", error.message);
  return (data ?? 0) > 0;
}

export function inviteMessage(outcome: Extract<InviteOutcome, { ok: true }>, email: string) {
  if (outcome.joined) return `${email} already had an account and now has access.`;
  if (outcome.emailed) return `Invitation sent to ${email}.`;
  return `Invitation created. Email delivery isn't set up yet, so share this sign-in link with ${email}.`;
}
