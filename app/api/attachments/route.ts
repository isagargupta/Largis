import { NextResponse } from "next/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { aalFromAccessToken, verifiedTotpFactors } from "@/lib/portal/mfa";
import { createClient, getAuthSession, isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/;
const SIGNED_URL_SECONDS = 300;

function deny(status: number, message: string) {
  return new NextResponse(message, { status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });
}

/**
 * Chat and ticket files live in a private bucket. The storage policy decides whether the caller may read
 * the file (member of the organization, never internal notes), and the link it signs expires quickly.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return deny(404, "Not found");
  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  if (!PATH.test(path)) return deny(404, "Not found");

  const supabase = createClient();
  const { user, accessToken } = await getAuthSession(supabase);
  if (!user) return deny(401, "Sign in to open this file.");

  const aal = aalFromAccessToken(accessToken);
  if (verifiedTotpFactors(user).length && aal !== "aal2") return deny(403, "Complete two-step verification first.");
  if (aal !== "aal2") {
    const { data: org } = await supabase.from("organizations").select("require_mfa").eq("id", path.split("/")[0]).maybeSingle();
    if (org?.require_mfa) return deny(403, "Set up two-step verification to open files.");
  }

  const fileName = path.split("/")[2];
  const download = url.searchParams.get("download") === "1";
  const { data: signed, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, download ? { download: fileName } : undefined);
  if (error || !signed?.signedUrl) return deny(404, "The file could not be found.");

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json(
      { ok: true, url: signed.signedUrl, fileName, expiresIn: SIGNED_URL_SECONDS },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
}
