import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, CalendarClock } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/portal/filters";
import { EmptyState, PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatDay, formatPeriod, todayUtc } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import {
  engagementStatuses,
  engagementStatusMeta,
  milestoneStatusMeta,
  serviceLineLabel,
  serviceLines,
} from "@/lib/portal/meta";
import { isUuid, oneOf } from "@/lib/portal/params";
import { loadStaffOptions } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";
import type { EngagementStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery" };

const UPCOMING_DAYS = 14;
const currentStatuses: EngagementStatus[] = ["planning", "active", "on_hold"];

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: { status?: string; service?: string; client?: string };
}) {
  const status = searchParams.status === "all" ? "all" : oneOf(searchParams.status, engagementStatuses);
  const service = oneOf(searchParams.service, serviceLines);
  const client = isUuid(searchParams.client) ? searchParams.client : null;
  const today = todayUtc();
  const horizon = addDays(today, UPCOMING_DAYS);

  const supabase = createClient();
  const [{ data: engagements, error }, { data: milestones }, { data: orgs }, staff] = await Promise.all([
    supabase
      .from("engagements")
      .select("id, organization_id, name, service_line, status, start_date, end_date, owner_staff_id")
      .order("name")
      .limit(2000),
    supabase
      .from("milestones")
      .select("id, engagement_id, organization_id, title, due_date, status")
      .order("due_date", { nullsFirst: false })
      .limit(10000),
    supabase.from("organizations").select("id, name").order("name"),
    loadStaffOptions(),
  ]);

  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const staffNames = new Map(staff.map((s) => [s.id, s.name]));
  const all = engagements ?? [];
  const byId = new Map(all.map((e) => [e.id, e]));
  const allMilestones = milestones ?? [];

  const visible = all.filter(
    (e) =>
      (status === "all" ? true : status ? e.status === status : currentStatuses.includes(e.status)) &&
      (!service || e.service_line === service) &&
      (!client || e.organization_id === client),
  );
  const visibleIds = new Set(visible.map((e) => e.id));

  const openMilestones = allMilestones.filter((m) => m.status !== "done");
  const isLive = (engagementId: string) => {
    const e = byId.get(engagementId);
    return Boolean(e && e.status !== "completed");
  };
  const overdueAll = openMilestones.filter((m) => m.due_date && m.due_date < today && isLive(m.engagement_id));
  const upcomingAll = openMilestones.filter(
    (m) => m.due_date && m.due_date >= today && m.due_date <= horizon && isLive(m.engagement_id),
  );
  const attention = [...overdueAll, ...upcomingAll].filter((m) => visibleIds.has(m.engagement_id));

  const rows = visible.map((e) => {
    const own = allMilestones.filter((m) => m.engagement_id === e.id);
    const next = own.filter((m) => m.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
    return { ...e, total: own.length, done: own.filter((m) => m.status === "done").length, next };
  });

  const filtered = Boolean(status || service || client);
  const listPath = portalHref("/staff/delivery");
  const engagementHref = (organizationId: string, engagementId: string) =>
    `${portalHref(`/staff/clients/${organizationId}`)}?tab=engagements#engagement-${engagementId}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Delivery"
        title="Engagements and milestones"
        description="Every client engagement in one view, with milestones that are overdue or due in the next two weeks."
      />

      <StatGrid>
        <Stat
          label="Active engagements"
          value={all.filter((e) => e.status === "active").length.toLocaleString("en-US")}
          hint={`${all.filter((e) => e.status === "planning").length} in planning · ${all.filter((e) => e.status === "on_hold").length} on hold`}
        />
        <Stat
          label="Overdue milestones"
          value={<span className={overdueAll.length ? "text-red-700" : undefined}>{overdueAll.length.toLocaleString("en-US")}</span>}
          hint="Past due and not done"
        />
        <Stat label={`Due in ${UPCOMING_DAYS} days`} value={upcomingAll.length.toLocaleString("en-US")} hint={`Through ${formatDay(horizon)}`} />
        <Stat
          label="Blocked milestones"
          value={openMilestones.filter((m) => m.status === "blocked" && isLive(m.engagement_id)).length.toLocaleString("en-US")}
          hint="Waiting on a dependency"
        />
      </StatGrid>

      <FilterBar action={listPath} filtered={filtered}>
        <FilterSelect id="delivery-status" name="status" label="Status" defaultValue={status ?? ""}>
          <option value="">Current engagements</option>
          <option value="all">All engagements</option>
          {engagementStatuses.map((s) => (
            <option key={s} value={s}>
              {engagementStatusMeta[s].label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="delivery-service" name="service" label="Service line" defaultValue={service ?? ""} className="lg:w-56">
          <option value="">All service lines</option>
          {serviceLines.map((s) => (
            <option key={s} value={s}>
              {serviceLineLabel[s]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="delivery-client" name="client" label="Client" defaultValue={client ?? ""} className="lg:w-56">
          <option value="">All clients</option>
          {(orgs ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      {error ? (
        <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          Delivery data could not be loaded. Please refresh the page.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Panel title={`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "engagement" : "engagements"}`}>
            {rows.length === 0 ? (
              <EmptyState icon={<Briefcase className="h-5 w-5" />} title={filtered ? "No engagements match" : "No current engagements"}>
                {filtered ? "Try different filters." : "Add engagements from a client's Engagements tab."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {rows.map((e) => {
                  const meta = engagementStatusMeta[e.status];
                  const overdue = e.next?.due_date ? e.next.due_date < today : false;
                  return (
                    <li key={e.id}>
                      <Link
                        href={engagementHref(e.organization_id, e.id)}
                        className="block px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{e.name}</span>
                            <span className="block truncate text-xs text-ink-subtle">
                              {[
                                orgNames.get(e.organization_id),
                                serviceLineLabel[e.service_line],
                                e.owner_staff_id ? staffNames.get(e.owner_staff_id) ?? "Former staff member" : "No owner",
                                formatPeriod(e.start_date, e.end_date),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </span>
                        <span className="mt-2.5 flex items-center gap-3">
                          <span className="h-1.5 flex-1 bg-neutral-100" aria-hidden="true">
                            <span
                              className="block h-full bg-emerald-500"
                              style={{ width: `${e.total ? (e.done / e.total) * 100 : 0}%` }}
                            />
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
                            {e.done}/{e.total} milestones
                          </span>
                        </span>
                        {e.next && (
                          <span className={cn("mt-1.5 block truncate text-xs", overdue ? "text-red-700" : "text-ink-muted")}>
                            Next: {e.next.title}
                            {e.next.due_date ? ` · ${overdue ? "overdue since" : "due"} ${formatDay(e.next.due_date)}` : ""}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Milestones needing attention">
            {attention.length === 0 ? (
              <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Nothing overdue or due soon">
                Milestones that are overdue or due in the next {UPCOMING_DAYS} days appear here.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {attention.map((m) => {
                  const e = byId.get(m.engagement_id);
                  const overdue = Boolean(m.due_date && m.due_date < today);
                  const meta = milestoneStatusMeta[m.status];
                  return (
                    <li key={m.id}>
                      <Link
                        href={engagementHref(m.organization_id, m.engagement_id)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-paper-soft/70 sm:px-5"
                      >
                        <span
                          className={cn(
                            "w-16 shrink-0 text-xs tabular-nums",
                            overdue ? "font-medium text-red-700" : "text-ink-muted",
                          )}
                        >
                          {formatDay(m.due_date).replace(/ \d{4}$/, "")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{m.title}</span>
                          <span className="block truncate text-xs text-ink-subtle">
                            {e?.name} · {orgNames.get(m.organization_id)}
                          </span>
                        </span>
                        {overdue ? <Badge tone="danger">Overdue</Badge> : <Badge tone={meta.tone}>{meta.label}</Badge>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
