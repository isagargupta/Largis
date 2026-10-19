import "server-only";
import { NextResponse } from "next/server";
import { getMfaState, getStaffMember, getStaffMfaRequired, getUser } from "@/lib/portal/session";

function deny(status: number, error: string) {
  return { response: NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } }) } as const;
}

/** Staff-only API access with the same two-step verification rules as the workspace pages. */
export async function requireStaffApi(options: { manage?: boolean } = {}) {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user) return deny(401, "Sign in again to continue.");
  if (!staff) return deny(403, "Only Largis staff can use this.");
  const [mfa, mfaRequired] = await Promise.all([getMfaState(), getStaffMfaRequired()]);
  if (mfa?.needsChallenge) return deny(403, "Complete two-step verification first.");
  if (mfaRequired && !mfa?.factors.length) return deny(403, "Set up two-step verification first.");
  if (options.manage && staff.role !== "admin" && staff.role !== "manager") {
    return deny(403, "Only admins and managers can change the knowledge base.");
  }
  return { user, staff } as const;
}
