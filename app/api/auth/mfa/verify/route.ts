import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/portal/hosts";
import { authLimits, withinLimit } from "@/lib/portal/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { mfaVerifySchema } from "@/lib/validations/portal";

/** Second sign-in step: upgrades the session to AAL2 with an authenticator-app code. */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Sign-in is not available yet." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your authenticator app." }, { status: 422 });
  }
  const { factorId, code, next } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Your sign-in expired. Start again." }, { status: 401 });
  }

  if (!(await withinLimit(createAdminClient(), "mfa-verify-user", user.id, authLimits.mfaPerUser))) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Wait 15 minutes and try again." },
      { status: 429, headers: { "Retry-After": String(authLimits.mfaPerUser.windowSeconds) } },
    );
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    return NextResponse.json({ ok: false, error: "That code didn't match. Check your authenticator app and try again." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, redirectTo: safeNextPath(next) ?? "/" });
}
