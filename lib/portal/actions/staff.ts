"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { displayName } from "@/lib/portal/format";
import { inviteMessage, issueInvitation } from "@/lib/portal/invitations";
import { getProfiles, getStaffMember, getUser } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import {
  clientCreateSchema,
  clientUpdateSchema,
  enquiryUpdateSchema,
  fieldErrorsFrom,
  staffInviteSchema,
  staffUpdateSchema,
} from "@/lib/validations/portal";

async function staffContext() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  return user && staff ? { user, staff } : null;
}

export async function updateEnquiry(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (!ctx) return failure("Only Largis staff can update enquiries.");

  const parsed = enquiryUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  if (input.assignedTo) {
    const { data: assignee } = await supabase
      .from("staff_members")
      .select("user_id")
      .eq("user_id", input.assignedTo)
      .eq("active", true)
      .maybeSingle();
    if (!assignee) return failure("Please review the highlighted fields.", { assignedTo: "Choose an active staff member." });
  }

  const { data, error } = await supabase
    .from("contact_submissions")
    .update({ status: input.status, assigned_to: input.assignedTo, internal_notes: input.internalNotes })
    .eq("id", input.id)
    .select("company")
    .maybeSingle();
  if (error) return failure(friendlyDbError(error));
  if (!data) return failure("That enquiry could not be found.");

  await logActivity(supabase, {
    action: "enquiry.updated",
    entity: "enquiry",
    entity_id: input.id,
    metadata: { label: data.company, status: input.status },
  });

  revalidatePath("/staff", "layout");
  return { status: "success", message: "Enquiry updated." };
}

export async function createClientOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (!ctx) return failure("Only Largis staff can add clients.");

  const parsed = clientCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .insert({ name: input.name, slug: input.slug, plan: input.plan, region: input.region, status: "onboarding" })
    .select("id, name")
    .single();
  if (error || !org) {
    if (error?.code === "23505") {
      return failure("Please review the highlighted fields.", { slug: "Another client already uses this identifier." });
    }
    return failure(error ? friendlyDbError(error) : "The client could not be created.");
  }

  await logActivity(supabase, {
    organization_id: org.id,
    action: "organization.created",
    entity: "organization",
    entity_id: org.id,
    metadata: { label: org.name },
  });

  const outcome = await issueInvitation(supabase, {
    kind: "client",
    email: input.ownerEmail,
    fullName: input.ownerName,
    organizationId: org.id,
    organizationName: org.name,
    orgRole: "owner",
    inviterName: "The Largis team",
  });

  if (outcome.ok) {
    await logActivity(supabase, {
      organization_id: org.id,
      action: "invitation.created",
      entity: "invitation",
      entity_id: outcome.id,
      metadata: { label: input.ownerEmail, role: "owner" },
    });
  }

  if (input.enquiryId) {
    await supabase.from("contact_submissions").update({ status: "closed" }).eq("id", input.enquiryId);
  }

  revalidatePath("/staff", "layout");
  return {
    status: "success",
    id: org.id,
    message: outcome.ok
      ? `${org.name} created. ${inviteMessage(outcome, input.ownerEmail)}`
      : `${org.name} created, but the owner invitation failed: ${outcome.error} Invite them from the client page.`,
    link: outcome.ok && !outcome.emailed && !outcome.joined ? outcome.link : undefined,
  };
}

export async function updateClientOrganization(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (!ctx) return failure("Only Largis staff can edit clients.");

  const parsed = clientUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const { id, ...input } = parsed.data;

  const supabase = createClient();
  const { error } = await supabase.from("organizations").update(input).eq("id", id);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: id,
    action: "organization.updated",
    entity: "organization",
    entity_id: id,
    metadata: { label: input.name, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Client details saved." };
}

export async function inviteStaff(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (ctx?.staff.role !== "admin") return failure("Only staff admins can invite employees.");

  const parsed = staffInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data: staffRows } = await supabase.from("staff_members").select("user_id").eq("active", true);
  const profiles = await getProfiles((staffRows ?? []).map((s) => s.user_id));
  if (Array.from(profiles.values()).some((p) => p.email === input.email)) {
    return failure("That person is already on the team.", { email: "Already an active staff member." });
  }

  const inviter = await getProfiles([ctx.user.id]);
  const outcome = await issueInvitation(supabase, {
    kind: "staff",
    email: input.email,
    fullName: input.fullName,
    staffRole: input.role,
    title: input.title,
    inviterName: displayName(inviter.get(ctx.user.id), "") || null,
  });
  if (!outcome.ok) return failure(outcome.error);

  await logActivity(supabase, {
    action: "invitation.created",
    entity: "invitation",
    entity_id: outcome.id,
    metadata: { label: input.email, role: input.role, kind: "staff" },
  });

  revalidatePath("/staff", "layout");
  return {
    status: "success",
    message: inviteMessage(outcome, input.email),
    link: outcome.emailed || outcome.joined ? undefined : outcome.link,
  };
}

export async function updateStaffMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await staffContext();
  if (ctx?.staff.role !== "admin") return failure("Only staff admins can change the team.");

  const parsed = staffUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;
  if (input.userId === ctx.user.id && !input.active) return failure("You can't deactivate your own account.");

  const supabase = createClient();
  const { data: admins } = await supabase.from("staff_members").select("user_id").eq("role", "admin").eq("active", true);
  const losingAdmin = !input.active || input.role !== "admin";
  const otherAdmins = (admins ?? []).filter((a) => a.user_id !== input.userId).length;
  if (losingAdmin && otherAdmins === 0 && (admins ?? []).some((a) => a.user_id === input.userId)) {
    return failure("Keep at least one active staff admin.");
  }

  const { error } = await supabase
    .from("staff_members")
    .update({ role: input.role, title: input.title, active: input.active })
    .eq("user_id", input.userId);
  if (error) return failure(friendlyDbError(error));

  const profiles = await getProfiles([input.userId]);
  await logActivity(supabase, {
    action: "staff.updated",
    entity: "staff_member",
    entity_id: input.userId,
    metadata: { label: displayName(profiles.get(input.userId)), role: input.role, active: input.active },
  });

  revalidatePath("/staff", "layout");
  return { status: "success", message: input.active ? "Staff member updated." : "Staff member deactivated." };
}
