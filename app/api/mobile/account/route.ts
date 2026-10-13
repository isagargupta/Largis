import { isEmailConfigured, sendEmail } from "@/lib/email";
import { escapeHtml, layout } from "@/lib/emails/layout";
import { mobileError, mobileJson, requireMobileUser } from "@/lib/mobile/api";
import { isReviewEmail } from "@/lib/mobile/review";
import { siteConfig } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * In-app account deletion (required by the App Store). Removes the sign-in and memberships; records the
 * person created stay with their organization. The Largis team is told so sole-owner clients get a new owner.
 */
export async function DELETE() {
  const gate = await requireMobileUser();
  if ("response" in gate) return gate.response;
  const { user, staff } = gate;

  if (staff) return mobileError(403, "Staff accounts are managed by a Largis admin.", "forbidden");
  if (user.email && isReviewEmail(user.email)) {
    return mobileJson({ ok: true, message: "The review account is reset instead of deleted." });
  }

  const admin = createAdminClient();
  if (!admin) return mobileError(503, "Account deletion is unavailable right now. Email us and we'll do it for you.");

  const supabase = createClient();
  const { data: memberships } = await supabase.from("memberships").select("organization_id, role").eq("user_id", user.id);
  const { data: orgRows } = memberships?.length
    ? await supabase.from("organizations").select("id, name").in("id", memberships.map((m) => m.organization_id))
    : { data: [] };
  const orgNames = new Map((orgRows ?? []).map((o) => [o.id, o.name]));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] Deletion failed", error.message);
    return mobileError(500, "Your account could not be deleted. Please try again or email us.");
  }

  if (isEmailConfigured()) {
    const orgs = (memberships ?? []).map((m) => `${orgNames.get(m.organization_id) ?? "Unknown organisation"} (${m.role})`);
    const lines = [`${user.email ?? user.id} deleted their account from the mobile app.`, "", "Memberships removed:", ...orgs];
    try {
      await sendEmail({
        to: process.env.CONTACT_NOTIFY_EMAIL || siteConfig.email,
        subject: `Account deleted: ${user.email ?? user.id}`,
        html: layout(`<p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(lines.join("\n"))}</p>`),
        text: lines.join("\n"),
      });
    } catch (err) {
      console.error("[account] Deletion notice failed", err);
    }
  }

  return mobileJson({ ok: true, message: "Your account has been deleted." });
}
