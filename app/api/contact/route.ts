import { NextResponse } from "next/server";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { enquiryConfirmation, enquiryNotification } from "@/lib/emails/contact";
import { siteConfig } from "@/lib/site";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { contactSchema, type ContactFieldErrors } from "@/lib/validations/contact";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: ContactFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ContactFieldErrors;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, fieldErrors }, { status: 422 });
  }

  const { website, ...submission } = parsed.data;
  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!isSupabaseConfigured() && !isEmailConfigured()) {
    console.warn("[contact] No storage or email configured; enquiry exists only in this log", submission);
    return NextResponse.json({ ok: true });
  }

  let stored = false;
  let notified = false;

  if (isSupabaseConfigured()) {
    const { error } = await createClient().from("contact_submissions").insert(submission);
    if (error) console.error("[contact] Failed to persist submission", error.message);
    else stored = true;
  }

  if (isEmailConfigured()) {
    try {
      await sendEmail({
        to: process.env.CONTACT_NOTIFY_EMAIL || siteConfig.email,
        replyTo: submission.email,
        ...enquiryNotification(submission),
      });
      notified = true;
    } catch (err) {
      console.error("[contact] Failed to send enquiry alert", err);
    }

    if (hasVerifiedSender()) {
      const bookingUrl = siteConfig.calLink ? `https://cal.com/${siteConfig.calLink}` : null;
      await sendEmail({
        to: submission.email,
        replyTo: siteConfig.email,
        ...enquiryConfirmation(submission, bookingUrl),
      }).catch((err) => console.error("[contact] Failed to send confirmation", err));
    }
  }

  if (!stored && !notified) {
    return NextResponse.json(
      { ok: false, error: `We couldn't submit your request. Please email us at ${siteConfig.email}.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
