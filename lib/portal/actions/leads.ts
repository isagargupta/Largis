"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { fieldErrorsFrom, leadSchema, leadUpdateSchema } from "@/lib/validations/portal";

async function isMember(organizationId: string, userId: string) {
  const { data } = await createClient()
    .from("memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to add leads here.");

  const ownerId = access.perms.canAssign ? input.ownerId : access.user.id;
  if (ownerId && !(await isMember(input.organizationId, ownerId))) {
    return failure("Please review the highlighted fields.", { ownerId: "Choose a member of this organisation." });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      organization_id: input.organizationId,
      company: input.company,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      stage: input.stage,
      value_cents: access.perms.canViewValue ? input.value ?? 0 : 0,
      owner_id: ownerId,
      source: input.source,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error || !data) return failure(error ? friendlyDbError(error) : "The lead could not be saved.");

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "lead.created",
    entity: "lead",
    entity_id: data.id,
    metadata: { label: input.company, stage: input.stage },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${input.company} added.`, id: data.id };
}

export async function updateLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to edit leads here.");

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("id, stage, owner_id")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!existing) return failure("That lead no longer exists or isn't assigned to you.");
  if (access.perms.ownOnly && existing.owner_id !== access.user.id) {
    return failure("You can only edit leads assigned to you.");
  }

  const patch: Database["public"]["Tables"]["leads"]["Update"] = {
    company: input.company,
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    stage: input.stage,
    source: input.source,
    notes: input.notes,
  };
  if (access.perms.canViewValue && input.value !== null) patch.value_cents = input.value;
  if (access.perms.canAssign && input.ownerId !== existing.owner_id) {
    if (input.ownerId && !(await isMember(input.organizationId, input.ownerId))) {
      return failure("Please review the highlighted fields.", { ownerId: "Choose a member of this organisation." });
    }
    patch.owner_id = input.ownerId;
  }

  const { error } = await supabase
    .from("leads")
    .update(patch)
    .eq("id", input.id)
    .eq("organization_id", input.organizationId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "lead.updated",
    entity: "lead",
    entity_id: input.id,
    metadata: { label: input.company, ...(existing.stage !== input.stage ? { stage: input.stage } : {}) },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Changes saved." };
}

export async function deleteLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const parsed = leadUpdateSchema.pick({ id: true, organizationId: true }).safeParse({ id, organizationId });
  if (!parsed.success) return failure("That lead could not be found.");

  const access = await getOrgAccess(organizationId);
  if (!access?.perms.canDelete) return failure("Only owners and admins can delete leads.");

  const supabase = createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("company")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!lead) return failure("That lead no longer exists.");

  const { error } = await supabase.from("leads").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "lead.deleted",
    entity: "lead",
    entity_id: id,
    metadata: { label: lead.company },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${lead.company} deleted.` };
}
