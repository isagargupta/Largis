import type { EnquiryStatus, LeadStage, OrgRole, OrgStatus, StaffRole } from "@/lib/supabase/types";

export type Tone = "neutral" | "info" | "brand" | "warning" | "success" | "danger";

export const stageOrder: LeadStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
export const openStages: LeadStage[] = ["new", "qualified", "proposal", "negotiation"];

export const stageMeta: Record<LeadStage, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "neutral" },
  qualified: { label: "Qualified", tone: "info" },
  proposal: { label: "Proposal", tone: "brand" },
  negotiation: { label: "Negotiation", tone: "warning" },
  won: { label: "Closed Won", tone: "success" },
  lost: { label: "Closed Lost", tone: "danger" },
};

export const stageColor: Record<LeadStage, string> = {
  new: "bg-neutral-400",
  qualified: "bg-sky-500",
  proposal: "bg-brand-500",
  negotiation: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-red-400",
};

export const leadSources = ["Inbound", "BPO Chat", "Referral", "Outbound", "Partner"] as const;

export const orgRoles: OrgRole[] = ["owner", "admin", "manager", "agent", "viewer"];

export type RolePermissions = {
  label: string;
  scope: string;
  canViewValue: boolean;
  canEdit: boolean;
  ownOnly: boolean;
  canAssign: boolean;
  canDelete: boolean;
  canManageTeam: boolean;
};

export const rolePermissions: Record<OrgRole, RolePermissions> = {
  owner: {
    label: "Owner",
    scope: "Full organization access",
    canViewValue: true,
    canEdit: true,
    ownOnly: false,
    canAssign: true,
    canDelete: true,
    canManageTeam: true,
  },
  admin: {
    label: "Admin",
    scope: "Full organization access",
    canViewValue: true,
    canEdit: true,
    ownOnly: false,
    canAssign: true,
    canDelete: true,
    canManageTeam: true,
  },
  manager: {
    label: "Manager",
    scope: "Team pipeline · read & write",
    canViewValue: true,
    canEdit: true,
    ownOnly: false,
    canAssign: true,
    canDelete: false,
    canManageTeam: false,
  },
  agent: {
    label: "Agent",
    scope: "Assigned leads only · values masked",
    canViewValue: false,
    canEdit: true,
    ownOnly: true,
    canAssign: false,
    canDelete: false,
    canManageTeam: false,
  },
  viewer: {
    label: "Viewer",
    scope: "Read-only",
    canViewValue: true,
    canEdit: false,
    ownOnly: false,
    canAssign: false,
    canDelete: false,
    canManageTeam: false,
  },
};

/** Largis staff working inside a client's workspace. */
export const staffPermissions: RolePermissions = {
  label: "Largis staff",
  scope: "Full access for client support",
  canViewValue: true,
  canEdit: true,
  ownOnly: false,
  canAssign: true,
  canDelete: true,
  canManageTeam: true,
};

export const staffRoles: StaffRole[] = ["admin", "manager", "agent"];

export const staffRoleLabel: Record<StaffRole, string> = {
  admin: "Admin",
  manager: "Manager",
  agent: "Agent",
};

export const staffRoleScope: Record<StaffRole, string> = {
  admin: "All clients and enquiries, plus the staff team",
  manager: "All clients and enquiries",
  agent: "All clients and enquiries",
};

export const enquiryStatuses: EnquiryStatus[] = ["new", "in_progress", "closed"];

export const enquiryStatusMeta: Record<EnquiryStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "brand" },
  in_progress: { label: "In progress", tone: "warning" },
  closed: { label: "Closed", tone: "neutral" },
};

export const orgStatuses: OrgStatus[] = ["active", "onboarding", "paused"];

export const orgStatusMeta: Record<OrgStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  onboarding: { label: "Onboarding", tone: "info" },
  paused: { label: "Paused", tone: "neutral" },
};

export const planOptions = ["Growth", "Enterprise", "Custom"] as const;
export const regionSuggestions = ["ap-south-1", "ap-southeast-1", "eu-central-1", "eu-west-2", "us-east-1"] as const;
