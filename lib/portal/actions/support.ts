"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { ticketReplyEmail } from "@/lib/emails/notifications";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { displayName } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { ticketPriorities } from "@/lib/portal/meta";
import { getOrgAccess, getProfiles, getStaffMember, getUser, requestHost } from "@/lib/portal/session";
import { isClosedStatus } from "@/lib/portal/sla";
import { sendPushToUsers } from "@/lib/push";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  fieldErrorsFrom,
  slaPolicySchema,
  ticketClientStatusSchema,
  ticketCreateSchema,
  ticketReplySchema,
  ticketUpdateSchema,
} from "@/lib/validations/portal";

type TicketInsert = Database["public"]["Tables"]["support_tickets"]["Insert"];

async function staffContext() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  return user && staff ? { user, staff } : null;
}

async function loadTicket(id: string) {
  const { data } = await createClient()
    .from("support_tickets")
    .select("id, organization_id, reference, subject, status, priority, assigned_to, created_by, requester_name, requester_email")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function createTicket(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ticketCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canEdit) return failure("You don't have permission to open tickets for this organisation.");

  let row: TicketInsert = {
    organization_id: input.organizationId,
    subject: input.subject,
    description: input.description,
    priority: input.priority,
  };
  if (access.staff) {
    row = {
      ...row,
      channel: input.channel,
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      assigned_to: input.assignedTo,
    };
  } else {
    const profile = (await getProfiles([access.user.id])).get(access.user.id);
    row = {
      ...row,
      requester_name: profile?.full_name ?? null,
      requester_email: profile?.email ?? access.user.email ?? null,
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.from("support_tickets").insert(row).select("id, reference").single();
  if (error || !data) return failure(error ? friendlyDbError(error) : "The ticket could not be opened.");

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "ticket.created",
    entity: "ticket",
    entity_id: data.id,
    metadata: { label: data.reference, subject: input.subject, priority: input.priority },
  });
  if (access.staff && input.assignedTo) {
    const assignee = await getProfiles([input.assignedTo]);
    await logActivity(supabase, {
      organization_id: input.organizationId,
      action: "ticket.assigned",
      entity: "ticket",
      entity_id: data.id,
      metadata: { label: data.reference, assignee: displayName(assignee.get(input.assignedTo)) },
    });
  }

  revalidatePath("/", "layout");
  redirect(portalHref(access.staff ? `/staff/support/${data.id}` : `/app/support/${data.id}`));
}

export async function replyToTicket(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ticketReplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const ticket = await loadTicket(input.ticketId);
  if (!ticket) return failure("That ticket could not be found.");
  const access = await getOrgAccess(ticket.organization_id);
  if (!access?.perms.canEdit) return failure("You don't have permission to reply to this ticket.");
  if (input.internal && !access.staff) return failure("Internal notes are for Largis staff only.");

  const supabase = createClient();
  const { error } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticket.id, body: input.body, internal: input.internal });
  if (error) return failure(friendlyDbError(error));

  if (access.staff && input.nextStatus && input.nextStatus !== ticket.status) {
    const { error: statusError } = await supabase
      .from("support_tickets")
      .update({ status: input.nextStatus })
      .eq("id", ticket.id);
    if (!statusError) {
      await logActivity(supabase, {
        organization_id: ticket.organization_id,
        action: "ticket.status_changed",
        entity: "ticket",
        entity_id: ticket.id,
        metadata: { label: ticket.reference, status: input.nextStatus },
      });
    }
  } else if (!access.staff && isClosedStatus(ticket.status)) {
    await logActivity(supabase, {
      organization_id: ticket.organization_id,
      action: "ticket.status_changed",
      entity: "ticket",
      entity_id: ticket.id,
      metadata: { label: ticket.reference, status: "open" },
    });
  }

  let emailed = false;
  if (access.staff && !input.internal && ticket.requester_email && isEmailConfigured() && hasVerifiedSender()) {
    try {
      const agent = (await getProfiles([access.user.id])).get(access.user.id);
      await sendEmail({
        to: ticket.requester_email,
        replyTo: siteConfig.email,
        ...ticketReplyEmail({
          reference: ticket.reference,
          subject: ticket.subject,
          body: input.body,
          recipientName: ticket.requester_name,
          agentName: agent?.full_name ?? null,
          link: portalUrl("app", `/app/support/${ticket.id}`, requestHost()),
        }),
      });
      emailed = true;
    } catch (err) {
      console.error("[support] Reply email failed", err);
    }
  }
  if (access.staff && !input.internal) {
    await sendPushToUsers([ticket.created_by], {
      title: `Reply on ${ticket.reference}`,
      body: input.body,
      data: { screen: "ticket", id: ticket.id, organizationId: ticket.organization_id },
    });
  }

  revalidatePath("/", "layout");
  if (input.internal) return { status: "success", message: "Internal note added." };
  return { status: "success", message: emailed ? `Reply sent and emailed to ${ticket.requester_email}.` : "Reply sent." };
}

