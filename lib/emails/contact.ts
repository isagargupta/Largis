import { siteConfig } from "@/lib/site";
import type { ContactInput } from "@/lib/validations/contact";

type Submission = Omit<ContactInput, "website">;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#15171c;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e0d6;">
          <tr><td style="background:#0b0b0d;padding:20px 28px;color:#ffffff;font-size:17px;letter-spacing:-0.02em;">
            <strong>Largis</strong> <span style="color:rgba(255,255,255,0.65);">Venture</span>
          </td></tr>
          <tr><td style="height:2px;background:#b48e4d;line-height:2px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:28px;">${body}</td></tr>
          <tr><td style="padding:18px 28px;border-top:1px solid #e5e0d6;font-size:12px;line-height:1.6;color:#7d7f88;">
            ${escapeHtml(siteConfig.legalName)} · ${escapeHtml(siteConfig.address)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0;border-top:1px solid #e5e0d6;width:130px;vertical-align:top;font-size:13px;color:#7d7f88;">${label}</td>
    <td style="padding:10px 0;border-top:1px solid #e5e0d6;font-size:14px;">${value}</td>
  </tr>`;
}

export function enquiryNotification(s: Submission) {
  const email = escapeHtml(s.email);
  const html = layout(`
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#77592f;">New enquiry</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(s.company)} · ${escapeHtml(s.interest)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Name", escapeHtml(s.name))}
      ${row("Email", `<a href="mailto:${email}" style="color:#2f438e;">${email}</a>`)}
      ${row("Company", escapeHtml(s.company))}
      ${row("Interest", escapeHtml(s.interest))}
    </table>
    <p style="margin:24px 0 8px;font-size:13px;color:#7d7f88;">Message</p>
    <div style="padding:16px;background:#fbfaf6;border:1px solid #e5e0d6;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(s.message)}</div>
    <p style="margin:24px 0 0;font-size:13px;color:#4c4f5a;">Reply to this email to respond to ${escapeHtml(s.name)} directly.</p>
  `);

  const text = [
    `New enquiry: ${s.company} (${s.interest})`,
    "",
    `Name: ${s.name}`,
    `Email: ${s.email}`,
    `Company: ${s.company}`,
    `Interest: ${s.interest}`,
    "",
    "Message:",
    s.message,
  ].join("\n");

  return { subject: `New enquiry: ${s.company} (${s.interest})`, html, text };
}

export function enquiryConfirmation(s: Submission, bookingUrl: string | null) {
  const firstName = escapeHtml(s.name.split(" ")[0] ?? s.name);
  const booking = bookingUrl
    ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;">If you would like to speak sooner, you can pick a time for a 30-minute call:</p>
       <p style="margin:0 0 24px;"><a href="${bookingUrl}" style="display:inline-block;background:#2f438e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;">Book a call</a></p>`
    : "";

  const html = layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;letter-spacing:-0.02em;">Thank you, ${firstName}. We have your request.</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4c4f5a;">
      ${escapeHtml(siteConfig.responseSla)} Someone from our team will reply to this address with next steps.
    </p>
    ${booking}
    <p style="margin:0 0 8px;font-size:13px;color:#7d7f88;">Your message</p>
    <div style="padding:16px;background:#fbfaf6;border:1px solid #e5e0d6;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#4c4f5a;">${escapeHtml(s.message)}</div>
  `);

  const text = [
    `Thank you, ${s.name.split(" ")[0] ?? s.name}. We have your request.`,
    "",
    `${siteConfig.responseSla} Someone from our team will reply to this address with next steps.`,
    ...(bookingUrl ? ["", `To speak sooner, book a 30-minute call: ${bookingUrl}`] : []),
    "",
    "Your message:",
    s.message,
    "",
    `— ${siteConfig.name}`,
  ].join("\n");

  return { subject: "We have received your request | Largis Venture", html, text };
}
