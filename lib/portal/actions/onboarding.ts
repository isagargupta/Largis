"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { onboardingManager } from "@/lib/onboarding/access";
import { deleteOnboardingObjects, newOnboardingToken, onboardingJoinUrl } from "@/lib/onboarding/data";
import { deliverJoiningLink } from "@/lib/onboarding/notify";
import { issuesToFields, onboardingHrSchema, onboardingInviteSchema } from "@/lib/onboarding/schema";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingEmployment, OnboardingShift, OnboardingWorkMode } from "@/lib/supabase/types";

function refresh(id?: string) {
  revalidatePath("/staff/onboarding");
  if (id) revalidatePath(`/staff/onboarding/${id}`);
}

export async function createOnboarding(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await onboardingManager();
  if (!ctx) return failure("Only admins and managers can onboard employees.");

  const parsed = onboardingInviteSchema.safeParse({
    invite_name: formData.get("invite_name"),
    invite_email: formData.get("invite_email"),
    invite_phone: formData.get("invite_phone"),
    designation: formData.get("designation"),
    department: formData.get("department"),
    employment_type: formData.get("employment_type"),
    work_mode: formData.get("work_mode"),
    joining_date: formData.get("joining_date"),
    shift_preference: formData.get("shift_preference"),
  });
  if (!parsed.success) return failure("Please review the highlighted fields.", issuesToFields(parsed.error));

  const supabase = createClient();
  const { data, error } = await supabase
    .from("employee_onboardings")
    .insert({
      token: newOnboardingToken(),
      invite_name: parsed.data.invite_name,
      invite_email: parsed.data.invite_email,
      invite_phone: parsed.data.invite_phone,
      designation: parsed.data.designation,
      department: parsed.data.department,
      employment_type: parsed.data.employment_type as OnboardingEmployment | null,
      work_mode: parsed.data.work_mode as OnboardingWorkMode | null,
      joining_date: parsed.data.joining_date,
      shift_preference: parsed.data.shift_preference as OnboardingShift | null,
    })
    .select("id, token, expires_at")
    .single();
  if (error || !data) return failure(error ? friendlyDbError(error) : "The joining link could not be created.");

  const emailed = await deliverJoiningLink({
    to: parsed.data.invite_email,
    name: parsed.data.invite_name,
    link: onboardingJoinUrl(data.token),
    expiresAt: data.expires_at,
  });
  await logActivity(supabase, {
    action: "onboarding.created",
    entity: "onboarding",
    entity_id: data.id,
    metadata: { label: parsed.data.invite_name },
  });
  refresh(data.id);
  redirect(portalHref(`/staff/onboarding/${data.id}?sent=${emailed === "sent" ? "1" : "0"}`));
}

export async function updateOnboardingHr(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await onboardingManager();
  if (!ctx) return failure("Only admins and managers can update onboarding records.");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) return failure("That record could not be found.");
  const intent = String(formData.get("intent") ?? "save");

  const supabase = createClient();
  const { data: row, error: loadError } = await supabase
    .from("employee_onboardings")
    .select("id, status, full_name, invite_name, invite_email, token, expires_at")
    .eq("id", id)
    .maybeSingle();
  if (loadError) return failure(friendlyDbError(loadError));
  if (!row) return failure("That record could not be found.");
  const label = row.full_name ?? row.invite_name ?? "Employee";

  if (intent === "delete") {
    await deleteOnboardingObjects(supabase, id);
    const { error } = await supabase.from("employee_onboardings").delete().eq("id", id);
    if (error) return failure(friendlyDbError(error));
    await logActivity(supabase, { action: "onboarding.deleted", entity: "onboarding", entity_id: id, metadata: { label } });
    revalidatePath("/staff/onboarding");
    redirect(portalHref("/staff/onboarding"));
  }

  if (intent === "revoke") {
    if (row.status !== "open") return failure("Only a link that hasn't been submitted can be revoked.");
    const { error } = await supabase.from("employee_onboardings").update({ status: "revoked" }).eq("id", id).eq("status", "open");
    if (error) return failure(friendlyDbError(error));
    await logActivity(supabase, { action: "onboarding.revoked", entity: "onboarding", entity_id: id, metadata: { label } });
    refresh(id);
    return { status: "success", message: "The joining link has been revoked." };
  }

  if (intent === "email") {
    if (row.status !== "open") return failure("The form has already been submitted, so the link is closed.");
    if (new Date(row.expires_at).getTime() <= Date.now()) return failure("Renew the link, then email it.");
    if (!row.invite_email) return failure("Add an email address before sending the link.");
    const emailed = await deliverJoiningLink({
      to: row.invite_email,
      name: row.invite_name ?? row.full_name ?? "there",
      link: onboardingJoinUrl(row.token),
      expiresAt: row.expires_at,
    });
    if (emailed !== "sent") return failure(`The link is ready, but the email to ${row.invite_email} could not be sent. Copy the link from this page.`);
    await logActivity(supabase, { action: "onboarding.emailed", entity: "onboarding", entity_id: id, metadata: { label } });
    refresh(id);
    return { status: "success", message: `Joining link emailed to ${row.invite_email}.` };
  }

  if (intent === "extend") {
    if (row.status !== "open") return failure("Only an open link can be extended.");
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("employee_onboardings").update({ expires_at: expires }).eq("id", id).eq("status", "open");
    if (error) return failure(friendlyDbError(error));
    refresh(id);
    return { status: "success", message: "The link now works for another 30 days." };
  }

  const parsed = onboardingHrSchema.safeParse({
    offered_monthly_inr: formData.get("offered_monthly_inr"),
    staff_notes: formData.get("staff_notes"),
  });
  if (!parsed.success) return failure("Please review the highlighted fields.", issuesToFields(parsed.error));

  if (intent === "review" && row.status !== "submitted" && row.status !== "reviewed") {
    return failure("The employee hasn't submitted the form yet.");
  }

  const reviewed = intent === "review";
  const { error } = await supabase
    .from("employee_onboardings")
    .update({
      offered_monthly_inr: parsed.data.offered_monthly_inr,
      staff_notes: parsed.data.staff_notes,
      ...(reviewed ? { status: "reviewed" as const, reviewed_at: new Date().toISOString(), reviewed_by: ctx.user.id } : {}),
    })
    .eq("id", id);
  if (error) return failure(friendlyDbError(error));
  if (reviewed) {
    await logActivity(supabase, { action: "onboarding.reviewed", entity: "onboarding", entity_id: id, metadata: { label } });
  }
  refresh(id);
  return { status: "success", message: reviewed ? "Marked as reviewed." : "Saved." };
}
