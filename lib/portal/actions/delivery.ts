"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { reportPublishedEmail } from "@/lib/emails/notifications";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { formatPeriod } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { getProfiles, getStaffMember, getUser, requestHost } from "@/lib/portal/session";
import { orgMemberIds, sendPushToUsers } from "@/lib/push";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import {
  engagementSchema,
  fieldErrorsFrom,
  milestoneSchema,
  milestoneStatusSchema,
  recordRefSchema,
  reportCreateSchema,
  reportSaveSchema,
} from "@/lib/validations/portal";

async function staffContext() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  return user && staff ? { user, staff } : null;
}

function dbFailure(error: { code?: string; message: string }) {
  return failure(friendlyDbError(error));
}

const notStaff = () => failure("Only Largis staff can manage delivery.");

export async function saveEngagement(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();

  const parsed = engagementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const { id, organizationId, ...input } = parsed.data;

  const fields = {
    name: input.name,
    service_line: input.serviceLine,
    status: input.status,
    start_date: input.startDate,
    end_date: input.endDate,
    owner_staff_id: input.ownerStaffId,
    summary: input.summary,
  };

  const supabase = createClient();
  const result = id
    ? await supabase.from("engagements").update(fields).eq("id", id).eq("organization_id", organizationId).select("id").maybeSingle()
    : await supabase
        .from("engagements")
        .insert({ ...fields, organization_id: organizationId })
        .select("id")
        .single();
  if (result.error) {
    if (result.error.code === "P0001") return failure("Please review the highlighted fields.", { ownerStaffId: result.error.message });
    return dbFailure(result.error);
  }
  if (!result.data) return failure("That engagement could not be found.");

  await logActivity(supabase, {
    organization_id: organizationId,
    action: id ? "engagement.updated" : "engagement.created",
    entity: "engagement",
    entity_id: result.data.id,
    metadata: { label: input.name, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: id ? "Engagement saved." : `${input.name} added.`, id: result.data.id };
}

export async function deleteEngagement(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That engagement could not be found.");
  const { id, organizationId } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("engagements")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("name")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("That engagement could not be found.");

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "engagement.deleted",
    entity: "engagement",
    entity_id: id,
    metadata: { label: data.name },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${data.name} removed.` };
}

export async function saveMilestone(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();

  const parsed = milestoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  let previous: { status: string } | null = null;
  let sortOrder = input.sortOrder;

  if (input.id) {
    const { data } = await supabase
      .from("milestones")
      .select("status")
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .maybeSingle();
    if (!data) return failure("That milestone could not be found.");
    previous = data;
  } else if (sortOrder === null) {
    const { data } = await supabase
      .from("milestones")
      .select("sort_order")
      .eq("engagement_id", input.engagementId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (data?.sort_order ?? -1) + 1;
  }

  const fields = {
    title: input.title,
    due_date: input.dueDate,
    status: input.status,
    ...(sortOrder !== null ? { sort_order: sortOrder } : {}),
  };
  const result = input.id
    ? await supabase.from("milestones").update(fields).eq("id", input.id).select("id").single()
    : await supabase
        .from("milestones")
        .insert({ ...fields, engagement_id: input.engagementId })
        .select("id")
        .single();
  if (result.error || !result.data) return result.error ? dbFailure(result.error) : failure("The milestone could not be saved.");

  const completed = input.status === "done" && previous?.status !== "done";
  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: completed ? "milestone.completed" : input.id ? "milestone.updated" : "milestone.created",
    entity: "milestone",
    entity_id: result.data.id,
    metadata: { label: input.title, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: input.id ? "Milestone saved." : `${input.title} added.` };
}

export async function setMilestoneStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = milestoneStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That change isn't available.");
  const input = parsed.data;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("milestones")
    .select("title, status")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!existing) return failure("That milestone could not be found.");
  if (existing.status === input.status) return { status: "idle" };

  const { error } = await supabase.from("milestones").update({ status: input.status }).eq("id", input.id);
  if (error) return dbFailure(error);

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: input.status === "done" ? "milestone.completed" : "milestone.updated",
    entity: "milestone",
    entity_id: input.id,
    metadata: { label: existing.title, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: input.status === "done" ? `${existing.title} completed.` : "Milestone updated." };
}

export async function deleteMilestone(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That milestone could not be found.");
  const { id, organizationId } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("title")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("That milestone could not be found.");

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "milestone.deleted",
    entity: "milestone",
    entity_id: id,
    metadata: { label: data.title },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${data.title} removed.` };
}

export async function createReport(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();

  const parsed = reportCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      engagement_id: input.engagementId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error?.code === "P0001") return failure("Please review the highlighted fields.", { engagementId: error.message });
    return error ? dbFailure(error) : failure("The report could not be created.");
  }

  revalidatePath("/staff", "layout");
  redirect(portalHref(`/staff/clients/${input.organizationId}/reports/${data.id}`));
}

