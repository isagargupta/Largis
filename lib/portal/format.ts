import { rolePermissions, stageMeta, staffRoleLabel } from "@/lib/portal/meta";
import type { LeadStage, OrgRole, StaffRole } from "@/lib/supabase/types";

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
    default:
      return row.action.replace(/[._]/g, " ");
  }
}
