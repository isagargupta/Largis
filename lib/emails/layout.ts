import { siteConfig } from "@/lib/site";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function layout(body: string) {
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
