import { escapeHtml, layout } from "@/lib/emails/layout";
import { siteConfig } from "@/lib/site";

type Invite = {
  kind: "client" | "staff";
  recipientName?: string | null;
  organizationName?: string | null;
  roleLabel: string;
  inviterName?: string | null;
  link: string;
};

export function invitationEmail(i: Invite) {
  const where = i.kind === "staff" ? "Largis Workspace" : `${i.organizationName ?? "your organisation"} on the Largis client portal`;
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const by = i.inviterName ? `${i.inviterName} has invited you` : "You have been invited";

  const html = layout(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#77592f;">Invitation</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Join ${escapeHtml(where)}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      ${escapeHtml(by)} to join ${escapeHtml(where)} as <strong style="color:#15171c;">${escapeHtml(i.roleLabel)}</strong>.
      Sign in with this email address. We will send you a one-time code; there is no password to set.
    </p>
    <p style="margin:0 0 24px;"><a href="${i.link}" style="display:inline-block;background:#2f438e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;">Sign in</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">
      If you were not expecting this, you can ignore this email or contact ${escapeHtml(siteConfig.email)}.
    </p>
  `);

  const text = [
    greeting,
    "",
    `${by} to join ${where} as ${i.roleLabel}.`,
    "Sign in with this email address. We will send you a one-time code; there is no password to set.",
    "",
    i.link,
    "",
    `If you were not expecting this, you can ignore this email or contact ${siteConfig.email}.`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: i.kind === "staff" ? "You're invited to Largis Workspace" : `You're invited to ${where}`, html, text };
}
