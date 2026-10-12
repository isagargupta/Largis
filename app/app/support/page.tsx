import type { Metadata } from "next";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/portal/filters";
import { NewTicketButton } from "@/components/portal/SupportForms";
import { TicketList, ticketListColumns } from "@/components/portal/TicketViews";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { activeTicketStatuses, rolePermissions, ticketPriorities, ticketPriorityMeta, ticketStatuses, ticketStatusMeta } from "@/lib/portal/meta";
import { cleanQuery, oneOf } from "@/lib/portal/params";
import { loadPeopleNames } from "@/lib/portal/queries";
import { getClientContext } from "@/lib/portal/session";
import { formatDuration, formatPercent } from "@/lib/portal/sla";
import { loadSupportStats } from "@/lib/portal/support";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Support" };

const LIMIT = 200;

export default async function SupportPage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; q?: string };
}) {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const perms = rolePermissions[org.role];
  const now = Date.now();
  const status = searchParams.status === "all" ? "all" : oneOf(searchParams.status, ticketStatuses);
  const priority = oneOf(searchParams.priority, ticketPriorities);
  const q = cleanQuery(searchParams.q);

  let query = createClient()
    .from("support_tickets")
    .select(ticketListColumns)
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false })
    .limit(LIMIT);
  if (status === null) query = query.in("status", activeTicketStatuses);
  else if (status !== "all") query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);
  if (q) query = query.or(`subject.ilike.%${q}%,reference.ilike.%${q}%`);

  const [{ data, error }, stats] = await Promise.all([query, loadSupportStats(org.id, now)]);
  const rows = data ?? [];
  const names = await loadPeopleNames(rows.map((r) => r.assigned_to));
  const tickets = rows.map((t) => ({ ...t, assigneeName: t.assigned_to ? names.get(t.assigned_to) ?? "Largis team" : null }));
  const listPath = portalHref("/app/support");
  const filtered = Boolean(status || priority || q);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description={`Requests from ${org.name} to the Largis support team, with response and resolution targets.`}
        actions={perms.canEdit ? <NewTicketButton organizationId={org.id} /> : undefined}
      />

      <StatGrid>
        <Stat
          label="Open tickets"
          value={stats.open.toLocaleString("en-US")}
          hint={stats.awaitingClient ? `${stats.awaitingClient} awaiting your reply` : "None awaiting your reply"}
        />
        <Stat
          label="Average first response"
          value={stats.recent.avgFirstResponseMinutes === null ? "—" : formatDuration(stats.recent.avgFirstResponseMinutes)}
          hint="Tickets opened in the last 30 days"
        />
        <Stat
          label="First responses within SLA"
          value={formatPercent(stats.recent.firstResponseRate)}
          hint="Last 30 days"
        />
        <Stat label="Resolved within SLA" value={formatPercent(stats.recent.resolutionRate)} hint="Last 30 days" />
      </StatGrid>

      <FilterBar action={listPath} filtered={filtered}>
        <FilterSearch id="ticket-q" defaultValue={q} placeholder="Subject or reference, e.g. LV-1042" />
        <FilterSelect id="ticket-status" name="status" label="Status" defaultValue={status ?? ""}>
          <option value="">Open tickets</option>
          <option value="all">All tickets</option>
          {ticketStatuses.map((s) => (
            <option key={s} value={s}>
              {ticketStatusMeta[s].clientLabel}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="ticket-priority" name="priority" label="Priority" defaultValue={priority ?? ""}>
          <option value="">Any priority</option>
          {ticketPriorities.map((p) => (
            <option key={p} value={p}>
              {ticketPriorityMeta[p].label}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <Panel title={`${rows.length.toLocaleString("en-US")}${rows.length === LIMIT ? "+" : ""} ${rows.length === 1 ? "ticket" : "tickets"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Tickets could not be loaded. Please refresh the page.
          </p>
        ) : (
          <TicketList
            tickets={tickets}
            basePath={listPath}
            now={now}
            audience="client"
            emptyTitle={filtered ? "No tickets match" : "No open tickets"}
            emptyText={
              filtered
                ? "Try a different search, status, or priority."
                : perms.canEdit
                  ? "Open a ticket whenever you need help from the Largis team."
                  : "Tickets your organisation opens will appear here."
            }
          />
        )}
      </Panel>
    </div>
  );
}
