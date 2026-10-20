import { escapeHtml, layout } from "@/lib/emails/layout";
import { siteConfig } from "@/lib/site";

function button(href: string, label: string) {
  return `<p style="margin:0 0 24px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#2f438e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a></p>`;
}

function eyebrow(text: string) {
  return `<p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#77592f;">${escapeHtml(text)}</p>`;
}

function excerpt(body: string, max = 1500) {
  return body.length > max ? `${body.slice(0, max).trimEnd()}…` : body;
}

export function ticketReplyEmail(i: {
  reference: string;
  subject: string;
  body: string;
  recipientName?: string | null;
  agentName?: string | null;
  link: string;
}) {
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const who = i.agentName ? `${i.agentName} from the Largis support team` : "The Largis support team";
  const message = excerpt(i.body);

  const html = layout(`
    ${eyebrow(`Support · ${i.reference}`)}
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(i.subject)}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">${escapeHtml(who)} replied to your ticket:</p>
    <div style="margin:0 0 24px;padding:14px 16px;border-left:2px solid #b48e4d;background:#fbfaf6;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
    ${button(i.link, "View the ticket")}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">
      Reply from the client portal so the conversation stays in one place.
    </p>
  `);

  const text = [
    greeting,
    "",
    `${who} replied to ${i.reference} (${i.subject}):`,
    "",
    message,
    "",
    `View the ticket: ${i.link}`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: `[${i.reference}] ${i.subject}`, html, text };
}

export function chatMessageEmail(i: {
  audience: "client" | "staff";
  organizationName: string;
  senderName: string;
  body: string;
  recipientName?: string | null;
  link: string;
}) {
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const intro =
    i.audience === "client"
      ? `${i.senderName} from the Largis team sent you a message:`
      : `${i.senderName} from ${i.organizationName} sent a message:`;
  const message = excerpt(i.body);

  const html = layout(`
    ${eyebrow(i.audience === "client" ? "New message" : `Client chat · ${i.organizationName}`)}
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">
      ${i.audience === "client" ? "The Largis team replied" : `New message from ${escapeHtml(i.organizationName)}`}
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">${escapeHtml(intro)}</p>
    <div style="margin:0 0 24px;padding:14px 16px;border-left:2px solid #b48e4d;background:#fbfaf6;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
    ${button(i.link, i.audience === "client" ? "Open messages" : "Reply in Workspace")}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">
      Reply from the ${i.audience === "client" ? "client portal" : "Largis Workspace"} so the conversation stays in one place.
    </p>
  `);

  const text = [
    greeting,
    "",
    intro,
    "",
    message,
    "",
    `${i.audience === "client" ? "Open messages" : "Reply in Workspace"}: ${i.link}`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  const subject =
    i.audience === "client" ? `New message from the ${siteConfig.name} team` : `New client message: ${i.organizationName}`;
  return { subject, html, text };
}

export function reportPublishedEmail(i: {
  title: string;
  organizationName: string;
  period?: string | null;
  summary?: string | null;
  recipientName?: string | null;
  link: string;
}) {
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const html = layout(`
    ${eyebrow("New report")}
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(i.title)}</h1>
    ${i.period ? `<p style="margin:0 0 16px;font-size:13px;color:#7d7f88;">${escapeHtml(i.period)}</p>` : ""}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      A new report for ${escapeHtml(i.organizationName)} is available on the client portal.
    </p>
    ${i.summary ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4c4f5a;">${escapeHtml(excerpt(i.summary, 600))}</p>` : ""}
    ${button(i.link, "Read the report")}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">Questions? Reply to this email or contact ${escapeHtml(siteConfig.email)}.</p>
  `);

  const text = [
    greeting,
    "",
    `A new report for ${i.organizationName} is available: ${i.title}${i.period ? ` (${i.period})` : ""}.`,
    ...(i.summary ? ["", excerpt(i.summary, 600)] : []),
    "",
    `Read the report: ${i.link}`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: `New report: ${i.title}`, html, text };
}

export function invoiceIssuedEmail(i: {
  number: string;
  organizationName: string;
  total: string;
  dueDate: string;
  recipientName?: string | null;
  link: string;
}) {
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#7d7f88;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;text-align:right;font-weight:600;">${escapeHtml(value)}</td></tr>`;

  const html = layout(`
    ${eyebrow("Invoice")}
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(i.number)}</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      A new invoice for ${escapeHtml(i.organizationName)} is available on the client portal.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:1px solid #e6e2d8;border-bottom:1px solid #e6e2d8;">
      ${row("Amount due", i.total)}
      ${row("Due date", i.dueDate)}
    </table>
    ${button(i.link, "View and download")}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">Questions about this invoice? Reply to this email or contact ${escapeHtml(siteConfig.email)}.</p>
  `);

  const text = [
    greeting,
    "",
    `Invoice ${i.number} for ${i.organizationName} is available on the client portal.`,
    "",
    `Amount due: ${i.total}`,
    `Due date: ${i.dueDate}`,
    "",
    `View and download: ${i.link}`,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: `Invoice ${i.number} from ${siteConfig.name}`, html, text };
}

export function taskReminderEmail(i: { lead: string; task: string; due: string; link: string; recipientName?: string | null }) {
  const greeting = i.recipientName ? `Hello ${i.recipientName.split(" ")[0]},` : "Hello,";
  const html = layout(`
    ${eyebrow("RevenueDesk")}
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Follow-up due</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      ${escapeHtml(i.task)} for ${escapeHtml(i.lead)} was due ${escapeHtml(i.due)}.
    </p>
    ${button(i.link, "Open the lead")}
    <p style="margin:0;font-size:13px;line-height:1.6;color:#7d7f88;">This reminder is sent once for each follow-up.</p>
  `);
  const text = [greeting, "", `${i.task} for ${i.lead} was due ${i.due}.`, "", `Open the lead: ${i.link}`, "", `— ${siteConfig.name}`].join("\n");
  return { subject: `Follow-up due: ${i.lead}`, html, text };
}
