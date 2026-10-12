import { NextResponse } from "next/server";
import { portalForHost, portalOrigin, safeNextPath } from "@/lib/portal/hosts";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { otpVerifySchema } from "@/lib/validations/portal";

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

  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter the code from your email." }, { status: 422 });
  }
  const { email, token, next } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.session || !data.user) {
    return NextResponse.json(
      { ok: false, error: "That code is invalid or has expired. Request a new one." },
      { status: 401 },
    );
  }

  const { error: acceptError } = await supabase.rpc("accept_pending_invitations");
  if (acceptError) console.error("[otp] Could not accept invitations", acceptError.message);

  const host = request.headers.get("host");
  const portal = portalForHost(host) ?? "app";
  const [{ data: isStaff }, { count }] = await Promise.all([
    supabase.rpc("is_staff"),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("user_id", data.user.id),
  ]);
  const isClient = (count ?? 0) > 0;

  // Sessions are cookies scoped to one host, so people sign in on the portal they use.
  const wrongPortal = portal === "staff" ? !isStaff : isStaff && !isClient;
  if (wrongPortal) {
    await supabase.auth.signOut({ scope: "local" });
    if (portal === "staff" && !isClient) {
      return NextResponse.json(
        { ok: false, error: "This email doesn't have access to Largis Workspace." },
        { status: 403 },
      );
    }
    const other = portal === "staff" ? "app" : "staff";
    return NextResponse.json(
      {
        ok: false,
        error:
          other === "staff"
            ? "This is a Largis staff account. Sign in on Largis Workspace instead."
            : "This account uses the client portal. Sign in there instead.",
        switchTo: {
          label: other === "staff" ? "Go to Largis Workspace" : "Go to the client portal",
          href: `${portalOrigin(other, host)}/login?email=${encodeURIComponent(email)}`,
        },
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, redirectTo: safeNextPath(next) ?? "/" });
}
