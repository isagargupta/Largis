import { NextResponse } from "next/server";
import { loadOnboardingByToken, removeOnboardingDocument, saveOnboardingDocument } from "@/lib/onboarding/data";
import { ONBOARDING_TOKEN, isOnboardingSlot } from "@/lib/onboarding/files";
import { crossSite, readUpload } from "@/lib/onboarding/http";
import { createAdminClient } from "@/lib/supabase/admin";

async function openRow(token: string) {
  if (!ONBOARDING_TOKEN.test(token)) return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 404 });
  const loaded = await loadOnboardingByToken(token);
  if (loaded.kind === "invalid") return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 404 });
  if (loaded.kind === "unavailable") return NextResponse.json({ ok: false, error: "Uploads are temporarily unavailable." }, { status: 503 });
  if (loaded.kind === "done") return NextResponse.json({ ok: false, error: "These details were already submitted." }, { status: 409 });
  if (loaded.kind === "closed") return NextResponse.json({ ok: false, error: "This link is no longer active." }, { status: 410 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "Uploads are temporarily unavailable." }, { status: 503 });
  return { admin, row: loaded.row };
}

export async function POST(request: Request, { params }: { params: { token: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The upload was refused." }, { status: 403 });
  const ready = await openRow(params.token);
  if (ready instanceof NextResponse) return ready;
  const upload = await readUpload(request);
  if ("error" in upload) return NextResponse.json({ ok: false, error: upload.error }, { status: 400 });
  const result = await saveOnboardingDocument(ready.admin, ready.row, upload.slot, upload.file, "public");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, name: result.name, size: result.size });
}

export async function DELETE(request: Request, { params }: { params: { token: string } }) {
  if (crossSite(request)) return NextResponse.json({ ok: false, error: "The upload was refused." }, { status: 403 });
  const slot = new URL(request.url).searchParams.get("slot");
  if (!isOnboardingSlot(slot)) return NextResponse.json({ ok: false, error: "That document could not be found." }, { status: 400 });
  const ready = await openRow(params.token);
  if (ready instanceof NextResponse) return ready;
  const result = await removeOnboardingDocument(ready.admin, ready.row, slot, "public");
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