export async function saveReport(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();

  const parsed = reportSaveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("reports")
    .select("status")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!existing) return failure("That report could not be found.");

  if (input.intent === "publish" && !input.body.trim()) {
    return failure("Add the report body before publishing.", { body: "Write the report before publishing it." });
  }

  const status = input.intent === "publish" ? "published" : input.intent === "unpublish" ? "draft" : existing.status;
  const { error } = await supabase
    .from("reports")
    .update({
      title: input.title,
      engagement_id: input.engagementId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      summary: input.summary,
      body: input.body,
      status,
    })
    .eq("id", input.id);
  if (error) {
    if (error.code === "P0001") return failure("Please review the highlighted fields.", { engagementId: error.message });
    return dbFailure(error);
  }

  let message = existing.status === "published" ? "Changes published." : "Draft saved.";
  if (status !== existing.status) {
    await logActivity(supabase, {
      organization_id: input.organizationId,
      action: status === "published" ? "report.published" : "report.unpublished",
      entity: "report",
      entity_id: input.id,
      metadata: { label: input.title },
    });
    if (status === "published") {
      const sent = await notifyReportPublished(input.organizationId, {
        id: input.id,
        title: input.title,
        summary: input.summary,
        period: formatPeriod(input.periodStart, input.periodEnd),
      });
      message = sent ? `Report published. ${sent} client ${sent === 1 ? "contact was" : "contacts were"} emailed.` : "Report published.";
    } else {
      message = "Report moved back to draft. Clients can no longer see it.";
    }
  }

  revalidatePath("/", "layout");
  return { status: "success", message };
}

export async function deleteReport(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That report could not be found.");
  const { id, organizationId } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("Only draft reports can be deleted. Unpublish it first.");

  revalidatePath("/staff", "layout");
  redirect(`${portalHref(`/staff/clients/${organizationId}`)}?tab=reports`);
}

/** Emails client owners and admins; delivery problems never block publishing. */
async function notifyReportPublished(
  organizationId: string,
  report: { id: string; title: string; summary: string | null; period: string | null },
) {
  const supabase = createClient();
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.from("memberships").select("user_id").eq("organization_id", organizationId).in("role", ["owner", "admin"]),
  ]);
  await sendPushToUsers(await orgMemberIds(organizationId), {
    title: "New report",
    body: report.title,
    data: { screen: "report", id: report.id, organizationId },
  });
  if (!isEmailConfigured() || !hasVerifiedSender()) return 0;

  const profiles = await getProfiles((members ?? []).map((m) => m.user_id));
  const link = portalUrl("app", `/app/reports/${report.id}`, requestHost());

  let sent = 0;
  for (const profile of Array.from(profiles.values())) {
    if (!profile.email) continue;
    try {
      await sendEmail({
        to: profile.email,
        replyTo: siteConfig.email,
        ...reportPublishedEmail({
          title: report.title,
          organizationName: org?.name ?? "your organisation",
          period: report.period,
          summary: report.summary,
          recipientName: profile.full_name,
          link,
        }),
      });
      sent++;
    } catch (err) {
      console.error("[reports] Publish email failed", err);
    }
  }
  return sent;
}
