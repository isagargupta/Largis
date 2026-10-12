"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { displayName } from "@/lib/portal/format";
import { inviteMessage, issueInvitation } from "@/lib/portal/invitations";
import { getOrgAccess, getProfiles, getStaffMember, getUser } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  invitationRevokeSchema,
  inviteMemberSchema,
  memberRemoveSchema,
  memberRoleSchema,
} from "@/lib/validations/portal";

async function orgMembers(organizationId: string) {
  const { data } = await createClient()
    .from("memberships")
    .select("user_id, role")
    .eq("organization_id", organizationId);
  return data ?? [];
}

export async function inviteMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canManageTeam) return failure("Only owners and admins can invite people.");
  if (input.role === "owner" && !access.staff && access.role !== "owner") {
    return failure("Only an owner can invite another owner.", { role: "Choose a role other than Owner." });
  }

  const supabase = createClient();
  const members = await orgMembers(input.organizationId);
  const profiles = await getProfiles(members.map((m) => m.user_id));
  if (Array.from(profiles.values()).some((p) => p.email === input.email)) {
    return failure("That person is already a member.", { email: "Already a member of this organisation." });
  }

  const { data: org } = await supabase.from("organizations").select("name").eq("id", input.organizationId).single();
  const inviter = await getProfiles([access.user.id]);

  const outcome = await issueInvitation(supabase, {
    kind: "client",
    email: input.email,
    fullName: input.fullName,
    organizationId: input.organizationId,
    organizationName: org?.name ?? "your organisation",
    orgRole: input.role,
    inviterName: access.staff ? "The Largis team" : displayName(inviter.get(access.user.id), ""),
  });
  if (!outcome.ok) return failure(outcome.error);

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "invitation.created",
    entity: "invitation",
    entity_id: outcome.id,
    metadata: { label: input.email, role: input.role },
  });

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: inviteMessage(outcome, input.email),
    link: outcome.emailed || outcome.joined ? undefined : outcome.link,
  };
}

export async function changeMemberRole(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberRoleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Choose a valid role.");
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canManageTeam) return failure("Only owners and admins can change roles.");

  const members = await orgMembers(input.organizationId);
  const target = members.find((m) => m.user_id === input.userId);
  if (!target) return failure("That person is no longer a member.");
  if (target.role === input.role) return { status: "success", message: "No change." };

  const ownerOnly = input.role === "owner" || target.role === "owner";
  if (ownerOnly && !access.staff && access.role !== "owner") {
    return failure("Only an owner can grant or change the Owner role.");
  }
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length === 1) {
    return failure("Every organisation needs at least one owner. Make someone else an owner first.");
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role: input.role })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);
  if (error) return failure(friendlyDbError(error));

  const profiles = await getProfiles([input.userId]);
  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "member.role_changed",
    entity: "membership",
    entity_id: input.userId,
    metadata: { label: displayName(profiles.get(input.userId)), role: input.role },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Role updated." };
}

export async function removeMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberRemoveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That member could not be found.");
  const input = parsed.data;

  const access = await getOrgAccess(input.organizationId);
  if (!access?.perms.canManageTeam) return failure("Only owners and admins can remove people.");
  if (input.userId === access.user.id) return failure("You can't remove yourself. Ask another owner or admin.");

  const members = await orgMembers(input.organizationId);
  const target = members.find((m) => m.user_id === input.userId);
  if (!target) return failure("That person is no longer a member.");
  if (target.role === "owner" && !access.staff && access.role !== "owner") {
    return failure("Only an owner can remove another owner.");
  }
  if (target.role === "owner" && members.filter((m) => m.role === "owner").length === 1) {
    return failure("Every organisation needs at least one owner.");
  }

  const supabase = createClient();
  const profiles = await getProfiles([input.userId]);
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "member.removed",
    entity: "membership",
    entity_id: input.userId,
    metadata: { label: displayName(profiles.get(input.userId)) },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Member removed." };
}

export async function revokeInvitation(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = invitationRevokeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That invitation could not be found.");

  const user = await getUser();
  if (!user) return failure("Your session has expired. Sign in again.");

  const supabase = createClient();
  const { data: invite } = await supabase
    .from("invitations")
    .select("id, kind, email, organization_id, accepted_at, revoked_at")
    .eq("id", parsed.data.invitationId)
    .maybeSingle();
  if (!invite || invite.accepted_at || invite.revoked_at) return failure("That invitation is no longer pending.");

  if (invite.kind === "client") {
    const access = await getOrgAccess(invite.organization_id!);
    if (!access?.perms.canManageTeam) return failure("Only owners and admins can revoke invitations.");
  } else {
    const staff = await getStaffMember();
    if (staff?.role !== "admin") return failure("Only staff admins can revoke staff invitations.");
  }

  const { error } = await supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invite.id);
  if (error) return failure(friendlyDbError(error));

  await logActivity(supabase, {
    organization_id: invite.organization_id,
    action: "invitation.revoked",
    entity: "invitation",
    entity_id: invite.id,
    metadata: { label: invite.email },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: "Invitation revoked." };
}
