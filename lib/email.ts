type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const FALLBACK_SENDER = "Largis Venture <onboarding@resend.dev>";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** True once a sender on a Resend-verified domain is set; required to email people outside the team. */
export function hasVerifiedSender() {
  return Boolean(process.env.CONTACT_FROM_EMAIL);
}

export async function sendEmail({ to, subject, html, text, replyTo }: Email) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || FALLBACK_SENDER,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
