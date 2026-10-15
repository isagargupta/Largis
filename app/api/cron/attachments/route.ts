import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH = 500;
const REMOVE_CHUNK = 100;
const MAX_ROUNDS = 10;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily Vercel cron: deletes chat and ticket files that were uploaded more than a day ago but never
 * sent, plus files left behind when an organization is deleted.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "Storage is not configured." }, { status: 503 });

  let removed = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await admin.rpc("stale_attachments", { p_limit: BATCH });
    if (error) return NextResponse.json({ ok: false, removed, error: "Could not list stale files." }, { status: 500 });
    const names = data ?? [];
    for (let i = 0; i < names.length; i += REMOVE_CHUNK) {
      const { error: removeError } = await admin.storage.from(ATTACHMENT_BUCKET).remove(names.slice(i, i + REMOVE_CHUNK));
      if (removeError) return NextResponse.json({ ok: false, removed, error: "Could not delete stale files." }, { status: 500 });
      removed += Math.min(REMOVE_CHUNK, names.length - i);
    }
    if (names.length < BATCH) break;
  }
  return NextResponse.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
}
