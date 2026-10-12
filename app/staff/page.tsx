import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { TicketList, ticketListColumns } from "@/components/portal/TicketViews";
import { EmptyState, PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTime, todayUtc } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { activeTicketStatuses, enquiryStatusMeta, openStages } from "@/lib/portal/meta";
import { loadStaffOptions } from "@/lib/portal/queries";
import { getProfiles } from "@/lib/portal/session";
import { ticketSla } from "@/lib/portal/sla";
import { loadSupportStats } from "@/lib/portal/support";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default async function StaffDashboardPage() {
  const supabase = createClient();
  const now = Date.now();
  const today = todayUtc(now);
  const [
    orgs,
    newEnquiries,
    openLeads,
    pendingInvites,
    enquiries,
    activity,
    support,
    activeTickets,
    engagements,
    overdueMilestones,
    staff,
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, status"),
    supabase.from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("leads").select("id", { count: "exact", head: true }).in("stage", openStages),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .is("accepted_at", null)
      .is("revoked_at", null),
    supabase
      .from("contact_submissions")
      .select("id, name, company, interest, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("activity_log")
      .select("id, action, actor_id, organization_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    loadSupportStats(null, now),
    supabase.from("support_tickets").select(ticketListColumns).in("status", activeTicketStatuses).limit(2000),
    supabase.from("engagements").select("id, status").neq("status", "completed"),
    supabase.from("milestones").select("id, engagement_id").neq("status", "done").lt("due_date", today).limit(2000),
    loadStaffOptions(),
  ]);

  const orgRows = orgs.data ?? [];
  const orgNames = new Map(orgRows.map((o) => [o.id, o.name]));
  const activeClients = orgRows.filter((o) => o.status === "active").length;
  const activityItems = (activity.data ?? []).map((a) => ({
    ...a,
    organizationName: a.organization_id ? orgNames.get(a.organization_id) ?? null : null,
  }));
  const profiles = await getProfiles(activityItems.map((a) => a.actor_id));
  const latest = enquiries.data ?? [];

  const liveEngagements = engagements.data ?? [];
  const liveIds = new Set(liveEngagements.map((e) => e.id));
  const overdue = (overdueMilestones.data ?? []).filter((m) => liveIds.has(m.engagement_id)).length;

  const staffNames = new Map(staff.map((s) => [s.id, s.name]));
  const attention = (activeTickets.data ?? [])
    .map((t) => ({ ...t, sla: ticketSla(t, now) }))
    .filter((t) => t.sla.overall === "breached" || t.sla.overall === "at_risk")
    .sort((a, b) => a.sla.current.dueAt - b.sla.current.dueAt)
    .slice(0, 6)
    .map((t) => ({
      ...t,
      organizationName: orgNames.get(t.organization_id) ?? null,
      assigneeName: t.assigned_to ? staffNames.get(t.assigned_to) ?? "Former staff member" : null,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Largis Workspace"
        title="Dashboard"
        description="Support queues, delivery, incoming enquiries, and recent changes across every client."
        actions={
          <ButtonLink href={portalHref("/staff/clients/new")} size="sm">
            Add client
          </ButtonLink>
        }
      />

      <StatGrid>
        <Stat
          label="Open tickets"
          value={support.open.toLocaleString("en-US")}
          hint={`${support.unassigned} unassigned · ${support.awaitingClient} awaiting the client`}
        />
        <Stat
          label="SLA breaches"
          value={<span className={support.breached ? "text-red-700" : undefined}>{support.breached.toLocaleString("en-US")}</span>}
          hint={`${support.atRisk} more at risk`}
        />
        <Stat
          label="Active engagements"
          value={liveEngagements.filter((e) => e.status === "active").length.toLocaleString("en-US")}
          hint={`${liveEngagements.length} not yet completed`}
        />
        <Stat
          label="Overdue milestones"
          value={<span className={overdue ? "text-red-700" : undefined}>{overdue.toLocaleString("en-US")}</span>}
          hint="Across current engagements"
        />
        <Stat
          label="Active clients"
          value={activeClients.toLocaleString("en-US")}
          hint={`${orgRows.length.toLocaleString("en-US")} client organisations in total`}
        />
        <Stat label="New enquiries" value={(newEnquiries.count ?? 0).toLocaleString("en-US")} hint="Awaiting a first reply" />
        <Stat label="Open leads" value={(openLeads.count ?? 0).toLocaleString("en-US")} hint="Across all clients" />
        <Stat
          label="Pending invitations"
          value={(pendingInvites.count ?? 0).toLocaleString("en-US")}
          hint="Not yet accepted"
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Tickets needing attention"
            actions={<PanelLink href={`${portalHref("/staff/support")}?sla=attention`}>Support queue</PanelLink>}
          >
            <TicketList
              tickets={attention}
              basePath={portalHref("/staff/support")}
              now={now}
              audience="staff"
              emptyTitle="Every open ticket is within SLA"
              emptyText="Tickets past a target, or with under a quarter of their window left, appear here."
            />
          </Panel>

          <Panel title="Latest enquiries" actions={<PanelLink href={portalHref("/staff/enquiries")}>All enquiries</PanelLink>}>
            {latest.length === 0 ? (
              <EmptyState icon={<Inbox className="h-5 w-5" />} title="No enquiries yet">
                Submissions from the website contact form will appear here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {latest.map((e) => {
                  const status = enquiryStatusMeta[e.status];
                  return (
                    <li key={e.id}>
                      <Link
                        href={portalHref(`/staff/enquiries/${e.id}`)}
                        className="flex flex-col gap-1.5 px-4 py-3 hover:bg-paper-soft/70 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.company}</span>
                          <span className="block truncate text-xs text-ink-subtle">
                            {e.name} · {e.interest}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Badge tone={status.tone}>{status.label}</Badge>
                          <span className="text-xs text-ink-subtle">{formatDateTime(e.created_at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Recent activity">
          <ActivityList items={activityItems} profiles={profiles} />
        </Panel>
      </div>
    </div>
  );
}