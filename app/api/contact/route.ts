import { NextResponse } from "next/server";
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

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { error } = await supabase.from("contact_submissions").insert(submission);
    if (error) {
      console.error("[contact] Failed to persist submission", error.message);
      return NextResponse.json(
        { ok: false, error: "We couldn't submit your request. Please email us directly." },
        { status: 500 },
      );
    }
  } else {
    console.info("[contact] New enquiry (Supabase not configured)", {
      company: submission.company,
      interest: submission.interest,
    });
  }

  return NextResponse.json({ ok: true });
}
