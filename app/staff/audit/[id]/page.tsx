import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/portal/filters";
import { PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { auditActionMeta, auditedTables, type AuditedTable } from "@/lib/portal/meta";
import { loadPeopleNames } from "@/lib/portal/queries";
import { getStaffMember } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit entry" };

type Row = Record<string, Json | undefined>;

function asRow(value: Json | null): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

function show(value: Json | undefined) {
  if (value === undefined) return "";
  if (value === null) return "null";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export default async function AuditEntryPage({ params }: { params: { id: string } }) {
  const staff = await getStaffMember();
  if (staff?.role !== "admin" || !/^\d{1,18}$/.test(params.id)) notFound();

  const supabase = createClient();
  const { data: event } = await supabase.from("audit_events").select("*").eq("id", Number(params.id)).maybeSingle();
  if (!event) notFound();

  const [names, { data: org }] = await Promise.all([
    loadPeopleNames([event.actor_id], "Former staff member"),
    event.organization_id
      ? supabase.from("organizations").select("name").eq("id", event.organization_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const before = asRow(event.old);
  const after = asRow(event.new);
  const changed = new Set(event.changed_columns);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((a, b) => {
    const rank = (k: string) => (changed.has(k) ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const action = auditActionMeta[event.action];
  const label = auditedTables[event.table_name as AuditedTable] ?? event.table_name;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Audit log", href: portalHref("/staff/audit") }, { label: `Entry ${event.id}` }]} />
      <PageHeader
        eyebrow={label}
        title={`${action.label} ${label.toLowerCase().replace(/s$/, "")}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={action.tone}>{action.label}</Badge>
            <span>{formatDateTime(event.occurred_at)}</span>
            <span>by {event.actor_id ? names.get(event.actor_id) ?? "Unknown user" : "System or service key"}</span>
            {org?.name && <span>· {org.name}</span>}
          </span>
        }
      />

      <Panel title="Record">
        <dl className="grid gap-4 p-4 text-sm sm:grid-cols-3 sm:p-5">
          <div>
            <dt className="text-xs text-ink-subtle">Table</dt>
            <dd className="mt-0.5 font-mono text-xs">{event.table_name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-subtle">Record ID</dt>
            <dd className="mt-0.5 break-all font-mono text-xs">{event.record_id ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-ink-subtle">Actor ID</dt>
            <dd className="mt-0.5 break-all font-mono text-xs">{event.actor_id ?? "—"}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title={event.action === "update" ? "Changes" : event.action === "insert" ? "Values when created" : "Values when deleted"}
        actions={<span className="text-xs text-ink-subtle">Sensitive free-text fields are stored as [redacted]</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle">
                <th scope="col" className="w-48 px-4 py-2.5 font-normal sm:px-5">
                  Field
                </th>
                {event.action !== "insert" && (
                  <th scope="col" className="px-3 py-2.5 font-normal">
                    Before
                  </th>
                )}
                {event.action !== "delete" && (
                  <th scope="col" className="px-4 py-2.5 font-normal sm:px-5">
                    After
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => {
                const isChanged = event.action === "update" && changed.has(k);
                return (
                  <tr key={k} className={cn(isChanged && "bg-amber-50/60")}>
                    <th scope="row" className="px-4 py-2.5 text-left align-top font-mono text-xs font-normal sm:px-5">
                      {k}
                    </th>
                    {event.action !== "insert" && (
                      <td className={cn("whitespace-pre-wrap break-words px-3 py-2.5 align-top font-mono text-xs", isChanged && "text-red-800")}>
                        {show(before[k])}
                      </td>
                    )}
                    {event.action !== "delete" && (
                      <td
                        className={cn(
                          "whitespace-pre-wrap break-words px-4 py-2.5 align-top font-mono text-xs sm:px-5",
                          isChanged && "text-emerald-800",
                        )}
                      >
                        {show(after[k])}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
