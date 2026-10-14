import { billingMonthStartIso, billingToday, effectiveInvoiceStatus, sumByCurrency } from "@/lib/billing";
import type { Currency, InvoiceStatus } from "@/lib/database.types";
import { activeTicketStatuses, type Tone } from "@/lib/meta";
import { formatDuration, slaSummary, ticketSla, type SlaClock, type SlaSummary, type SlaTicket } from "@/lib/sla";
import { supabase } from "@/lib/supabase";

export type SupportStats = {
  open: number;
  awaitingClient: number;
  breached: number;
  recent: SlaSummary;
};

function daysAgoIso(days: number, now = Date.now()) {
  return new Date(now - days * 86_400_000).toISOString();
}

/** Live queue figures plus 30-day SLA performance for one client. */
export async function loadSupportStats(organizationId: string, now: number): Promise<SupportStats> {
  const [a, r] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("status, assigned_to, created_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes")
      .eq("organization_id", organizationId)
      .in("status", activeTicketStatuses)
      .limit(5000),
    supabase
      .from("support_tickets")
      .select("status, created_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes")
      .eq("organization_id", organizationId)
      .gte("created_at", daysAgoIso(30, now))
      .limit(5000),
  ]);
  const rows = a.data ?? [];
  return {
    open: rows.length,
    awaitingClient: rows.filter((t) => t.status === "pending_client").length,
    breached: slaSummary(rows, now).breached,
    recent: slaSummary(r.data ?? [], now),
  };
}

/** Outstanding, overdue, and paid-this-month totals for one client. */
export async function loadBillingSummary(organizationId: string, now = Date.now()) {
  const today = billingToday(now);
  const [{ data: openRows }, { data: paidRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("currency, total_cents, status, due_date")
      .eq("organization_id", organizationId)
      .in("status", ["issued", "overdue"]),
    supabase
      .from("invoices")
      .select("currency, total_cents")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
      .gte("paid_at", billingMonthStartIso(now)),
  ]);
  const outstanding = (openRows ?? []).map((r) => ({
    currency: r.currency as Currency,
    total_cents: r.total_cents,
    status: effectiveInvoiceStatus({ status: r.status as InvoiceStatus, due_date: r.due_date }, today),
  }));
  const overdue = outstanding.filter((r) => r.status === "overdue");
  return {
    outstandingCount: outstanding.length,
    outstanding: sumByCurrency(outstanding, (r) => r.total_cents),
    overdueCount: overdue.length,
    overdue: sumByCurrency(overdue, (r) => r.total_cents),
    paidThisMonth: sumByCurrency(
      (paidRows ?? []).map((r) => ({ currency: r.currency as Currency, total_cents: r.total_cents })),
      (r) => r.total_cents,
    ),
  };
}

export const slaTone: Record<SlaClock["state"], Tone> = {
  met: "success",
  missed: "danger",
  on_track: "neutral",
  at_risk: "warning",
  breached: "danger",
};

export function slaBadge(ticket: SlaTicket, now: number): { label: string; tone: Tone } {
  const sla = ticketSla(ticket, now);
  const clock = sla.current;
  const what = sla.currentKind === "response" ? "Reply" : "Resolution";
  let label: string;
  if (sla.overall === "met") label = "Within SLA";
  else if (sla.overall === "missed") label = "SLA missed";
  else if (clock.state === "breached") label = `${what} overdue ${formatDuration(clock.minutes)}`;
  else label = `${what} due in ${formatDuration(clock.minutes)}`;
  return { label, tone: slaTone[sla.overall] };
}
