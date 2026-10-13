import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mobileError, mobileJson, readJson } from "@/lib/mobile/api";
import { reviewPasswordFor } from "@/lib/mobile/review";
import { verifiedTotpFactors } from "@/lib/portal/mfa";
import { authLimits, withinLimit } from "@/lib/portal/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPortalAuthConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";
import { emailField } from "@/lib/validations/portal";

const schema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from your email."),
});

/**
 * Mobile sign-in: exchanges the emailed code for a session the app stores itself. Same eligibility as
 * the web (client portal members only), same rate limits.
 */
export async function POST(request: Request) {
  if (!isPortalAuthConfigured()) return mobileError(503, "Sign-in is being set up. Please check back shortly.");

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return mobileError(422, "Enter the code from your email.", "invalid");
  const { email, code } = parsed.data;

  const admin = createAdminClient();
  if (!(await withinLimit(admin, "otp-verify-email", email, authLimits.verifyPerEmail))) {
    return mobileError(429, "Too many attempts. Wait 15 minutes, then request a new code.");
  }

  const anon = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const reviewPassword = reviewPasswordFor(email, code);
  const { data, error } = reviewPassword
    ? await anon.auth.signInWithPassword({ email, password: reviewPassword })
    : await anon.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.session || !data.user) {
    return mobileError(401, "That code is invalid or has expired. Request a new one.");
  }

  const session = data.session;
  const asUser = createClient<Database>(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { error: acceptError } = await asUser.rpc("accept_pending_invitations");
  if (acceptError) console.error("[mobile-auth] Could not accept invitations", acceptError.message);

  const [{ data: isStaff }, { count }] = await Promise.all([
    asUser.rpc("is_staff"),
    asUser.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", data.user.id),
  ]);
  if (isStaff && !count) {
    await admin?.auth.admin.signOut(session.access_token, "local");
    return mobileError(403, "This app is for Largis clients. Staff should use Largis Workspace on the web.", "forbidden");
  }

  const factors = verifiedTotpFactors(data.user);
  return mobileJson({
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
    },
    mfaRequired: factors.length > 0,
    factors: factors.map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app" })),
  });
}
