import type {
  AuditAction,
  BillingCycle,
  ContractStatus,
  Currency,
  EngagementStatus,
  InvoiceStatus,
  EnquiryStatus,
  LeadStage,
  MilestoneStatus,
  OrgRole,
  OrgStatus,
  ReportStatus,
  ServiceLine,
  StaffRole,
  TicketChannel,
  TicketPriority,
  TicketStatus,
} from "@/lib/supabase/types";

export type Tone = "neutral" | "info" | "brand" | "warning" | "success" | "danger";

/** Marketing preview order. The portal uses each organisation's pipeline labels instead. */
export const stageOrder: LeadStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
export const openStages: LeadStage[] = ["new", "contacted", "qualified", "proposal", "negotiation"];

export const stageMeta: Record<LeadStage, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "neutral" },
  contacted: { label: "Contacted", tone: "info" },
  qualified: { label: "Qualified", tone: "info" },
  proposal: { label: "Proposal", tone: "brand" },
  negotiation: { label: "Negotiation", tone: "warning" },
  won: { label: "Closed Won", tone: "success" },
  lost: { label: "Closed Lost", tone: "danger" },
};

export const stageColor: Record<LeadStage, string> = {
  new: "bg-neutral-400",
  contacted: "bg-cyan-500",
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
  canViewBilling: boolean;
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
    canViewBilling: true,
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
    canViewBilling: true,
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
    canViewBilling: true,
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
    canViewBilling: false,
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
    canViewBilling: false,
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
  canViewBilling: true,
};

export const staffRoles: StaffRole[] = ["admin", "manager", "agent"];

export const staffRoleLabel: Record<StaffRole, string> = {
  admin: "Admin",
  manager: "Manager",
  agent: "Agent",
};

export const staffRoleScope: Record<StaffRole, string> = {
  admin: "All clients, support, delivery, billing, and enquiries, plus the staff team, onboarding, and audit log",
  manager: "All clients, support, delivery, billing, enquiries, and onboarding",
  agent: "All clients, support, delivery, billing, and enquiries",
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

export const ticketStatuses: TicketStatus[] = ["open", "pending_client", "in_progress", "resolved", "closed"];
export const activeTicketStatuses: TicketStatus[] = ["open", "pending_client", "in_progress"];

export const ticketStatusMeta: Record<TicketStatus, { label: string; clientLabel: string; tone: Tone }> = {
  open: { label: "Open", clientLabel: "Open", tone: "brand" },
  pending_client: { label: "Awaiting client", clientLabel: "Awaiting your reply", tone: "warning" },
  in_progress: { label: "In progress", clientLabel: "In progress", tone: "info" },
  resolved: { label: "Resolved", clientLabel: "Resolved", tone: "success" },
  closed: { label: "Closed", clientLabel: "Closed", tone: "neutral" },
};

export const ticketPriorities: TicketPriority[] = ["urgent", "high", "normal", "low"];

export const ticketPriorityMeta: Record<TicketPriority, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warning" },
  normal: { label: "Normal", tone: "neutral" },
  low: { label: "Low", tone: "neutral" },
};

export const ticketChannels: TicketChannel[] = ["portal", "email", "chat", "phone"];

export const ticketChannelLabel: Record<TicketChannel, string> = {
  portal: "Client portal",
  email: "Email",
  chat: "Chat",
  phone: "Phone",
};

/** Mirrors the global defaults in public.sla_targets() (minutes). */
export const defaultSla: Record<TicketPriority, { firstResponse: number; resolution: number }> = {
  urgent: { firstResponse: 15, resolution: 240 },
  high: { firstResponse: 60, resolution: 480 },
  normal: { firstResponse: 240, resolution: 1440 },
  low: { firstResponse: 480, resolution: 2880 },
};

export const engagementStatuses: EngagementStatus[] = ["planning", "active", "on_hold", "completed"];

export const engagementStatusMeta: Record<EngagementStatus, { label: string; tone: Tone }> = {
  planning: { label: "Planning", tone: "info" },
  active: { label: "Active", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "neutral" },
};

export const serviceLines: ServiceLine[] = ["backend", "support", "software", "other"];

export const serviceLineLabel: Record<ServiceLine, string> = {
  backend: "Backend & wholesale systems",
  support: "Customer support operations",
  software: "Software Suite",
  other: "Other",
};

export const milestoneStatuses: MilestoneStatus[] = ["pending", "in_progress", "blocked", "done"];

export const milestoneStatusMeta: Record<MilestoneStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  blocked: { label: "Blocked", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

export const reportStatusMeta: Record<ReportStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
};

export const contractStatuses: ContractStatus[] = ["draft", "active", "expired", "terminated"];

export const contractStatusMeta: Record<ContractStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "warning" },
  terminated: { label: "Terminated", tone: "danger" },
};

export const billingCycles: BillingCycle[] = ["monthly", "quarterly", "annual", "one_time"];

export const billingCycleLabel: Record<BillingCycle, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  one_time: "One-time",
};

export const currencies: Currency[] = ["INR", "USD", "EUR", "GBP"];

export const invoiceStatuses: InvoiceStatus[] = ["draft", "issued", "overdue", "paid", "void"];

export const invoiceStatusMeta: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  issued: { label: "Issued", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  paid: { label: "Paid", tone: "success" },
  void: { label: "Void", tone: "neutral" },
};

/** Tables with audit triggers (0007_hardening.sql), labelled for the audit log. */
export const auditedTables = {
  organizations: "Clients",
  memberships: "Client members",
  invitations: "Invitations",
  staff_members: "Staff",
  leads: "Leads",
  support_tickets: "Support tickets",
  engagements: "Engagements",
  reports: "Reports",
  contracts: "Contracts",
  invoices: "Invoices",
  security_settings: "Security settings",
} as const;

export type AuditedTable = keyof typeof auditedTables;

export const auditActionMeta: Record<AuditAction, { label: string; tone: Tone }> = {
  insert: { label: "Created", tone: "success" },
  update: { label: "Updated", tone: "info" },
  delete: { label: "Deleted", tone: "danger" },
};

/** Standard Indian GST on services, in basis points. */
export const defaultTaxRateBps = 1800;

export const planOptions = ["Growth", "Enterprise", "Custom"] as const;
export const regionSuggestions = ["ap-south-1", "ap-southeast-1", "eu-central-1", "eu-west-2", "us-east-1"] as const;
