"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { verifiedTotpFactors } from "@/lib/portal/mfa";
import { getStaffMember, getUser } from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  mfaEnrollSchema,
  mfaEnrollVerifySchema,
  mfaRemoveSchema,
  staffMfaSettingSchema,
} from "@/lib/validations/portal";

export type EnrollState = ActionState & {
  enrollment?: { factorId: string; qrCode: string; secret: string };
};

/**
 * The signed-in user, read fresh: these actions change factors and the page re-renders in the same
 * request, so the request-cached getUser() would show the old list.
 */
async function freshUser() {
  const { data } = await createClient().auth.getUser();
  return data.user ?? null;
}

/** Whether the caller must keep at least one factor: a staff-wide or client-organization requirement. */
async function mfaRequiredFor(userId: string) {
  const supabase = createClient();
  const { data: staff } = await supabase.from("staff_members").select("user_id").eq("user_id", userId).eq("active", true).maybeSingle();
  if (staff) {
    const { data } = await supabase.from("security_settings").select("require_staff_mfa").maybeSingle();
    return data?.require_staff_mfa ?? false;
  }
  const { data: memberships } = await supabase.from("memberships").select("organization_id").eq("user_id", userId);
  const ids = (memberships ?? []).map((m) => m.organization_id);
  if (!ids.length) return false;
  const { count } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .in("id", ids)
    .eq("require_mfa", true);
  return (count ?? 0) > 0;
}

export async function startTotpEnrollment(_: EnrollState, formData: FormData): Promise<EnrollState> {
  const user = await freshUser();
  if (!user) return failure("Your session expired. Sign in again.");

  const parsed = mfaEnrollSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));

  const supabase = createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return failure("Two-step verification isn't available right now. Please try again.");

  // Abandoned set-ups block new ones with the same name; clear them first.
  for (const factor of factors.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const taken = new Set(factors.totp.map((f) => f.friendly_name));
  let friendlyName = parsed.data.friendlyName;
  for (let n = 2; taken.has(friendlyName) && n < 20; n++) friendlyName = `${parsed.data.friendlyName} ${n}`;

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: siteConfig.name });
  if (error || !data) {
    console.error("[mfa] Enrollment failed", error?.message);
    return failure(
      /disabled|not enabled/i.test(error?.message ?? "")
        ? "Authenticator apps aren't enabled for this project yet. Contact Largis support."
        : "The authenticator could not be set up. Please try again.",
    );
  }

  return {
    status: "idle",
    enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
  };
}

export async function confirmTotpEnrollment(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await freshUser();
  if (!user) return failure("Your session expired. Sign in again.");

  const parsed = mfaEnrollVerifySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));

  const { error } = await createClient().auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) {
    return failure("That code didn't match.", { code: "Check the time on your phone and enter the newest code." });
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Two-step verification is on. You'll enter a code from the app each time you sign in." };
}

export async function removeTotpFactor(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await freshUser();
  if (!user) return failure("Your session expired. Sign in again.");

  const parsed = mfaRemoveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That authenticator could not be found.");

  const verified = verifiedTotpFactors(user);
  const target = verified.find((f) => f.id === parsed.data.factorId);
  if (!target) return failure("That authenticator could not be found.");
  if (verified.length === 1 && (await mfaRequiredFor(user.id))) {
    return failure("Two-step verification is required for your account. Add another authenticator before removing this one.");
  }

  const { error } = await createClient().auth.mfa.unenroll({ factorId: target.id });
  if (error) {
    console.error("[mfa] Unenroll failed", error.message);
    return failure("The authenticator could not be removed. Sign out, sign in again with your code, and retry.");
  }

  revalidatePath("/", "layout");
  return { status: "success", message: `${target.friendly_name || "Authenticator"} removed.` };
}

export async function setStaffMfaRequirement(_: ActionState, formData: FormData): Promise<ActionState> {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  if (!user || staff?.role !== "admin") return failure("Only staff admins can change this setting.");

  const parsed = staffMfaSettingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That setting could not be read.");
  const required = parsed.data.requireStaffMfa;

  if (required && !verifiedTotpFactors(user).length) {
    return failure("Set up an authenticator app for your own account before requiring it for everyone.");
  }

  const supabase = createClient();
  const { error } = await supabase.from("security_settings").update({ require_staff_mfa: required }).eq("id", true);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: null,
    action: "security.staff_mfa_changed",
    entity: "security_settings",
    entity_id: null,
    metadata: { required },
  });

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: required
      ? "Two-step verification is now required. Staff without an authenticator will be asked to add one."
      : "Two-step verification is now optional for staff.",
  };
}
