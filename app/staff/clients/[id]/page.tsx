import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink, FileText, MessagesSquare } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { ContractsManager, NewInvoiceButton } from "@/components/portal/BillingForms";
import { InvoiceList, invoiceListColumns } from "@/components/portal/BillingViews";
import { ClientSettingsForm } from "@/components/portal/ClientSettingsForm";
import { EngagementsManager, type EngagementView } from "@/components/portal/EngagementsManager";
import { LeadsManager } from "@/components/portal/LeadsManager";
import { NewReportButton } from "@/components/portal/ReportForms";
import { NewTicketButton, SlaPolicyForm, type SlaOverrides } from "@/components/portal/SupportForms";
import { TeamManager } from "@/components/portal/TeamManager";
import { TicketList, ticketListColumns } from "@/components/portal/TicketViews";
import { EmptyState, PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { billingToday } from "@/lib/portal/billing";
import { contractColumns, loadBillingSummary, toContractView, toInvoiceListItem } from "@/lib/portal/billing-data";
import {
  displayName,
  formatCents,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyTotals,
  formatPeriod,
  todayUtc,
} from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { openStages, orgStatusMeta, reportStatusMeta, stageOrder, staffPermissions } from "@/lib/portal/meta";
import { leadColumns, loadLeadValues, loadStaffOptions, loadTeam } from "@/lib/portal/queries";
import { getProfiles, getUser, requestHost } from "@/lib/portal/session";
import { formatPercent } from "@/lib/portal/sla";
import { loadSupportStats } from "@/lib/portal/support";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage, OrgStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Client" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "support", label: "Support" },
  { id: "engagements", label: "Engagements" },
  { id: "reports", label: "Reports" },
  { id: "billing", label: "Billing" },
  { id: "team", label: "Members" },
  { id: "leads", label: "Leads" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof tabs)[number]["id"];

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string; stage?: string };
}) {
  if (!UUID.test(params.id)) notFound();
  const tab: Tab = tabs.some((t) => t.id === searchParams.tab) ? (searchParams.tab as Tab) : "overview";

  const supabase = createClient();
  const [{ data: org }, user] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, plan, region, status, require_mfa, created_at")
      .eq("id", params.id)
      .maybeSingle(),
    getUser(),
  ]);
  if (!org || !user) notFound();

  const status = orgStatusMeta[org.status];
  const base = portalHref(`/staff/clients/${org.id}`);

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-ink-subtle">
          <li>
            <Link href={portalHref("/staff/clients")} className="hover:text-ink">
              Clients
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li aria-current="page" className="min-w-0 truncate text-ink">
            {org.name}
          </li>
        </ol>
      </nav>

      <PageHeader
        title={org.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            {org.plan && <span>{org.plan} plan</span>}
            {org.region && <span className="font-mono text-xs">{org.region}</span>}
            <span className="font-mono text-xs text-ink-subtle">{org.slug}</span>
          </span>
        }
        actions={
          <ButtonLink href={portalHref(`/staff/messages/${org.id}`)} variant="outline" size="sm">
            <MessagesSquare className="h-4 w-4" />
            Message
          </ButtonLink>
        }
      />

      <nav aria-label="Client sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => {
            const active = t.id === tab;
            return (
              <li key={t.id}>
                <Link
                  href={t.id === "overview" ? base : `${base}?tab=${t.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 px-3 py-2.5 text-sm transition-colors",
                    active ? "border-gold-500 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "overview" && <Overview org={org} />}
      {tab === "support" && <Support organizationId={org.id} />}
      {tab === "engagements" && <Engagements organizationId={org.id} />}
      {tab === "reports" && <Reports organizationId={org.id} />}
      {tab === "billing" && <Billing organizationId={org.id} />}
      {tab === "team" && <Members organizationId={org.id} userId={user.id} />}
      {tab === "leads" && (
        <Leads organizationId={org.id} slug={org.slug} userId={user.id} stage={searchParams.stage} />
      )}
      {tab === "activity" && <Activity organizationId={org.id} limit={60} />}
    </div>
  );
}

async function Overview({
  org,
}: {
  org: {
    id: string;
    name: string;
    plan: string | null;
    region: string | null;
    status: OrgStatus;
    require_mfa: boolean;
    created_at: string;
  };
}) {
  const supabase = createClient();
  const [leads, { count: members }, { count: invites }] = await Promise.all([
    supabase.rpc("lead_values", { p_org: org.id }).then(({ data }) => data ?? []),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .is("revoked_at", null),
  ]);
  const open = leads.filter((l) => openStages.includes(l.stage));
  const openValue = open.reduce((sum, l) => sum + l.value_cents, 0);

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Members" value={(members ?? 0).toLocaleString("en-US")} />
        <Stat label="Pending invitations" value={(invites ?? 0).toLocaleString("en-US")} />
        <Stat label="Open leads" value={open.length.toLocaleString("en-US")} />
        <Stat label="Open pipeline value" value={formatCents(openValue)} />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel
          title="Client details"
          actions={<span className="text-xs text-ink-subtle">Client since {formatDate(org.created_at)}</span>}
          bodyClassName="p-4 sm:p-5"
        >
          <ClientSettingsForm
            client={{
              id: org.id,
              name: org.name,
              plan: org.plan,
              region: org.region,
              status: org.status,
              requireMfa: org.require_mfa,
            }}
          />
        </Panel>
        <Panel title="Recent activity">
          <Activity organizationId={org.id} limit={8} bare />
        </Panel>
      </div>
    </div>
  );
}

async function Support({ organizationId }: { organizationId: string }) {
  const now = Date.now();
  const supabase = createClient();
  const [{ data, error }, { data: policies }, staff, stats] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(ticketListColumns)
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("sla_policies")
      .select("priority, first_response_minutes, resolution_minutes")
      .eq("organization_id", organizationId),
    loadStaffOptions(),
    loadSupportStats(organizationId, now),
  ]);
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));
  const tickets = (data ?? []).map((t) => ({
    ...t,
    assigneeName: t.assigned_to ? staffNames.get(t.assigned_to) ?? "Former staff member" : null,
  }));
  const overrides: SlaOverrides = Object.fromEntries(
    (policies ?? []).map((p) => [p.priority, { firstResponse: p.first_response_minutes, resolution: p.resolution_minutes }]),
  );

  return (
    <div className="space-y-6">
      <StatGrid>
        <Stat label="Open tickets" value={stats.open.toLocaleString("en-US")} hint={`${stats.awaitingClient} awaiting the client`} />
        <Stat
          label="SLA breached"
          value={<span className={stats.breached ? "text-red-700" : undefined}>{stats.breached.toLocaleString("en-US")}</span>}
          hint={`${stats.atRisk} at risk`}
        />
        <Stat label="First responses within SLA" value={formatPercent(stats.recent.firstResponseRate)} hint="Last 30 days" />
        <Stat label="Resolved within SLA" value={formatPercent(stats.recent.resolutionRate)} hint="Last 30 days" />
      </StatGrid>

      <Panel
        title="Tickets"
        actions={<NewTicketButton organizationId={organizationId} staff={staff} label="Log ticket" />}
      >
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Tickets could not be loaded. Please refresh the page.
          </p>
        ) : (
          <TicketList
            tickets={tickets}
            basePath={portalHref("/staff/support")}
            now={now}
            audience="staff"
            emptyTitle="No tickets yet"
            emptyText="Tickets this client opens on the portal, or that you log for them, appear here."
          />
        )}
      </Panel>

      <Panel title="SLA targets" bodyClassName="p-4 sm:p-5">
        <SlaPolicyForm organizationId={organizationId} overrides={overrides} />
      </Panel>
    </div>
  );
}

async function Engagements({ organizationId }: { organizationId: string }) {
  const supabase = createClient();
  const [{ data: engagements, error }, { data: milestones }, staff] = await Promise.all([
    supabase
      .from("engagements")
      .select("id, name, service_line, status, start_date, end_date, owner_staff_id, summary, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("id, engagement_id, title, due_date, status, completed_at, sort_order")
      .eq("organization_id", organizationId)
      .order("sort_order")
      .order("due_date", { nullsFirst: false }),
    loadStaffOptions(),
  ]);

  if (error) {
    return (
      <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
        Engagements could not be loaded. Please refresh the page.
      </p>
    );
  }

  const owners = await getProfiles((engagements ?? []).map((e) => e.owner_staff_id));
  const statusOrder = { active: 0, planning: 1, on_hold: 2, completed: 3 } as const;
  const views: EngagementView[] = (engagements ?? [])
    .map((e) => ({
      id: e.id,
      name: e.name,
      serviceLine: e.service_line,
      status: e.status,
      startDate: e.start_date,
      endDate: e.end_date,
      ownerStaffId: e.owner_staff_id,
      ownerName: e.owner_staff_id ? displayName(owners.get(e.owner_staff_id), "Former staff member") : null,
      summary: e.summary,
      milestones: (milestones ?? [])
        .filter((m) => m.engagement_id === e.id)
        .map((m) => ({
          id: m.id,
          title: m.title,
          dueDate: m.due_date,
          status: m.status,
          completedAt: m.completed_at,
          sortOrder: m.sort_order,
        })),
    }))
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return <EngagementsManager organizationId={organizationId} engagements={views} staff={staff} today={todayUtc()} />;
}

async function Reports({ organizationId }: { organizationId: string }) {
  const supabase = createClient();
  const [{ data: reports, error }, { data: engagements }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, title, engagement_id, period_start, period_end, status, published_at, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    supabase.from("engagements").select("id, name").eq("organization_id", organizationId).order("name"),
  ]);
  const engagementNames = new Map((engagements ?? []).map((e) => [e.id, e.name]));
  const rows = reports ?? [];

  return (
    <Panel
      title={`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "report" : "reports"}`}
      actions={<NewReportButton organizationId={organizationId} engagements={engagements ?? []} />}
    >
      {error ? (
        <p role="alert" className="px-5 py-6 text-sm text-red-800">
          Reports could not be loaded. Please refresh the page.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No reports yet">
          Draft a report for this client. It stays private to Largis until you publish it.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const status = reportStatusMeta[r.status];
            return (
              <li key={r.id}>
                <Link
                  href={portalHref(`/staff/clients/${organizationId}/reports/${r.id}`)}
                  className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {[
                        formatPeriod(r.period_start, r.period_end),
                        r.engagement_id ? engagementNames.get(r.engagement_id) : null,
                        r.published_at ? `Published ${formatDateTime(r.published_at)}` : `Edited ${formatDateTime(r.updated_at)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

async function Billing({ organizationId }: { organizationId: string }) {
  const now = Date.now();
  const today = billingToday(now);
  const supabase = createClient();
  const [{ data: contracts, error }, { data: invoices }, summary] = await Promise.all([
    supabase.from("contracts").select(contractColumns).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select(invoiceListColumns)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    loadBillingSummary(organizationId, now),
  ]);

  if (error) {
    return (
      <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
        Billing could not be loaded. Please refresh the page.
      </p>
    );
  }

  const contractViews = (contracts ?? []).map(toContractView);
  const invoiceItems = (invoices ?? []).map((inv) => toInvoiceListItem(inv, today));
  const zero = formatMoney(0, "INR");

  return (
    <div className="space-y-6">
      <StatGrid className="xl:grid-cols-3">
        <Stat label="Outstanding" value={formatMoneyTotals(summary.outstanding, zero)} hint={`${summary.outstandingCount} open`} />
        <Stat
          label="Overdue"
          value={<span className={summary.overdueCount ? "text-red-700" : undefined}>{formatMoneyTotals(summary.overdue, zero)}</span>}
          hint={`${summary.overdueCount} past the due date`}
        />
        <Stat label="Paid this month" value={formatMoneyTotals(summary.paidThisMonth, zero)} />
      </StatGrid>

      <ContractsManager organizationId={organizationId} contracts={contractViews} />

      <Panel
        title="Invoices"
        actions={
          <NewInvoiceButton
            organizationId={organizationId}
            contracts={contractViews
              .filter((c) => c.status === "active" || c.status === "draft")
              .map((c) => ({ id: c.id, name: c.title, organizationId }))}
            variant="outline"
          />
        }
      >
        <InvoiceList
          invoices={invoiceItems}
          basePath={portalHref("/staff/billing")}
          emptyTitle="No invoices yet"
          emptyText="Create a draft, add line items, and issue it. Clients see invoices once issued."
        />
      </Panel>
    </div>
  );
}

async function Members({ organizationId, userId }: { organizationId: string; userId: string }) {
  const { members, invitations } = await loadTeam(organizationId, userId, true);
  const portal = portalUrl("app", "/login", requestHost());
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Members sign in at{" "}
        <a href={portal} className="inline-flex items-center gap-1 text-brand-700 underline-offset-4 hover:underline">
          {portal.replace(/^https?:\/\//, "")}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        . As Largis staff you can invite, change, or remove anyone, including owners.
      </p>
      <TeamManager
        organizationId={organizationId}
        members={members}
        invitations={invitations}
        canManage
        canGrantOwner
      />
    </div>
  );
}

async function Leads({
  organizationId,
  slug,
  userId,
  stage,
}: {
  organizationId: string;
  slug: string;
  userId: string;
  stage?: string;
}) {
  const supabase = createClient();
  const [{ data: leads, error }, { data: memberships }, values] = await Promise.all([
    supabase
      .from("leads")
      .select(leadColumns)
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase.from("memberships").select("user_id").eq("organization_id", organizationId),
    loadLeadValues(organizationId),
  ]);
  const profiles = await getProfiles((memberships ?? []).map((m) => m.user_id));
  const members = (memberships ?? [])
    .map((m) => ({ id: m.user_id, name: displayName(profiles.get(m.user_id)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (error) {
    return (
      <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
        Leads could not be loaded. Please refresh the page.
      </p>
    );
  }

  return (
    <LeadsManager
      organizationId={organizationId}
      exportName={slug}
      leads={(leads ?? []).map((l) => ({ ...l, value_cents: values.get(l.id) ?? 0 }))}
      members={members}
      perms={staffPermissions}
      currentUserId={userId}
      initialStage={stageOrder.includes(stage as LeadStage) ? (stage as LeadStage) : "all"}
    />
  );
}

async function Activity({ organizationId, limit, bare = false }: { organizationId: string; limit: number; bare?: boolean }) {
  const { data } = await createClient()
    .from("activity_log")
    .select("id, action, actor_id, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const items = data ?? [];
  const profiles = await getProfiles(items.map((a) => a.actor_id));
  const list = <ActivityList items={items} profiles={profiles} />;
  return bare ? list : <Panel title="Activity">{list}</Panel>;
}
