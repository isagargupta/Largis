import { NextResponse } from "next/server";
import { onboardingManager } from "@/lib/onboarding/access";
import { ONBOARDING_BUCKET, isOnboardingSlot, readDocuments } from "@/lib/onboarding/files";
import { isUuid } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const ctx = await onboardingManager();
  if (!ctx) return NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 });
  if (!isUuid(params.id)) return NextResponse.json({ error: "That record could not be found." }, { status: 404 });
  const slot = new URL(request.url).searchParams.get("slot");
  if (!isOnboardingSlot(slot)) return NextResponse.json({ error: "That document could not be found." }, { status: 404 });

  const supabase = createClient();
  const { data: row } = await supabase.from("employee_onboardings").select("documents").eq("id", params.id).maybeSingle();
  const file = row ? readDocuments(row.documents)[slot] : undefined;
  if (!file) return NextResponse.json({ error: "That document could not be found." }, { status: 404 });

  const { data, error } = await supabase.storage.from(ONBOARDING_BUCKET).createSignedUrl(file.path, 60, { download: file.name });
  if (error || !data?.signedUrl) return NextResponse.json({ error: "That document could not be opened." }, { status: 502 });
  return NextResponse.redirect(data.signedUrl);
}
