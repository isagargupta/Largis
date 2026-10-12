import type { Metadata } from "next";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/portal/filters";
import { NewTicketButton } from "@/components/portal/SupportForms";
import { TicketList, ticketListColumns } from "@/components/portal/TicketViews";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { activeTicketStatuses, ticketPriorities, ticketPriorityMeta, ticketStatuses, ticketStatusMeta } from "@/lib/portal/meta";
import { cleanQuery, isUuid, oneOf } from "@/lib/portal/params";
import { loadStaffOptions } from "@/lib/portal/queries";
import { getUser } from "@/lib/portal/session";
import { formatPercent, isClosedStatus, ticketSla } from "@/lib/portal/sla";
import { loadSupportStats } from "@/lib/portal/support";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support queue" };

const LIMIT = 500;
const slaFilters = ["attention", "breached", "at_risk"] as const;

export default async function SupportQueuePage({
  searchParams,
}: {
  searchParams: { client?: string; status?: string; priority?: string; assignee?: string; sla?: string; q?: string };
}) {
  const now = Date.now();
  const client = isUuid(searchParams.client) ? searchParams.client : null;
  const status = searchParams.status === "all" ? "all" : oneOf(searchParams.status, ticketStatuses);
  const priority = oneOf(searchParams.priority, ticketPriorities);
  const assignee =
    searchParams.assignee === "me" || searchParams.assignee === "unassigned"
      ? searchParams.assignee
      : isUuid(searchParams.assignee)
        ? searchParams.assignee
        : null;
  const sla = oneOf(searchParams.sla, slaFilters);
  const q = cleanQuery(searchParams.q);

  const supabase = createClient();
  const user = await getUser();
  let query = supabase.from("support_tickets").select(ticketListColumns).order("created_at", { ascending: false }).limit(LIMIT);
  if (client) query = query.eq("organization_id", client);
  if (status === null || sla) query = query.in("status", activeTicketStatuses);
  else if (status !== "all") query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (assignee === "unassigned") query = query.is("assigned_to", null);
  else if (assignee === "me" && user) query = query.eq("assigned_to", user.id);
  else if (assignee && assignee !== "me") query = query.eq("assigned_to", assignee);
  if (q) query = query.or(`subject.ilike.%${q}%,reference.ilike.%${q}%,requester_email.ilike.%${q}%`);

  const [{ data, error }, { data: orgs }, staff, stats] = await Promise.all([
    query,
    supabase.from("organizations").select("id, name").order("name"),
    loadStaffOptions(),
    loadSupportStats(null, now),
  ]);

  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));
  const tickets = (data ?? [])
    .map((t) => ({
      ...t,
      organizationName: orgNames.get(t.organization_id) ?? null,
      assigneeName: t.assigned_to ? staffNames.get(t.assigned_to) ?? "Former staff member" : null,
      sla: ticketSla(t, now),
    }))
    .filter((t) => {
      if (sla === "breached") return t.sla.overall === "breached";
      if (sla === "at_risk") return t.sla.overall === "at_risk";
      if (sla === "attention") return t.sla.overall === "breached" || t.sla.overall === "at_risk";
      return true;
    })
    // Most urgent first: open tickets by the next SLA deadline, then closed tickets by recency.
    .sort((a, b) => {
      const aClosed = isClosedStatus(a.status);
      const bClosed = isClosedStatus(b.status);
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      if (!aClosed) return a.sla.current.dueAt - b.sla.current.dueAt;
      return Date.parse(b.updated_at) - Date.parse(a.updated_at);
    });

  const listPath = portalHref("/staff/support");
  const filtered = Boolean(client || status || priority || assignee || sla || q);
  const organizations = (orgs ?? []).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support queue"
        description="Tickets from every client, most urgent first. SLA clocks run from the moment a ticket is opened."
        actions={<NewTicketButton organizations={organizations} staff={staff} label="Log ticket" />}
      />

      <StatGrid>
        <Stat label="Open tickets" value={stats.open.toLocaleString("en-US")} hint={`${stats.unassigned} unassigned`} />
        <Stat
          label="SLA breached"
          value={<span className={stats.breached ? "text-red-700" : undefined}>{stats.breached.toLocaleString("en-US")}</span>}
          hint="Open tickets past a target"
        />
        <Stat
          label="At risk"
          value={<span className={stats.atRisk ? "text-amber-700" : undefined}>{stats.atRisk.toLocaleString("en-US")}</span>}
          hint="Under 25% of the target window left"
        />
        <Stat
          label="First responses within SLA"
          value={formatPercent(stats.recent.firstResponseRate)}
          hint={`Last 30 days · ${formatPercent(stats.recent.resolutionRate)} resolved within SLA`}
        />
      </StatGrid>

      <FilterBar action={listPath} filtered={filtered}>
        <FilterSearch id="queue-q" defaultValue={q} placeholder="Subject, reference, or requester" />
        <FilterSelect id="queue-client" name="client" label="Client" defaultValue={client ?? ""}>
          <option value="">All clients</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="queue-status" name="status" label="Status" defaultValue={status ?? ""}>
          <option value="">Open tickets</option>
          <option value="all">All tickets</option>
          {ticketStatuses.map((s) => (
            <option key={s} value={s}>
              {ticketStatusMeta[s].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="queue-priority" name="priority" label="Priority" defaultValue={priority ?? ""}>
          <option value="">Any priority</option>
          {ticketPriorities.map((p) => (
            <option key={p} value={p}>
              {ticketPriorityMeta[p].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="queue-assignee" name="assignee" label="Assignee" defaultValue={assignee ?? ""}>
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="queue-sla" name="sla" label="SLA" defaultValue={sla ?? ""}>
          <option value="">Any</option>
          <option value="attention">Breached or at risk</option>
          <option value="breached">Breached</option>
          <option value="at_risk">At risk</option>
        </FilterSelect>
      </FilterBar>

      <Panel
        title={`${tickets.length.toLocaleString("en-US")}${(data ?? []).length === LIMIT ? "+" : ""} ${tickets.length === 1 ? "ticket" : "tickets"}`}
        actions={sla ? <span className="text-xs text-ink-subtle">SLA filters show open tickets only</span> : undefined}
      >
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Tickets could not be loaded. Please refresh the page.
          </p>
        ) : (
          <TicketList
            tickets={tickets}
            basePath={listPath}
            now={now}
            audience="staff"
            emptyTitle={filtered ? "No tickets match" : "The queue is clear"}
            emptyText={filtered ? "Try different filters." : "New tickets from clients will appear here."}
          />
        )}
      </Panel>
    </div>
  );
}
