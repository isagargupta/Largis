import "server-only";
import { NextResponse } from "next/server";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { getClientMfaRequirement, getMfaState, getStaffMember } from "@/lib/portal/session";
import { bearerToken } from "@/lib/supabase/server";

type ErrorCode = "unauthenticated" | "mfa_required" | "mfa_enrollment_required" | "forbidden" | "invalid";

export function mobileJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function mobileError(status: number, error: string, code?: ErrorCode, extra?: Record<string, unknown>) {
  return mobileJson({ ok: false, error, ...(code ? { code } : {}), ...extra }, status);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Gate for every mobile route: a valid bearer session that has passed any authenticator-app challenge,
 * and an enrolled factor when one of the user's organizations requires it.
 */
export async function requireMobileUser() {
  if (!bearerToken()) return { response: mobileError(401, "Sign in again to continue.", "unauthenticated") };
  const mfa = await getMfaState();
  if (!mfa) return { response: mobileError(401, "Your session expired. Sign in again.", "unauthenticated") };
  if (mfa.needsChallenge) {
    return { response: mobileError(403, "Enter the code from your authenticator app to continue.", "mfa_required") };
  }
  const [requiredBy, staff] = await Promise.all([getClientMfaRequirement(), getStaffMember()]);
  if (requiredBy.length && !mfa.factors.length) {
    return {
      response: mobileError(403, `${requiredBy[0]} requires two-step verification. Set it up to continue.`, "mfa_enrollment_required"),
    };
  }
  return { user: mfa.user, staff };
}

/** Server actions take form posts; the app sends JSON with the same field names. */
export function toFormData(values: Record<string, unknown>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    form.set(key, typeof value === "boolean" ? (value ? "true" : "false") : String(value));
  }
  return form;
}

export async function runAction(
  action: (state: ActionState, form: FormData) => Promise<ActionState>,
  values: Record<string, unknown>,
) {
  const state = await action(idleState, toFormData(values));
  if (state.status === "success") return mobileJson({ ok: true, message: state.message, id: state.id });
  return mobileJson({ ok: false, error: state.message ?? "Something went wrong.", fieldErrors: state.fieldErrors }, 400);
}
