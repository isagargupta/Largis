"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { getOrgAccess } from "@/lib/portal/session";
import { draftLeadSuggestion } from "@/lib/revenue/ai";
import { findDuplicateLead, loadAssignment, resolveNewOwner } from "@/lib/revenue/assign";
import { parseLeadCsv } from "@/lib/revenue/csv";
import { loadAiUsage, loadPipelineStages } from "@/lib/revenue/data";
import { AI_SUGGESTION_CAP, homeServicePipeline, leadStages, leadTitle, lockedStages, phoneDigits, stageLabel } from "@/lib/revenue/stages";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";
import { assignmentSchema, fieldErrorsFrom, suggestionDecisionSchema, suggestionSchema } from "@/lib/validations/portal";

function canConfigure(access: NonNullable<Awaited<ReturnType<typeof getOrgAccess>>> | null) {
  return Boolean(access?.perms.canManageTeam);
}

export async function savePipeline(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const access = await getOrgAccess(organizationId);
  if (!canConfigure(access)) return failure("Only owners and admins can change the pipeline.");

  const rows = leadStages.map((stage) => ({
    stage,
    label: String(formData.get(`label.${stage}`) ?? "").trim(),
    position: Number(formData.get(`position.${stage}`)),
    hidden: formData.get(`hidden.${stage}`) === "on" && !lockedStages.includes(stage),
  }));

  if (rows.some((row) => row.label.length < 1 || row.label.length > 40)) {
    return failure("Stage labels must be 1–40 characters.");
  }
  const labels = new Set(rows.map((row) => row.label.toLowerCase()));
  if (labels.size !== rows.length) return failure("Each stage needs its own label.");
  if (rows.some((row) => !Number.isInteger(row.position) || row.position < 0 || row.position > 20)) {
    return failure("Positions must be whole numbers from 0 to 20.");
  }
  if (new Set(rows.map((row) => row.position)).size !== rows.length) return failure("Give each stage a different position.");

  const supabase = createClient();
  for (const row of rows) {
    const { error } = await supabase
      .from("organization_pipeline_stages")
      .update({ label: row.label, position: row.position, hidden: row.hidden })
      .eq("organization_id", organizationId)
      .eq("stage", row.stage);
    if (error) return failure(friendlyDbError(error));
  }

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "pipeline.updated",
    entity: "organization",
    entity_id: organizationId,
    metadata: { label: "pipeline" },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Pipeline saved." };
}

export async function applyHomeServicePreset(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const access = await getOrgAccess(organizationId);
  if (!canConfigure(access)) return failure("Only owners and admins can change the pipeline.");

  const supabase = createClient();
  for (const stage of homeServicePipeline) {
    const { error } = await supabase
      .from("organization_pipeline_stages")
      .update({ label: stage.label, position: stage.position, hidden: stage.hidden })
      .eq("organization_id", organizationId)
      .eq("stage", stage.stage);
    if (error) return failure(friendlyDbError(error));
  }

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "pipeline.updated",
    entity: "organization",
    entity_id: organizationId,
    metadata: { label: "home service pipeline" },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Home-service pipeline applied." };
}

