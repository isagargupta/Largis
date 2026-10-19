import { escapeHtml, layout } from "@/lib/emails/layout";
import { siteConfig } from "@/lib/site";

type Joining = {
  recipientName: string;
  link: string;
  expiresLabel: string;
};

export function joiningEmail({ recipientName, link, expiresLabel }: Joining) {
  const first = recipientName.trim().split(/\s+/)[0] || recipientName;
  const greeting = `Hello ${first},`;

  const html = layout(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#77592f;">Joining</p>
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Complete your joining form</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      ${escapeHtml(siteConfig.legalName)} needs your joining details before salary can be set up.
      The form asks for your identity, the bank account where salary should be credited, and your Class 10 and Class 12 marksheets.
      A college document is required only if you have a qualification.
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      This private link works until <strong style="color:#15171c;">${escapeHtml(expiresLabel)}</strong>.
      You do not need a Largis account.
    </p>
    <p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;background:#2f438e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;">Open joining form</a></p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#7d7f88;">Or copy this address into your browser:</p>
    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${link}" style="color:#2f438e;">${escapeHtml(link)}</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">
      If you were not expecting this, you can ignore this email or contact ${escapeHtml(siteConfig.email)}.
    </p>
  `);

  const text = [
    greeting,
    "",
    `${siteConfig.legalName} needs your joining details before salary can be set up.`,
    "The form asks for your identity, the bank account where salary should be credited, and your Class 10 and Class 12 marksheets.",
    "A college document is required only if you have a qualification.",
    "",
    `This private link works until ${expiresLabel}. You do not need a Largis account.`,
    "",
    link,
    "",
    `If you were not expecting this, you can ignore this email or contact ${siteConfig.email}.`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: "Your Largis joining form", html, text };
}
