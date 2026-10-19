import { NextResponse } from "next/server";
import { loadOnboardingByToken, submitOnboarding } from "@/lib/onboarding/data";
import { ONBOARDING_TOKEN } from "@/lib/onboarding/files";
import { crossSite } from "@/lib/onboarding/http";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: { token: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The form was refused." }, { status: 403 });
  if (!ONBOARDING_TOKEN.test(params.token)) return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 404 });

  const loaded = await loadOnboardingByToken(params.token);
  if (loaded.kind === "invalid") return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 404 });
  if (loaded.kind === "unavailable") return NextResponse.json({ ok: false, error: "The form is temporarily unavailable." }, { status: 503 });
  if (loaded.kind === "done") return NextResponse.json({ ok: false, error: "These details were already submitted." }, { status: 409 });
  if (loaded.kind === "closed") return NextResponse.json({ ok: false, error: "This link is no longer active." }, { status: 410 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "The form could not be read." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "The form is temporarily unavailable." }, { status: 503 });
  const result = await submitOnboarding(admin, loaded.row, body, "public");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });

  const { error: logError } = await admin.from("activity_log").insert({
    action: "onboarding.submitted",
    entity: "onboarding",
    entity_id: result.id,
    metadata: { label: result.name ?? "Employee" },
  });
  if (logError) console.error("[onboarding] activity log failed", logError.code);
  return NextResponse.json({ ok: true });
}
