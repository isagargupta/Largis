import { NextResponse } from "next/server";
import { BILLING_BUCKET } from "@/lib/portal/billing";
import { aalFromAccessToken, verifiedTotpFactors } from "@/lib/portal/mfa";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 60;

function deny(status: number, message: string) {
  return new NextResponse(message, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });
}

function fileName(base: string) {
  return `${base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "document"}.pdf`;
}

/**
 * Billing PDFs live in a private bucket. Row-level security decides whether the caller can see the
 * record; storage policies check again when signing, so the redirect target is valid for a minute only.
 */
export async function GET(_: Request, { params }: { params: { kind: string; id: string } }) {
  if (!isSupabaseConfigured()) return deny(404, "Not found");
  if ((params.kind !== "invoices" && params.kind !== "contracts") || !UUID.test(params.id)) return deny(404, "Not found");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return deny(401, "Sign in to download this document.");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const aal = aalFromAccessToken(session?.access_token);
  const factors = verifiedTotpFactors(user);
  if (factors.length && aal !== "aal2") return deny(403, "Complete two-step verification first.");

  let organizationId: string;
  let path: string | null;
  let name: string;
  if (params.kind === "invoices") {
    const { data } = await supabase
      .from("invoices")
      .select("organization_id, number, pdf_path")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) return deny(404, "Not found");
    organizationId = data.organization_id;
    path = data.pdf_path;
    name = data.number ?? "invoice-draft";
  } else {
    const { data } = await supabase
      .from("contracts")
      .select("organization_id, title, document_path")
      .eq("id", params.id)
      .maybeSingle();
    if (!data) return deny(404, "Not found");
    organizationId = data.organization_id;
    path = data.document_path;
    name = `contract-${data.title}`;
  }
  if (!path) return deny(404, "No PDF is available for this record yet.");

  if (aal !== "aal2") {
    const [{ data: org }, { data: settings }] = await Promise.all([
      supabase.from("organizations").select("require_mfa").eq("id", organizationId).maybeSingle(),
      supabase.from("security_settings").select("require_staff_mfa").maybeSingle(),
    ]);
    // security_settings is only readable by staff, so a row here means the caller is staff.
    const required = settings ? settings.require_staff_mfa : Boolean(org?.require_mfa);
    if (required) return deny(403, "Set up two-step verification to download billing documents.");
  }

  const { data: signed, error } = await supabase.storage
    .from(BILLING_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: fileName(name) });
  if (error || !signed?.signedUrl) return deny(404, "The document could not be found.");

  const response = NextResponse.redirect(signed.signedUrl, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
