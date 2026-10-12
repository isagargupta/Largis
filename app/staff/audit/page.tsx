import type { Metadata } from "next";
import Link from "next/link";
import { Lock, ScrollText } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/portal/filters";
import { compactControl } from "@/components/portal/forms";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { auditActionMeta, auditedTables, type AuditedTable } from "@/lib/portal/meta";
import { isUuid, oneOf } from "@/lib/portal/params";
import { loadPeopleNames, loadStaffOptions } from "@/lib/portal/queries";
import { getStaffMember } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 100;
const tableNames = Object.keys(auditedTables) as AuditedTable[];

function isoDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

function nextDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { client?: string; table?: string; actor?: string; from?: string; to?: string; before?: string };
}) {
  const staff = await getStaffMember();
  if (staff?.role !== "admin") {
    return (
      <div className="border border-line bg-white">
        <EmptyState icon={<Lock className="h-5 w-5" />} title="The audit log is limited to staff admins">
          Ask a staff admin if you need to know who changed a record.
        </EmptyState>
      </div>
    );
  }

  const client = isUuid(searchParams.client) ? searchParams.client : null;
  const table = oneOf(searchParams.table, tableNames);
  const actor = isUuid(searchParams.actor) ? searchParams.actor : searchParams.actor === "system" ? "system" : null;
  const from = isoDate(searchParams.from);
  const to = isoDate(searchParams.to);
  const before = /^\d{1,18}$/.test(searchParams.before ?? "") ? Number(searchParams.before) : null;

  const supabase = createClient();
  let query = supabase
    .from("audit_events")
    .select("id, occurred_at, actor_id, organization_id, table_name, record_id, action, changed_columns")
    .order("id", { ascending: false })
    .limit(PAGE_SIZE);
  if (client) query = query.eq("organization_id", client);
  if (table) query = query.eq("table_name", table);
  if (actor === "system") query = query.is("actor_id", null);
  else if (actor) query = query.eq("actor_id", actor);
  if (from) query = query.gte("occurred_at", `${from}T00:00:00Z`);
  if (to) query = query.lt("occurred_at", nextDay(to));
  if (before) query = query.lt("id", before);

  const [{ data, error }, { data: orgs }, staffOptions] = await Promise.all([
    query,
    supabase.from("organizations").select("id, name").order("name"),
    loadStaffOptions(),
  ]);
  const events = data ?? [];
  const names = await loadPeopleNames(events.map((e) => e.actor_id), "Former staff member");
  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const listPath = portalHref("/staff/audit");
  const filtered = Boolean(client || table || actor || from || to);
  const params = new URLSearchParams();
  if (client) params.set("client", client);
  if (table) params.set("table", table);
  if (actor) params.set("actor", actor);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const olderParams = new URLSearchParams(params);
  if (events.length === PAGE_SIZE) olderParams.set("before", String(events[events.length - 1]!.id));
  const older = events.length === PAGE_SIZE ? `${listPath}?${olderParams.toString()}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="Every change to clients, members, staff, leads, tickets, delivery, and billing records, written by the database and never editable. Times are UTC."
      />

      <FilterBar action={listPath} filtered={filtered}>
        <FilterSelect id="audit-client" name="client" label="Client" defaultValue={client ?? ""}>
          <option value="">All clients</option>
          {(orgs ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="audit-table" name="table" label="Record type" defaultValue={table ?? ""}>
          <option value="">All types</option>
          {tableNames.map((t) => (
            <option key={t} value={t}>
              {auditedTables[t]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="audit-actor" name="actor" label="Changed by" defaultValue={actor ?? ""}>
          <option value="">Anyone</option>
          <option value="system">System or service key</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
        <div className="lg:w-40">
          <label htmlFor="audit-from" className="mb-1.5 block text-xs text-ink-subtle">
            From
          </label>
          <input id="audit-from" name="from" type="date" defaultValue={from ?? ""} className={cn(compactControl, "w-full")} />
        </div>
        <div className="lg:w-40">
          <label htmlFor="audit-to" className="mb-1.5 block text-xs text-ink-subtle">
            To
          </label>
          <input id="audit-to" name="to" type="date" defaultValue={to ?? ""} className={cn(compactControl, "w-full")} />
        </div>
      </FilterBar>

      <Panel title={before ? "Older entries" : "Latest entries"}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            The audit log could not be loaded. Please refresh the page.
          </p>
        ) : events.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title={filtered ? "No entries match" : "No entries yet"}>
            {filtered ? "Try a wider date range or different filters." : "Changes appear here as soon as they are made."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {events.map((e) => {
              const action = auditActionMeta[e.action];
              const label = auditedTables[e.table_name as AuditedTable] ?? e.table_name;
              return (
                <li key={e.id}>
                  <Link
                    href={`${listPath}/${e.id}`}
                    className="grid gap-2 px-4 py-3 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-center md:gap-6"
                  >
                    <span className="text-xs tabular-nums text-ink-subtle">{formatDateTime(e.occurred_at)}</span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{label}</span>
                        {e.organization_id && (
                          <span className="truncate text-xs text-ink-subtle">{orgNames.get(e.organization_id) ?? "Deleted client"}</span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {e.actor_id ? names.get(e.actor_id) ?? "Unknown user" : "System"}
                        {e.action === "update" && e.changed_columns.length > 0 && ` · ${e.changed_columns.join(", ")}`}
                      </span>
                    </span>
                    <span>
                      <Badge tone={action.tone}>{action.label}</Badge>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {(older || before) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm sm:px-5">
            {before ? (
              <Link href={params.toString() ? `${listPath}?${params.toString()}` : listPath} className="text-brand-700 hover:text-brand-800">
                Back to latest
              </Link>
            ) : (
              <span />
            )}
            {older && (
              <Link href={older} className="text-brand-700 hover:text-brand-800">
                Older entries
              </Link>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