export async function saveAssignment(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;
  const access = await getOrgAccess(input.organizationId);
  if (!canConfigure(access)) return failure("Only owners and admins can change assignment.");

  const { error } = await createClient()
    .from("organization_revenue_settings")
    .update({
      assignment_mode: input.mode,
      fixed_owner_id: input.mode === "fixed" ? input.fixedOwnerId : null,
    })
    .eq("organization_id", input.organizationId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(createClient(), {
    organization_id: input.organizationId,
    action: "assignment.updated",
    entity: "organization",
    entity_id: input.organizationId,
    metadata: { label: input.mode.replace("_", " ") },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Assignment saved." };
}

function parseMoney(raw: string | null) {
  if (!raw) return null;
  const value = raw.replace(/[,\s$]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) return undefined;
  return Math.round(Number(value) * 100);
}

function validEmail(value: string | null) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return zEmail(email) ? email : undefined;
}

function zEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function importLeads(_: ActionState, formData: FormData): Promise<ActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const access = await getOrgAccess(organizationId);
  if (!access?.perms.canEdit || access.perms.ownOnly) return failure("Only managers and above can import leads.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return failure("Choose a CSV file.");
  if (file.size > 1_000_000) return failure("That file is too large. Split it and import up to 500 rows at a time.");
  const parsed = parseLeadCsv(await file.text());
  if (parsed.error) return failure(parsed.error);

  const stages = await loadPipelineStages(organizationId);
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("contact_email, phone_digits")
    .eq("organization_id", organizationId)
    .limit(5000);
  const emails = new Set((existing ?? []).map((lead) => lead.contact_email).filter((email): email is string => Boolean(email)));
  const phones = new Set((existing ?? []).map((lead) => lead.phone_digits).filter((phone): phone is string => Boolean(phone && phone.length >= 7)));

  const skipped: string[] = [];
  let imported = 0;
  const assignment = await loadAssignment(organizationId);

  for (const row of parsed.leads) {
    const email = validEmail(row.email);
    if (row.email && !email) {
      skipped.push(`row ${row.row} has an invalid email`);
      continue;
    }
    const company = row.company?.trim() || null;
    const hasCompany = Boolean(company && company.length >= 2);
    if (company && (company.length < 2 || company.length > 160)) {
      skipped.push(`row ${row.row} has a company name that is too short or too long`);
      continue;
    }
    const contactName = row.contactName?.trim() || (hasCompany ? company! : "");
    if (contactName.length < 2 || contactName.length > 120) {
      skipped.push(`row ${row.row} needs a contact name`);
      continue;
    }
    if (!hasCompany && !email && !row.phone) {
      skipped.push(`row ${row.row} needs a company, phone, or email`);
      continue;
    }
    const digits = phoneDigits(row.phone);
    if ((email && emails.has(email)) || (digits && phones.has(digits))) {
      skipped.push(`row ${row.row} matches a lead already in this organisation`);
      continue;
    }
    let stage: LeadStage = "new";
    if (row.stageLabel) {
      const match = stages.find((item) => item.label.toLowerCase() === row.stageLabel!.toLowerCase());
      if (!match) {
        skipped.push(`row ${row.row} uses an unknown stage`);
        continue;
      }
      stage = match.stage;
    }
    const value = parseMoney(row.value);
    if (value === undefined) {
      skipped.push(`row ${row.row} has an invalid value`);
      continue;
    }
    if (
      (row.phone && row.phone.length > 40) ||
      (row.notes && row.notes.length > 5000) ||
      (row.source && row.source.length > 60) ||
      (row.address && row.address.length > 300) ||
      (row.jobType && row.jobType.length > 80)
    ) {
      skipped.push(`row ${row.row} has a field that is too long`);
      continue;
    }

    const owner =
      assignment.mode === "round_robin"
        ? await resolveNewOwner(access, organizationId, null)
        : assignment.mode === "fixed"
          ? await resolveNewOwner(access, organizationId, null)
          : { ownerId: null as string | null };
    if ("error" in owner) {
      skipped.push(`row ${row.row} could not be assigned`);
      continue;
    }

    const { error } = await supabase.from("leads").insert({
      organization_id: organizationId,
      company: hasCompany ? company : null,
      contact_name: contactName,
      contact_email: email,
      phone: row.phone,
      service_address: row.address,
      job_type: row.jobType,
      stage,
      value_cents: access.perms.canViewValue ? value ?? 0 : 0,
      owner_id: owner.ownerId,
      source: row.source,
      notes: row.notes,
    });
    if (error) {
      skipped.push(`row ${row.row} could not be saved`);
      continue;
    }
    imported += 1;
    if (email) emails.add(email);
    if (digits) phones.add(digits);
  }

  if (imported) {
    await logActivity(supabase, {
      organization_id: organizationId,
      action: "leads.imported",
      entity: "organization",
      entity_id: organizationId,
      metadata: { label: `${imported} leads`, skipped: skipped.length },
    });
  }
  revalidatePath("/", "layout");

  const summary = `Imported ${imported} ${imported === 1 ? "lead" : "leads"}.${
    skipped.length ? ` Skipped ${skipped.length}: ${skipped.slice(0, 8).join("; ")}${skipped.length > 8 ? "…" : ""}.` : ""
  }`;
  if (!imported) return failure(summary);
  return { status: "success", message: summary };
}

export async function requestSuggestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = suggestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Choose a suggestion to draft.");
  const input = parsed.data;
  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to draft suggestions here.");

  const supabase = createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, company, contact_name, contact_email, phone, service_address, job_type, stage, source, notes, lost_reason, owner_id")
    .eq("id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!lead) return failure("That lead no longer exists or isn't assigned to you.");
  if (access.perms.ownOnly && lead.owner_id !== access.user.id) {
    return failure("You can only draft suggestions for leads assigned to you.");
  }

  const usage = await loadAiUsage(input.organizationId);
  if (usage.used >= usage.cap) {
    return failure(`This organisation has used its ${AI_SUGGESTION_CAP} suggestions for the month.`);
  }

  const stages = await loadPipelineStages(input.organizationId);
  let draft: Awaited<ReturnType<typeof draftLeadSuggestion>>;
  try {
    draft = await draftLeadSuggestion(input.kind, {
      title: leadTitle(lead),
      contactName: lead.contact_name,
      email: lead.contact_email,
      phone: lead.phone,
      address: lead.service_address,
      jobType: lead.job_type,
      stage: stageLabel(stages, lead.stage),
      source: lead.source,
      notes: lead.notes,
      lostReason: lead.lost_reason,
    });
  } catch {
    return failure("The assistant could not draft that. Please try again.");
  }
  if ("error" in draft) return failure(draft.error ?? "The assistant didn't return a usable draft.");

  const { data: consumed, error: consumeError } = await supabase.rpc("consume_ai_suggestion", { p_org: input.organizationId });
  if (consumeError) return failure("The suggestion could not be saved.");
  if (!consumed) return failure(`This organisation has used its ${AI_SUGGESTION_CAP} suggestions for the month.`);

  const { error } = await supabase.from("lead_suggestions").insert({
    organization_id: input.organizationId,
    lead_id: input.leadId,
    kind: input.kind,
    body: draft.body,
  });
  if (error) {
    await supabase.rpc("release_ai_suggestion", { p_org: input.organizationId });
    return failure(friendlyDbError(error));
  }

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "suggestion.created",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(lead), kind: input.kind },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Draft ready for approval." };
}

export async function approveSuggestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = suggestionDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That suggestion could not be found.");
  const input = parsed.data;
  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to approve suggestions here.");

  const supabase = createClient();
  const { data: suggestion } = await supabase
    .from("lead_suggestions")
    .select("id, status, kind, lead_id")
    .eq("id", input.id)
    .eq("lead_id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!suggestion) return failure("That suggestion no longer exists.");
  if (suggestion.status === "approved") return { status: "success", message: "Already approved. Nothing new was created." };
  if (suggestion.status === "dismissed") return failure("That suggestion has already been dismissed.");

  const { data: lead } = await supabase
    .from("leads")
    .select("company, contact_name, owner_id")
    .eq("id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!lead) return failure("That lead no longer exists.");
  if (access.perms.ownOnly && lead.owner_id !== access.user.id) {
    return failure("You can only approve suggestions for leads assigned to you.");
  }

  const { error } = await supabase.rpc("approve_lead_suggestion", { p_id: input.id });
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "suggestion.approved",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(lead), kind: suggestion.kind },
  });
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: suggestion.kind === "next_action" ? "Next action approved and added as a follow-up." : "Draft saved on this lead. Nothing was sent.",
  };
}

export async function dismissSuggestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = suggestionDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That suggestion could not be found.");
  const input = parsed.data;
  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to dismiss suggestions here.");

  const supabase = createClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("company, contact_name, owner_id")
    .eq("id", input.leadId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!lead) return failure("That lead no longer exists.");
  if (access.perms.ownOnly && lead.owner_id !== access.user.id) {
    return failure("You can only dismiss suggestions for leads assigned to you.");
  }

  const { data, error } = await supabase.rpc("dismiss_lead_suggestion", { p_id: input.id });
  if (error) return failure(friendlyDbError(error));
  if (!data) return failure("That suggestion has already been decided.");

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "suggestion.dismissed",
    entity: "lead",
    entity_id: input.leadId,
    metadata: { label: leadTitle(lead) },
  });
  revalidatePath("/", "layout");
  return { status: "success", message: "Suggestion dismissed." };
}
