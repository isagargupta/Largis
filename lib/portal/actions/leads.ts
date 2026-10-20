"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { duplicateLeadState, findDuplicateLead, resolveNewOwner, canOwnLead } from "@/lib/revenue/assign";
import { leadTitle, stageLabel } from "@/lib/revenue/stages";
import { loadPipelineStages } from "@/lib/revenue/data";
import { fieldErrorsFrom, leadSchema, leadUpdateSchema } from "@/lib/validations/portal";
import { z } from "zod";

const leadKeySchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
});

async function stageName(organizationId: string, stage: Database["public"]["Tables"]["leads"]["Insert"]["stage"]) {
  if (!stage) return undefined;
  const stages = await loadPipelineStages(organizationId);
  return stageLabel(stages, stage);
}

export async function createLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to add leads here.");

  const duplicate = await findDuplicateLead(input.organizationId, input.contactEmail, input.phone);
  if (duplicate) return duplicateLeadState(duplicate);

  const owner = await resolveNewOwner(access, input.organizationId, input.ownerId);
  if ("error" in owner) return owner.error;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      organization_id: input.organizationId,
      company: input.company,
      contact_name: input.contactName,
      contact_email: input.contactEmail,
      phone: input.phone,
      service_address: input.serviceAddress,
      job_type: input.jobType,
      lost_reason: input.lostReason,
      stage: input.stage,
      value_cents: access.perms.canViewValue ? input.value ?? 0 : 0,
      owner_id: owner.ownerId,
      source: input.source,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error || !data) return failure(error ? friendlyDbError(error) : "The lead could not be saved.");

  const title = leadTitle({ company: input.company, contact_name: input.contactName });
  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "lead.created",
    entity: "lead",
    entity_id: data.id,
    metadata: { label: title, stage: input.stage, stageLabel: await stageName(input.organizationId, input.stage) },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${title} added.`, id: data.id };
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

  const duplicate = await findDuplicateLead(input.organizationId, input.contactEmail, input.phone, input.id);
  if (duplicate) return duplicateLeadState(duplicate);

  const patch: Database["public"]["Tables"]["leads"]["Update"] = {
    company: input.company,
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    phone: input.phone,
    service_address: input.serviceAddress,
    job_type: input.jobType,
    lost_reason: input.lostReason,
    stage: input.stage,
    source: input.source,
    notes: input.notes,
  };
  if (access.perms.canViewValue && input.value !== null) patch.value_cents = input.value;
  if (access.perms.canAssign && input.ownerId !== existing.owner_id) {
    if (input.ownerId && !(await canOwnLead(input.organizationId, input.ownerId))) {
      return failure("Please review the highlighted fields.", { ownerId: "Choose a member who can own leads." });
    }
    patch.owner_id = input.ownerId;
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", input.id).eq("organization_id", input.organizationId);
  if (error) return failure(friendlyDbError(error));

  const title = leadTitle({ company: input.company, contact_name: input.contactName });
  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "lead.updated",
    entity: "lead",
    entity_id: input.id,
    metadata: {
      label: title,
      ...(existing.stage !== input.stage
        ? { stage: input.stage, stageLabel: await stageName(input.organizationId, input.stage) }
        : {}),
    },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Changes saved." };
}

export async function deleteLead(_: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const organizationId = String(formData.get("organizationId") ?? "");
  const parsed = leadKeySchema.safeParse({ id, organizationId });
  if (!parsed.success) return failure("That lead could not be found.");

  const access = await getOrgAccess(organizationId);
  if (!access?.perms.canDelete) return failure("Only owners and admins can delete leads.");

  const supabase = createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("company, contact_name")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!lead) return failure("That lead no longer exists.");

  const { error } = await supabase.from("leads").delete().eq("id", id).eq("organization_id", organizationId);
  if (error) return failure(friendlyDbError(error));

  const title = leadTitle(lead);
  await logActivity(supabase, {
    organization_id: organizationId,
    action: "lead.deleted",
    entity: "lead",
    entity_id: id,
    metadata: { label: title },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${title} deleted.` };
}
