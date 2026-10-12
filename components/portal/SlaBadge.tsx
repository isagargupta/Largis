"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/portal/format";
import type { Tone } from "@/lib/portal/meta";
import { formatDuration, ticketSla, type SlaClock, type SlaTicket } from "@/lib/portal/sla";
import { cn } from "@/lib/utils";

/** Starts from the server's clock so the first render matches, then ticks in the browser. */
function useNow(serverNow: number, intervalMs = 30_000) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const stateTone: Record<SlaClock["state"], Tone> = {
  met: "success",
  missed: "danger",
  on_track: "neutral",
  at_risk: "warning",
  breached: "danger",
};

export function SlaBadge({ ticket, now: serverNow, className }: { ticket: SlaTicket; now: number; className?: string }) {
  const now = useNow(serverNow);
  const sla = ticketSla(ticket, now);
  const clock = sla.current;
  const what = sla.currentKind === "response" ? "Reply" : "Resolution";

  let label: string;
  if (sla.overall === "met") label = "Within SLA";
  else if (sla.overall === "missed") label = "SLA missed";
  else if (clock.state === "breached") label = `${what} overdue ${formatDuration(clock.minutes)}`;
  else label = `${what} due in ${formatDuration(clock.minutes)}`;

  return (
    <Badge
      tone={stateTone[sla.overall]}
      className={cn("whitespace-nowrap", className)}
      title={`${what} target ${formatDateTime(new Date(clock.dueAt).toISOString())}`}
    >
      {label}
    </Badge>
  );
}

function ClockRow({ label, clock, doneVerb }: { label: string; clock: SlaClock; doneVerb: string }) {
  const due = formatDateTime(new Date(clock.dueAt).toISOString());
  let detail: string;
  switch (clock.state) {
    case "met":
      detail = `${doneVerb} in ${formatDuration(clock.minutes)}, within target`;
      break;
    case "missed":
      detail = `${doneVerb} in ${formatDuration(clock.minutes)}, after the target`;
      break;
    case "breached":
      detail = `Overdue by ${formatDuration(clock.minutes)} (due ${due})`;
      break;
    default:
      detail = `Due in ${formatDuration(clock.minutes)} (${due})`;
  }
  const tone = stateTone[clock.state];
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">Target {formatDuration(clock.targetMinutes)}</p>
      </div>
      <p
        className={cn(
          "text-right text-xs",
          tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-800" : tone === "success" ? "text-emerald-700" : "text-ink-muted",
        )}
      >
        {detail}
      </p>
    </div>
  );
}

export function SlaDetails({ ticket, now: serverNow }: { ticket: SlaTicket; now: number }) {
  const now = useNow(serverNow);
  const sla = ticketSla(ticket, now);
  return (
    <div className="divide-y divide-line">
      <ClockRow label="First response" clock={sla.firstResponse} doneVerb="Answered" />
      <ClockRow label="Resolution" clock={sla.resolution} doneVerb="Resolved" />
    </div>
  );
}
