import { NextResponse } from "next/server";
import { onboardingManager } from "@/lib/onboarding/access";
import { removeOnboardingDocument, saveOnboardingDocument } from "@/lib/onboarding/data";
import { isOnboardingSlot } from "@/lib/onboarding/files";
import { crossSite, readUpload } from "@/lib/onboarding/http";
import { isUuid } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";

async function rowFor(id: string) {
  if (!isUuid(id)) return NextResponse.json({ ok: false, error: "That record could not be found." }, { status: 404 });
  const ctx = await onboardingManager();
  if (!ctx) return NextResponse.json({ ok: false, error: "You don't have permission to do that." }, { status: 403 });
  const supabase = createClient();
  const { data, error } = await supabase.from("employee_onboardings").select("id, status, expires_at, documents").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: "That record could not be loaded." }, { status: 400 });
  if (!data) return NextResponse.json({ ok: false, error: "That record could not be found." }, { status: 404 });
  return { supabase, row: data };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The upload was refused." }, { status: 403 });
  const ready = await rowFor(params.id);
  if (ready instanceof NextResponse) return ready;
  const upload = await readUpload(request);
  if ("error" in upload) return NextResponse.json({ ok: false, error: upload.error }, { status: 400 });
  const result = await saveOnboardingDocument(ready.supabase, ready.row, upload.slot, upload.file, "staff");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, name: result.name, size: result.size });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The upload was refused." }, { status: 403 });
  const slot = new URL(request.url).searchParams.get("slot");
  if (!isOnboardingSlot(slot)) return NextResponse.json({ ok: false, error: "That document could not be found." }, { status: 400 });
  const ready = await rowFor(params.id);
  if (ready instanceof NextResponse) return ready;
  const result = await removeOnboardingDocument(ready.supabase, ready.row, slot, "staff");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
