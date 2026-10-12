import type { TicketStatus } from "@/lib/supabase/types";

export type SlaTicket = {
  status: TicketStatus;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  sla_first_response_minutes: number;
  sla_resolution_minutes: number;
};

export type SlaState = "met" | "missed" | "on_track" | "at_risk" | "breached";

export type SlaClock = {
  state: SlaState;
  dueAt: number;
  targetMinutes: number;
  /** Minutes until the target (negative once overdue), or the minutes taken once complete. */
  minutes: number;
};

/** Share of the target window left at which a running clock counts as at risk. */
const AT_RISK_SHARE = 0.25;

const MINUTE = 60_000;

function clock(start: number, targetMinutes: number, doneAt: number | null, now: number): SlaClock {
  const dueAt = start + targetMinutes * MINUTE;
  if (doneAt !== null) {
    return { state: doneAt <= dueAt ? "met" : "missed", dueAt, targetMinutes, minutes: Math.max(0, (doneAt - start) / MINUTE) };
  }
  const left = (dueAt - now) / MINUTE;
  const state: SlaState = left < 0 ? "breached" : left <= targetMinutes * AT_RISK_SHARE ? "at_risk" : "on_track";
  return { state, dueAt, targetMinutes, minutes: left };
}

export function isClosedStatus(status: TicketStatus) {
  return status === "resolved" || status === "closed";
}

export function ticketSla(t: SlaTicket, now: number) {
  const start = Date.parse(t.created_at);
  const resolvedAt = t.resolved_at ? Date.parse(t.resolved_at) : null;
  const closed = isClosedStatus(t.status);
  const respondedAt = t.first_response_at ? Date.parse(t.first_response_at) : closed ? resolvedAt : null;

  const firstResponse = clock(start, t.sla_first_response_minutes, respondedAt, now);
  const resolution = clock(start, t.sla_resolution_minutes, closed ? resolvedAt ?? now : null, now);
  const current = closed ? resolution : respondedAt === null ? firstResponse : resolution;

  // Open tickets are judged on their running clocks; a late first response shows up in the summary rates.
  const states = [firstResponse.state, resolution.state];
  const overall: SlaState = closed
    ? states.includes("missed")
      ? "missed"
      : "met"
    : states.includes("breached")
      ? "breached"
      : states.includes("at_risk")
        ? "at_risk"
        : "on_track";

  return { firstResponse, resolution, current, currentKind: current === firstResponse ? "response" : "resolution", overall } as const;
}

export type SlaSummary = {
  avgFirstResponseMinutes: number | null;
  firstResponseRate: number | null;
  resolutionRate: number | null;
  breached: number;
  atRisk: number;
};

/** Rates count completed clocks plus running clocks that are already overdue. */
export function slaSummary(tickets: SlaTicket[], now: number): SlaSummary {
  let responseTotal = 0;
  let responseCount = 0;
  let responseHit = 0;
  let responseJudged = 0;
  let resolveHit = 0;
  let resolveJudged = 0;
  let breached = 0;
  let atRisk = 0;

  for (const t of tickets) {
    const sla = ticketSla(t, now);
    if (t.first_response_at) {
      responseTotal += (Date.parse(t.first_response_at) - Date.parse(t.created_at)) / MINUTE;
      responseCount++;
    }
    if (sla.firstResponse.state === "met") responseHit++;
    if (["met", "missed", "breached"].includes(sla.firstResponse.state)) responseJudged++;
    if (sla.resolution.state === "met") resolveHit++;
    if (["met", "missed", "breached"].includes(sla.resolution.state)) resolveJudged++;
    if (sla.overall === "breached") breached++;
    if (sla.overall === "at_risk") atRisk++;
  }

  return {
    avgFirstResponseMinutes: responseCount ? responseTotal / responseCount : null,
    firstResponseRate: responseJudged ? responseHit / responseJudged : null,
    resolutionRate: resolveJudged ? resolveHit / resolveJudged : null,
    breached,
    atRisk,
  };
}

export function formatDuration(minutes: number) {
  const m = Math.max(0, Math.round(Math.abs(minutes)));
  if (m < 60) return `${m}m`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function formatPercent(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
