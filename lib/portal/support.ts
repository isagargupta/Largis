import "server-only";
import { activeTicketStatuses } from "@/lib/portal/meta";
import { daysAgoIso } from "@/lib/portal/params";
import { slaSummary, type SlaSummary } from "@/lib/portal/sla";
import { createClient } from "@/lib/supabase/server";

export type SupportStats = {
  open: number;
  awaitingClient: number;
  unassigned: number;
  breached: number;
  atRisk: number;
  /** First-response and resolution performance for tickets opened in the last 30 days. */
  recent: SlaSummary;
  failed: boolean;
};

/** Live queue figures plus 30-day SLA performance, for one client or (null) every client. */
export async function loadSupportStats(organizationId: string | null, now: number): Promise<SupportStats> {
  const supabase = createClient();
  let active = supabase
    .from("support_tickets")
    .select("status, assigned_to, created_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes")
    .in("status", activeTicketStatuses)
    .limit(5000);
  let recent = supabase
    .from("support_tickets")
    .select("status, created_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes")
    .gte("created_at", daysAgoIso(30, now))
    .limit(5000);
  if (organizationId) {
    active = active.eq("organization_id", organizationId);
    recent = recent.eq("organization_id", organizationId);
  }

  const [a, r] = await Promise.all([active, recent]);
  const rows = a.data ?? [];
  const live = slaSummary(rows, now);
  return {
    open: rows.length,
    awaitingClient: rows.filter((t) => t.status === "pending_client").length,
    unassigned: rows.filter((t) => !t.assigned_to).length,
    breached: live.breached,
    atRisk: live.atRisk,
    recent: slaSummary(r.data ?? [], now),
    failed: Boolean(a.error || r.error),
  };
}
