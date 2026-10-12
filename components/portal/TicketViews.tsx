import Link from "next/link";
import { LifeBuoy, Lock } from "lucide-react";
import { SlaBadge } from "@/components/portal/SlaBadge";
import { EmptyState } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/portal/format";
import { ticketPriorityMeta, ticketStatusMeta } from "@/lib/portal/meta";
import type { SlaTicket } from "@/lib/portal/sla";
import type { TicketAuthorKind, TicketPriority } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const ticketListColumns =
  "id, organization_id, reference, subject, priority, status, assigned_to, created_at, updated_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes";

export type TicketListItem = SlaTicket & {
  id: string;
  reference: string;
  subject: string;
  priority: TicketPriority;
  updated_at: string;
  organizationName?: string | null;
  assigneeName?: string | null;
};

export function TicketList({
  tickets,
  basePath,
  now,
  audience,
  emptyTitle,
  emptyText,
}: {
  tickets: TicketListItem[];
  basePath: string;
  now: number;
  audience: "client" | "staff";
  emptyTitle: string;
  emptyText?: string;
}) {
  if (!tickets.length) {
    return (
      <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title={emptyTitle}>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {tickets.map((t) => {
        const status = ticketStatusMeta[t.status];
        const priority = ticketPriorityMeta[t.priority];
        const context = [
          t.organizationName,
          audience === "staff" ? (t.assigneeName ? `Assigned to ${t.assigneeName}` : "Unassigned") : t.assigneeName,
        ].filter(Boolean);
        return (
          <li key={t.id}>
            <Link
              href={`${basePath}/${t.id}`}
              className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6"
            >
              <span className="min-w-0">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-mono text-xs text-ink-subtle">{t.reference}</span>
                  <span className="truncate text-sm font-medium">{t.subject}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                  {[...context, `Updated ${formatDateTime(t.updated_at)}`].join(" · ")}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 md:justify-end">
                {t.priority !== "normal" && <Badge tone={priority.tone}>{priority.label}</Badge>}
                <Badge tone={status.tone}>{audience === "client" ? status.clientLabel : status.label}</Badge>
                <SlaBadge ticket={t} now={now} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export type ThreadMessage = {
  id: string;
  authorName: string;
  authorKind: TicketAuthorKind;
  body: string;
  internal: boolean;
  createdAt: string;
};

export function TicketThread({
  opening,
  messages,
  audience,
}: {
  opening: { authorName: string; body: string; createdAt: string; channel: string };
  messages: ThreadMessage[];
  audience: "client" | "staff";
}) {
  const items: ThreadMessage[] = [
    {
      id: "opening",
      authorName: opening.authorName,
      authorKind: "client",
      body: opening.body,
      internal: false,
      createdAt: opening.createdAt,
    },
    ...messages,
  ];

  return (
    <ol className="space-y-4">
      {items.map((m, i) => {
        const staff = m.authorKind === "staff";
        const label = staff ? (audience === "client" ? `${m.authorName} · Largis support` : `${m.authorName} · Largis`) : m.authorName;
        return (
          <li
            key={m.id}
            className={cn(
              "border px-4 py-3 sm:px-5",
              m.internal
                ? "border-amber-200 bg-amber-50/60"
                : staff
                  ? "border-brand-100 bg-brand-50/50"
                  : "border-line bg-white",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {label}
                {m.internal && (
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-800">
                    <Lock className="h-3 w-3" />
                    Internal note
                  </span>
                )}
              </p>
              <p className="text-xs text-ink-subtle">
                {i === 0 ? `Opened via ${opening.channel} · ` : ""}
                <time dateTime={m.createdAt}>{formatDateTime(m.createdAt)}</time>
              </p>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink-muted">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
