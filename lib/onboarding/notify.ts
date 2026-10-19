import "server-only";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { joiningEmail } from "@/lib/emails/onboarding";
import { siteConfig } from "@/lib/site";

export function joiningExpiryLabel(expiresAt: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(expiresAt));
}

/** Sends the private joining link. The record still exists when email is skipped or fails. */
export async function deliverJoiningLink(input: { to: string; name: string; link: string; expiresAt: string }) {
  if (!isEmailConfigured() || !hasVerifiedSender()) return "skipped" as const;
  try {
    await sendEmail({
      to: input.to,
      replyTo: siteConfig.email,
      ...joiningEmail({
        recipientName: input.name,
        link: input.link,
        expiresLabel: joiningExpiryLabel(input.expiresAt),
      }),
    });
    return "sent" as const;
  } catch (error) {
    console.error("[onboarding] joining email failed", error);
    return "failed" as const;
  }
}
