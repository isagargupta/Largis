"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { leadTitle } from "@/lib/revenue/stages";
import { canOwnLead } from "@/lib/revenue/assign";
import { fieldErrorsFrom, taskSchema, taskStatusSchema } from "@/lib/validations/portal";

async function editableLead(organizationId: string, leadId: string) {
  const access = await getOrgAccess(organizationId);
  if (!access?.perms.canEdit) return { error: failure("You don't have permission to change follow-ups here.") };
  const { data: lead } = await createClient()
    .from("leads")
    .select("id, company, contact_name, owner_id")
    .eq("id", leadId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!lead) return { error: failure("That lead no longer exists or isn't assigned to you.") };
  if (access.perms.ownOnly && lead.owner_id !== access.user.id) {
    return { error: failure("You can only change follow-ups on leads assigned to you.") };
  }
  return { access, lead };
}

export async function createTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;
  const loaded = await editableLead(input.organizationId, input.leadId);
  if ("error" in loaded) return loaded.error ?? failure("You don't have permission to change follow-ups here.");

  let ownerId = loaded.access.perms.canAssign ? input.ownerId : loaded.lead.owner_id ?? loaded.access.user.id;
  if (ownerId && !(await canOwnLead(input.organizationId, ownerId))) {
    if (loaded.access.perms.canAssign) {
      return failure("Please review the highlighted fields.", { ownerId: "Choose a member who can own leads." });
    }
    ownerId = (await canOwnLead(input.organizationId, loaded.access.user.id)) ? loaded.access.user.id : null;
  }

  const supabase = createClient();
  const { error } = await supabase.from("lead_tasks").insert({
    organization_id: input.organizationId,
    lead_id: input.leadId,
    title: input.title,
    owner_id: ownerId,
    due_at: input.dueAt,
    created_by: loaded.access.user.id,
  });
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "task.created",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(loaded.lead), task: input.title },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Follow-up added." };
}

export async function setTaskStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That follow-up could not be updated.");
  const input = parsed.data;
  const loaded = await editableLead(input.organizationId, input.leadId);
  if ("error" in loaded) return loaded.error ?? failure("You don't have permission to change follow-ups here.");

  const supabase = createClient();
  const { data: task } = await supabase
    .from("lead_tasks")
    .select("id, title")
    .eq("id", input.id)
    .eq("lead_id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!task) return failure("That follow-up no longer exists.");

  const { error } = await supabase
    .from("lead_tasks")
    .update({ status: input.status })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: input.status === "done" ? "task.completed" : "task.reopened",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(loaded.lead), task: task.title },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: input.status === "done" ? "Follow-up completed." : "Follow-up reopened." };
}

export async function deleteTask(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskStatusSchema.pick({ id: true, organizationId: true, leadId: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That follow-up could not be found.");
  const input = parsed.data;
  const loaded = await editableLead(input.organizationId, input.leadId);
  if ("error" in loaded) return loaded.error ?? failure("You don't have permission to change follow-ups here.");

  const supabase = createClient();
  const { data: task } = await supabase
    .from("lead_tasks")
    .select("title")
    .eq("id", input.id)
    .eq("lead_id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!task) return failure("That follow-up no longer exists.");

  const { error } = await supabase.from("lead_tasks").delete().eq("id", input.id).eq("organization_id", input.organizationId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "task.deleted",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(loaded.lead), task: task.title },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Follow-up removed." };
}
