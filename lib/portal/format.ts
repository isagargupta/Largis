import {
  engagementStatusMeta,
  rolePermissions,
  stageMeta,
  staffRoleLabel,
  ticketPriorityMeta,
  ticketStatusMeta,
} from "@/lib/portal/meta";
import type { EngagementStatus, LeadStage, OrgRole, StaffRole, TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type Profile = { id: string; email: string | null; full_name: string | null };

export function displayName(profile: Pick<Profile, "email" | "full_name"> | null | undefined, fallback = "Unknown") {
  return profile?.full_name || profile?.email || fallback;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string) {
  return `${dateTimeFormatter.format(new Date(value))} UTC`;
}

/** Calendar dates stored as `YYYY-MM-DD`; rendered without shifting across time zones. */
export function formatDay(value: string | null | undefined, fallback = "—") {
  return value ? dateFormatter.format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : fallback;
}

export function formatPeriod(start: string | null, end: string | null) {
  if (start && end) return `${formatDay(start)} – ${formatDay(end)}`;
  if (start) return `From ${formatDay(start)}`;
  if (end) return `Until ${formatDay(end)}`;
  return null;
}

/** Today's date in UTC as `YYYY-MM-DD`, for comparing against date columns. */
export function todayUtc(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

type ActivityRow = { action: string; metadata: unknown };

function meta(row: ActivityRow) {
  return (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function roleLabel(value: unknown) {
  const v = str(value);
  if (v in rolePermissions) return rolePermissions[v as OrgRole].label;
  if (v in staffRoleLabel) return staffRoleLabel[v as StaffRole];
  return v;
}

export function describeActivity(row: ActivityRow) {
  const m = meta(row);
  const label = str(m.label) || str(m.email);
  switch (row.action) {
    case "lead.created":
      return `added lead ${label}`;
    case "lead.updated": {
      const stage = str(m.stage);
      return stage && stage in stageMeta
        ? `moved ${label} to ${stageMeta[stage as LeadStage].label}`
        : `updated lead ${label}`;
    }
    case "lead.deleted":
      return `deleted lead ${label}`;
    case "invitation.created":
      return `invited ${label} as ${roleLabel(m.role)}`;
    case "invitation.revoked":
      return `revoked the invitation for ${label}`;
    case "invitation.accepted":
      return "accepted an invitation";
    case "member.role_changed":
      return `changed ${label}'s role to ${roleLabel(m.role)}`;
    case "member.removed":
      return `removed ${label}`;
    case "organization.created":
      return `created client ${label}`;
    case "organization.updated":
      return `updated organisation details for ${label}`;
    case "enquiry.updated":
      return `updated the enquiry from ${label}`;
    case "staff.updated":
      return `updated staff member ${label}`;
    case "ticket.created":
      return `opened ticket ${label}${str(m.subject) ? `: ${str(m.subject)}` : ""}`;
    case "ticket.status_changed": {
      const status = str(m.status);
      return status in ticketStatusMeta
        ? `marked ${label} as ${ticketStatusMeta[status as TicketStatus].label.toLowerCase()}`
        : `updated ${label}`;
    }
    case "ticket.assigned":
      return str(m.assignee) ? `assigned ${label} to ${str(m.assignee)}` : `unassigned ${label}`;
    case "ticket.priority_changed": {
      const priority = str(m.priority);
      return priority in ticketPriorityMeta
        ? `set ${label} to ${ticketPriorityMeta[priority as TicketPriority].label.toLowerCase()} priority`
        : `changed the priority of ${label}`;
    }
    case "sla_policy.updated":
      return "updated the support SLA targets";
    case "engagement.created":
      return `started engagement ${label}`;
    case "engagement.updated": {
      const status = str(m.status);
      return status in engagementStatusMeta
        ? `updated engagement ${label} (${engagementStatusMeta[status as EngagementStatus].label.toLowerCase()})`
        : `updated engagement ${label}`;
    }
    case "engagement.deleted":
      return `removed engagement ${label}`;
    case "milestone.created":
      return `added milestone ${label}`;
    case "milestone.completed":
      return `completed milestone ${label}`;
    case "milestone.updated":
      return `updated milestone ${label}`;
    case "milestone.deleted":
      return `removed milestone ${label}`;
    case "report.published":
      return `published report ${label}`;
    case "report.unpublished":
      return `withdrew report ${label}`;
    default:
      return row.action.replace(/[._]/g, " ");
  }
}
