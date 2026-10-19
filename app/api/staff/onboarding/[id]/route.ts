import { NextResponse } from "next/server";
import { onboardingManager } from "@/lib/onboarding/access";
import { submitOnboarding } from "@/lib/onboarding/data";
import { crossSite } from "@/lib/onboarding/http";
import { logActivity } from "@/lib/portal/activity";
import { isUuid } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The form was refused." }, { status: 403 });
  const ctx = await onboardingManager();
  if (!ctx) return NextResponse.json({ ok: false, error: "You don't have permission to do that." }, { status: 403 });
  if (!isUuid(params.id)) return NextResponse.json({ ok: false, error: "That record could not be found." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "The form could not be read." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: row, error } = await supabase.from("employee_onboardings").select("id, status, expires_at, documents").eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "That record could not be loaded." }, { status: 400 });
  if (!row) return NextResponse.json({ ok: false, error: "That record could not be found." }, { status: 404 });

  const result = await submitOnboarding(supabase, row, body, "staff");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, fieldErrors: result.fieldErrors }, { status: result.status });
  await logActivity(supabase, {
    action: row.status === "open" ? "onboarding.submitted" : "onboarding.updated",
    entity: "onboarding",
    entity_id: result.id,
    metadata: { label: result.name },
  });
  return NextResponse.json({ ok: true, id: result.id });
}
