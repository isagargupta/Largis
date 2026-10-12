import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authLimits, clientIp, withinLimit } from "@/lib/portal/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPortalAuthConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { otpSendSchema } from "@/lib/validations/portal";

const GENERIC = "If this email has access, a code is on its way.";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function hasAccount(admin: Admin, email: string) {
  const { data } = await admin.from("profiles").select("id").eq("email", email).limit(1);
  return Boolean(data?.length);
}

async function hasPendingInvitation(admin: Admin, email: string) {
  const { data } = await admin
    .from("invitations")
    .select("id")
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .limit(1);
  return Boolean(data?.length);
}

export async function POST(request: Request) {
  const admin = isPortalAuthConfigured() ? createAdminClient() : null;
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Sign-in is being set up. Please check back shortly." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = otpSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a valid work email address." }, { status: 422 });
  }
  const { email } = parsed.data;

  // Over the limit, respond exactly as for an unknown address so limits reveal nothing about accounts.
  const [ipOk, emailOk] = await Promise.all([
    withinLimit(admin, "otp-send-ip", clientIp(request), authLimits.sendPerIp),
    withinLimit(admin, "otp-send-email", email, authLimits.sendPerEmail),
  ]);
  if (!ipOk || !emailOk) return NextResponse.json({ ok: true, message: GENERIC });

  try {
    const existing = await hasAccount(admin, email);
    if (existing || (await hasPendingInvitation(admin, email))) {
      // Invited people get their account here so public sign-ups can stay disabled in Supabase.
      if (!existing) {
        const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
        if (error) console.error("[otp] Could not create invited user", error.message);
      }

      const anon = createClient(supabaseUrl!, supabaseKey!, {
        auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
      });
      const { error } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) console.error("[otp] Could not send code", error.status, error.message);
    }
  } catch (err) {
    console.error("[otp] Unexpected error", err);
  }

  return NextResponse.json({ ok: true, message: GENERIC });
}
