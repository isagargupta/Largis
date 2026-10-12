import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export const authLimits = {
  sendPerEmail: { windowSeconds: 15 * 60, max: 5 },
  sendPerIp: { windowSeconds: 60 * 60, max: 20 },
  verifyPerEmail: { windowSeconds: 15 * 60, max: 10 },
  mfaPerUser: { windowSeconds: 15 * 60, max: 10 },
} as const;

/** The caller's IP as reported by the edge (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(request: Request) {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Buckets store a keyed hash, never the raw email or IP address. */
function bucket(kind: string, value: string) {
  const digest = createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "largis")
    .update(value.toLowerCase())
    .digest("hex")
    .slice(0, 40);
  return `${kind}:${digest}`;
}

/**
 * Records an attempt and returns false once the window's limit is exceeded. Fails open: a database
 * problem must not lock everyone out of sign-in, and Supabase Auth applies its own limits as well.
 */
export async function withinLimit(
  admin: Admin | null,
  kind: string,
  value: string,
  limit: { windowSeconds: number; max: number },
) {
  if (!admin) return true;
  const { data, error } = await admin.rpc("auth_rate_limit_hit", {
    p_bucket: bucket(kind, value),
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    console.error("[rate-limit] Check failed", error.message);
    return true;
  }
  return data !== false;
}