export async function updateTicket(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (!ctx) return failure("Only Largis staff can change ticket details.");

  const parsed = ticketUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const ticket = await loadTicket(input.id);
  if (!ticket) return failure("That ticket could not be found.");

  const supabase = createClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ status: input.status, priority: input.priority, assigned_to: input.assignedTo })
    .eq("id", ticket.id);
  if (error) {
    if (error.code === "P0001") return failure("Please review the highlighted fields.", { assignedTo: error.message });
    return failure(friendlyDbError(error));
  }

  const base = { organization_id: ticket.organization_id, entity: "ticket", entity_id: ticket.id };
  if (input.status !== ticket.status) {
    await logActivity(supabase, {
      ...base,
      action: "ticket.status_changed",
      metadata: { label: ticket.reference, status: input.status },
    });
  }
  if (input.priority !== ticket.priority) {
    await logActivity(supabase, {
      ...base,
      action: "ticket.priority_changed",
      metadata: { label: ticket.reference, priority: input.priority },
    });
  }
  if (input.assignedTo !== ticket.assigned_to) {
    const assignee = input.assignedTo ? (await getProfiles([input.assignedTo])).get(input.assignedTo) : null;
    await logActivity(supabase, {
      ...base,
      action: "ticket.assigned",
      metadata: { label: ticket.reference, assignee: input.assignedTo ? displayName(assignee) : "" },
    });
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Ticket updated." };
}

/** Client-side resolve and reopen; the database limits which transitions clients may make. */
export async function setTicketStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = ticketClientStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That change isn't available.");
  const input = parsed.data;

  const ticket = await loadTicket(input.id);
  if (!ticket) return failure("That ticket could not be found.");
  const access = await getOrgAccess(ticket.organization_id);
  if (!access?.perms.canEdit) return failure("You don't have permission to change this ticket.");

  const supabase = createClient();
  const { error } = await supabase.from("support_tickets").update({ status: input.status }).eq("id", ticket.id);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: ticket.organization_id,
    action: "ticket.status_changed",
    entity: "ticket",
    entity_id: ticket.id,
    metadata: { label: ticket.reference, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: input.status === "resolved" ? "Marked as resolved." : "Ticket reopened." };
}

export async function saveSlaPolicy(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (!ctx) return failure("Only Largis staff can change SLA targets.");

  const parsed = slaPolicySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const rows = ticketPriorities.map((priority) => ({
    organization_id: input.organizationId,
    priority,
    first_response_minutes: input[`${priority}FirstResponse`],
    resolution_minutes: input[`${priority}Resolution`],
  }));
  const overrides = rows.filter((r) => r.first_response_minutes !== null || r.resolution_minutes !== null);
  const cleared = rows.filter((r) => r.first_response_minutes === null && r.resolution_minutes === null).map((r) => r.priority);

  const supabase = createClient();
  if (overrides.length) {
    const { error } = await supabase.from("sla_policies").upsert(overrides, { onConflict: "organization_id,priority" });
    if (error) return failure(friendlyDbError(error));
  }
  if (cleared.length) {
    const { error } = await supabase
      .from("sla_policies")
      .delete()
      .eq("organization_id", input.organizationId)
      .in("priority", cleared);
    if (error) return failure(friendlyDbError(error));
  }

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "sla_policy.updated",
    entity: "sla_policy",
    metadata: { overrides: overrides.length },
  });

  revalidatePath("/staff", "layout");
  return { status: "success", message: "SLA targets saved. They apply to tickets opened from now on." };
}
