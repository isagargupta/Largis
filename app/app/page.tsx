import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, EyeOff, FileText } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { TicketList, ticketListColumns } from "@/components/portal/TicketViews";
import { EmptyState, PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatCents, formatDate, formatDay, formatPeriod, todayUtc } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import {
  activeTicketStatuses,
  engagementStatusMeta,
  openStages,
  orgStatusMeta,
  rolePermissions,
  serviceLineLabel,
  stageColor,
  stageMeta,
  stageOrder,
} from "@/lib/portal/meta";
import { loadPeopleNames } from "@/lib/portal/queries";
import { getClientContext, getProfiles } from "@/lib/portal/session";
import { formatPercent } from "@/lib/portal/sla";
import { loadSupportStats } from "@/lib/portal/support";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default async function OverviewPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!org) return null;

  const perms = rolePermissions[org.role];
  const now = Date.now();
  const today = todayUtc(now);
  const supabase = createClient();
  const [
    { data: leads },
    { count: memberCount },
    { data: activity },
    support,
    { data: tickets },
    { data: engagements },
    { data: milestones },
    { data: latestReports },
  ] = await Promise.all([
    supabase.from("leads").select("stage, value_cents").eq("organization_id", org.id).limit(5000),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase
      .from("activity_log")
      .select("id, action, entity, actor_id, metadata, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(perms.ownOnly ? 40 : 10),
    loadSupportStats(org.id, now),
    supabase
      .from("support_tickets")
      .select(ticketListColumns)
      .eq("organization_id", org.id)
      .in("status", activeTicketStatuses)
      .order("updated_at", { ascending: false })
      .limit(4),
    supabase
      .from("engagements")
      .select("id, name, service_line, status, start_date, end_date")
      .eq("organization_id", org.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("id, engagement_id, title, due_date, status")
      .eq("organization_id", org.id)
      .limit(2000),
    supabase
      .from("reports")
      .select("id, title, period_start, period_end, summary, published_at")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1),
  ]);

  const visibleActivity = (activity ?? [])
    .filter((a) => !perms.ownOnly || a.entity !== "lead" || a.actor_id === ctx.user.id)
    .slice(0, 10);

  const rows = leads ?? [];
  const counts = Object.fromEntries(stageOrder.map((s) => [s, 0])) as Record<LeadStage, number>;
  rows.forEach((l) => counts[l.stage]++);
  const open = rows.filter((l) => openStages.includes(l.stage));
  const openValue = open.reduce((sum, l) => sum + l.value_cents, 0);
  const wonValue = rows.filter((l) => l.stage === "won").reduce((sum, l) => sum + l.value_cents, 0);
  const [profiles, names] = await Promise.all([
    getProfiles(visibleActivity.map((a) => a.actor_id)),
    loadPeopleNames((tickets ?? []).map((t) => t.assigned_to)),
  ]);
  const status = orgStatusMeta[org.status];

  const engagementOrder = { active: 0, planning: 1, on_hold: 2, completed: 3 } as const;
  const engagementRows = (engagements ?? [])
    .map((e) => {
      const own = (milestones ?? []).filter((m) => m.engagement_id === e.id);
      const next = own
        .filter((m) => m.status !== "done")
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
      return { ...e, total: own.length, done: own.filter((m) => m.status === "done").length, next };
    })
    .sort((a, b) => engagementOrder[a.status] - engagementOrder[b.status]);
  const latestReport = latestReports?.[0];
  const ticketItems = (tickets ?? []).map((t) => ({
    ...t,
    assigneeName: t.assigned_to ? names.get(t.assigned_to) ?? "Largis team" : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={org.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {org.plan && <span>{org.plan} plan</span>}
            {org.region && <span className="font-mono text-xs">{org.region}</span>}
          </span>
        }
      />

      {perms.ownOnly && (
        <p className="flex items-center gap-2 border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <EyeOff className="h-4 w-4 shrink-0" />
          Lead figures below cover the leads assigned to you. Deal values are hidden for your role.
        </p>
      )}

      <StatGrid>
        <Stat label="Open leads" value={open.length.toLocaleString("en-US")} hint="New through negotiation" />
        <Stat
          label="Open pipeline value"
          value={perms.canViewValue ? formatCents(openValue) : <span className="text-ink-subtle">Hidden</span>}
          hint={perms.canViewValue ? `${formatCents(wonValue)} closed won to date` : "Sum of open deal values"}
        />
        <Stat
          label="Open support tickets"
          value={support.open.toLocaleString("en-US")}
          hint={
            support.breached
              ? `${support.breached} past an SLA target`
              : support.awaitingClient
                ? `${support.awaitingClient} awaiting your reply`
                : "All within SLA"
          }
        />
        <Stat
          label="First responses within SLA"
          value={formatPercent(support.recent.firstResponseRate)}
          hint={`Last 30 days · ${formatPercent(support.recent.resolutionRate)} resolved within SLA`}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Pipeline by stage"
          actions={<PanelLink href={portalHref("/app/sales-tracker")}>Open Sales Tracker</PanelLink>}
          bodyClassName="p-4 sm:p-5"
        >
          <div className="flex h-2 overflow-hidden bg-neutral-100" aria-hidden="true">
            {stageOrder.map((s) => {
              const pct = rows.length ? (counts[s] / rows.length) * 100 : 0;
              return pct > 0 ? <div key={s} className={stageColor[s]} style={{ width: `${pct}%` }} /> : null;
            })}
          </div>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {stageOrder.map((s) => (
              <li key={s}>
                <Link
                  href={portalHref(`/app/sales-tracker?stage=${s}`)}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:bg-paper-soft/70"
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 ${stageColor[s]}`} aria-hidden="true" />
                    {stageMeta[s].label}
                  </span>
                  <span className="tabular-nums text-ink-muted">{counts[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {rows.length === 0 && (
            <p className="mt-4 text-sm text-ink-subtle">
              No leads yet.{" "}
              {perms.canEdit && (
                <Link href={portalHref("/app/sales-tracker")} className="text-brand-700 underline underline-offset-4">
                  Add the first one
                </Link>
              )}
            </p>
          )}
        </Panel>

        <Panel title="Open support tickets" actions={<PanelLink href={portalHref("/app/support")}>Open Support</PanelLink>}>
          <TicketList
            tickets={ticketItems}
            basePath={portalHref("/app/support")}
            now={now}
            audience="client"
            emptyTitle="No open tickets"
            emptyText={perms.canEdit ? "Open a ticket from Support whenever you need the Largis team." : undefined}
          />
          {support.open > ticketItems.length && (
            <p className="border-t border-line px-4 py-3 text-xs text-ink-subtle sm:px-5">
              Showing the {ticketItems.length} most recently updated of {support.open} open tickets.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel title="Engagements">
          {engagementRows.length === 0 ? (
            <EmptyState icon={<Briefcase className="h-5 w-5" />} title="No active engagements">
              Engagements the Largis team runs for you, and their milestones, will appear here.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {engagementRows.map((e) => {
                const meta = engagementStatusMeta[e.status];
                const overdue = Boolean(e.next?.due_date && e.next.due_date < today);
                const period = formatPeriod(e.start_date, e.end_date);
                return (
                  <li key={e.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{e.name}</p>
                        <p className="text-xs text-ink-subtle">
                          {[serviceLineLabel[e.service_line], period].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 bg-neutral-100" aria-hidden="true">
                        <div className="h-full bg-emerald-500" style={{ width: `${e.total ? (e.done / e.total) * 100 : 0}%` }} />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                        {e.done} of {e.total} milestones
                      </span>
                    </div>
                    <p className={cn("mt-2 text-xs", overdue ? "text-red-700" : "text-ink-muted")}>
                      {e.next
                        ? `Next: ${e.next.title}${e.next.due_date ? ` · ${overdue ? "overdue since" : "due"} ${formatDay(e.next.due_date)}` : ""}`
                        : e.total
                          ? "All milestones complete"
                          : "Milestones not yet scheduled"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Latest report" actions={latestReport ? <PanelLink href={portalHref("/app/reports")}>All reports</PanelLink> : undefined}>
            {latestReport ? (
              <Link href={portalHref(`/app/reports/${latestReport.id}`)} className="block px-4 py-4 hover:bg-paper-soft/70 sm:px-5">
                <span className="block text-[15px] font-medium">{latestReport.title}</span>
                <span className="mt-1 block text-xs text-ink-subtle">
                  {[
                    formatPeriod(latestReport.period_start, latestReport.period_end),
                    latestReport.published_at ? `Published ${formatDate(latestReport.published_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {latestReport.summary && (
                  <span className="mt-2 line-clamp-3 block text-sm text-ink-muted">{latestReport.summary}</span>
                )}
              </Link>
            ) : (
              <EmptyState icon={<FileText className="h-5 w-5" />} title="No reports yet">
                Reports from the Largis team will appear here once published.
              </EmptyState>
            )}
          </Panel>

          <Panel title="Recent activity">
            <ActivityList items={visibleActivity} profiles={profiles} />
          </Panel>
        </div>
      </div>

      <p className="text-xs text-ink-subtle">
        {(memberCount ?? 0).toLocaleString("en-US")} {memberCount === 1 ? "person has" : "people have"} access to {org.name}.{" "}
        <Link href={portalHref("/app/team")} className="underline underline-offset-4 hover:text-ink">
          {perms.canManageTeam ? "Manage team" : "View team"}
        </Link>
      </p>
    </div>
  );
}
