import type { User } from "@supabase/supabase-js";

export type AssuranceLevel = "aal1" | "aal2";

/** Verified authenticator-app factors; unverified ones are abandoned enrollments. */
export function verifiedTotpFactors(user: Pick<User, "factors"> | null | undefined) {
  return (user?.factors ?? []).filter((f) => f.factor_type === "totp" && f.status === "verified");
}

/**
 * The `aal` claim of a Supabase access token. Only meaningful for a token the server has already
 * validated (auth.getUser succeeded for the same session). Edge-safe: no Buffer.
 */
export function aalFromAccessToken(token: string | null | undefined): AssuranceLevel | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

/** Anyone with a verified factor must complete the challenge each session, whatever their role. */
export function needsMfaChallenge(user: Pick<User, "factors"> | null | undefined, accessToken: string | null | undefined) {
  return verifiedTotpFactors(user).length > 0 && aalFromAccessToken(accessToken) !== "aal2";
}
