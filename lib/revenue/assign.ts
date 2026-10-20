import "server-only";
import { failure, type ActionState } from "@/lib/portal/action-state";
import type { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { AssignmentMode } from "@/lib/supabase/types";
import { leadTitle, phoneDigits } from "@/lib/revenue/stages";

type Access = NonNullable<Awaited<ReturnType<typeof getOrgAccess>>>;

export async function findDuplicateLead(
  organizationId: string,
  email: string | null,
  phone: string | null,
  exceptId?: string,
) {
  const supabase = createClient();
  const digits = phoneDigits(phone);
  const columns = "id, company, contact_name";

  if (email) {
    let query = supabase.from("leads").select(columns).eq("organization_id", organizationId).eq("contact_email", email);
    if (exceptId) query = query.neq("id", exceptId);
    const { data } = await query.limit(1).maybeSingle();
    if (data) return { ...data, reason: "email" as const };
  }

  if (digits) {
    let query = supabase.from("leads").select(columns).eq("organization_id", organizationId).eq("phone_digits", digits);
    if (exceptId) query = query.neq("id", exceptId);
    const { data } = await query.limit(1).maybeSingle();
    if (data) return { ...data, reason: "phone" as const };
  }

  return null;
}

export function duplicateLeadState(existing: { id: string; company: string | null; contact_name: string; reason: "email" | "phone" }): ActionState {
  const via = existing.reason === "email" ? "email" : "phone";
  return {
    status: "error",
    message: `${leadTitle(existing)} already has this ${via}.`,
    id: existing.id,
  };
}

export async function loadAssignment(organizationId: string) {
  const { data } = await createClient()
    .from("organization_revenue_settings")
    .select("assignment_mode, fixed_owner_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return {
    mode: (data?.assignment_mode ?? "manual") as AssignmentMode,
    fixedOwnerId: data?.fixed_owner_id ?? null,
  };
}

export async function canOwnLead(organizationId: string, userId: string) {
  const { data } = await createClient()
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data && data.role !== "viewer");
}

/** Owner for a new lead. Agents keep the lead. An empty owner follows the organisation's assignment rule. */
export async function resolveNewOwner(
  access: Access,
  organizationId: string,
  requested: string | null,
): Promise<{ ownerId: string | null } | { error: ActionState }> {
  if (!access.perms.canAssign) return { ownerId: access.user.id };
  if (requested) {
    if (!(await canOwnLead(organizationId, requested))) {
      return { error: failure("Please review the highlighted fields.", { ownerId: "Choose a member of this organisation." }) };
    }
    return { ownerId: requested };
  }

  const assignment = await loadAssignment(organizationId);
  if (assignment.mode === "manual") return { ownerId: null };
  if (assignment.mode === "fixed") {
    if (assignment.fixedOwnerId && (await canOwnLead(organizationId, assignment.fixedOwnerId))) {
      return { ownerId: assignment.fixedOwnerId };
    }
    return { ownerId: null };
  }

  const { data, error } = await createClient().rpc("next_lead_owner", { p_org: organizationId });
  if (error) return { error: failure("The lead could not be assigned. Please try again.") };
  return { ownerId: data };
}
