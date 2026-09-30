"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, EyeOff, Lock, Search, ShieldCheck, X } from "lucide-react";
import { OrgSwitcher } from "@/components/sales-tracker/OrgSwitcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  leads as allLeads,
  organizations,
  rolePermissions,
  stageMeta,
  viewers,
  type Lead,
} from "@/lib/mock/sales-tracker";
import type { LeadStage } from "@/lib/supabase/types";
import { cn, formatCurrency } from "@/lib/utils";

const stageOrder: LeadStage[] = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
const sources: Lead["source"][] = ["Inbound", "BPO Chat", "Referral", "Outbound", "Partner"];

const stageColor: Record<LeadStage, string> = {
  new: "bg-neutral-400",
  qualified: "bg-sky-500",
  proposal: "bg-brand-500",
  negotiation: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-red-400",
};

const sidebar = ["Overview", "Sales Tracker", "Support operations", "Reports", "Settings"];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const selectClass =
  "border border-[#c8c8c8] bg-white px-3 py-2 text-sm text-ink focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", good ? "text-emerald-700" : "text-red-700")}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function SalesTrackerDashboard() {
  const [orgId, setOrgId] = useState(organizations[0].id);
  const [viewerId, setViewerId] = useState(viewers[0].id);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<LeadStage | "all">("all");
  const [source, setSource] = useState<Lead["source"] | "all">("all");

  const org = organizations.find((o) => o.id === orgId)!;
  const viewer = viewers.find((v) => v.id === viewerId)!;
  const perms = rolePermissions[viewer.role];

  // Mirrors the RLS policy: rows are first scoped to the active organization, then to the viewer's role.
  const scopedLeads = useMemo(
    () => allLeads.filter((l) => l.organizationId === orgId && (!perms.ownOnly || l.ownerId === viewer.id)),
    [orgId, perms.ownOnly, viewer.id],
  );

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scopedLeads.filter(
      (l) =>
        (stage === "all" || l.stage === stage) &&
        (source === "all" || l.source === source) &&
        (!q || l.company.toLowerCase().includes(q) || l.contact.toLowerCase().includes(q)),
    );
  }, [scopedLeads, query, stage, source]);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(stageOrder.map((s) => [s, 0])) as Record<LeadStage, number>;
    scopedLeads.forEach((l) => counts[l.stage]++);
    return counts;
  }, [scopedLeads]);

  const hasFilters = query !== "" || stage !== "all" || source !== "all";
  const m = org.metrics;

  const cards = [
    {
      label: "Total Revenue",
      value: perms.canViewValue ? formatCurrency(m.revenue) : "Hidden",
      delta: <Delta value={m.revenueDelta} />,
    },
    { label: "Active Leads", value: m.activeLeads.toLocaleString("en-US"), delta: <Delta value={m.leadsDelta} /> },
    { label: "Conversion Rate", value: `${m.conversionRate.toFixed(1)}%`, delta: <Delta value={m.conversionDelta} /> },
    {
      label: "BPO Response Time",
      value: `${m.bpoResponseSeconds}s`,
      delta: <Delta value={m.responseDelta} invert />,
    },
  ];

  function resetFilters() {
    setQuery("");
    setStage("all");
    setSource("all");
  }

  return (
    <div className="border border-line bg-white">
      <div className="flex flex-col gap-4 border-b border-line bg-paper-soft px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <OrgSwitcher
            organizations={organizations}
            activeId={orgId}
            onChange={(id) => {
              setOrgId(id);
              resetFilters();
            }}
          />
          <p className="flex items-center gap-2 text-xs text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              Data limited to <span className="font-mono">{org.id}</span> by row level security
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="viewer" className="whitespace-nowrap text-sm text-ink-subtle">
            Viewing as
          </label>
          <select
            id="viewer"
            value={viewerId}
            onChange={(e) => setViewerId(e.target.value)}
            className={cn(selectClass, "w-full lg:w-auto")}
          >
            {viewers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({rolePermissions[v.role].label})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-line p-5 lg:block" aria-label="Suite navigation">
          <ul className="space-y-0.5">
            {sidebar.map((label) => {
              const active = label === "Sales Tracker";
              return (
                <li key={label}>
                  <span
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block border-l-2 px-3 py-2 text-sm",
                      active ? "border-brand-600 bg-brand-50 text-ink" : "border-transparent text-ink-muted",
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 border-t border-line pt-5">
            <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <Lock className="h-3.5 w-3.5" />
              Your access
            </p>
            <p className="mt-2 text-[15px]">{perms.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{perms.scope}</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">Sales Tracker</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {org.name} · Q3 FY26 · <span className="font-mono text-xs">{org.region}</span>
              </p>
            </div>
            <Button variant="outline" size="sm" disabled={!perms.canViewValue} className="self-start sm:self-auto">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="mt-6 grid border-l border-t border-line sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, delta }) => (
              <div key={label} className="border-b border-r border-line p-5">
                <p className="text-sm text-ink-subtle">{label}</p>
                <p className="mt-2 text-3xl tracking-tight">{value}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-subtle">
                  {delta}
                  <span>vs last quarter</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-line p-5">
            <p className="text-sm text-ink-subtle">Pipeline status</p>
            <div className="mt-3 flex h-2 overflow-hidden bg-neutral-100">
              {stageOrder.map((s) => {
                const pct = scopedLeads.length ? (stageCounts[s] / scopedLeads.length) * 100 : 0;
                return pct > 0 ? <div key={s} className={stageColor[s]} style={{ width: `${pct}%` }} /> : null;
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {stageOrder.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(stage === s ? "all" : s)}
                  aria-pressed={stage === s}
                  className={cn(
                    "rounded-full transition-opacity",
                    stage !== "all" && stage !== s && "opacity-40 hover:opacity-80",
                  )}
                >
                  <Badge tone={stageMeta[s].tone}>
                    {stageMeta[s].label}
                    <span className="tabular-nums opacity-70">{stageCounts[s]}</span>
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border border-line">
            <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search company or contact"
                  aria-label="Search leads"
                  className={cn(selectClass, "w-full pl-9 placeholder:text-ink-subtle")}
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as LeadStage | "all")}
                  aria-label="Filter by stage"
                  className={cn(selectClass, "flex-1 md:flex-none")}
                >
                  <option value="all">All stages</option>
                  {stageOrder.map((s) => (
                    <option key={s} value={s}>
                      {stageMeta[s].label}
                    </option>
                  ))}
                </select>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as Lead["source"] | "all")}
                  aria-label="Filter by source"
                  className={cn(selectClass, "flex-1 md:flex-none")}
                >
                  <option value="all">All sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    aria-label="Clear filters"
                    className="grid w-10 shrink-0 place-items-center text-ink-muted hover:text-ink"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {perms.ownOnly && (
              <div className="flex items-center gap-2 border-b border-line bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                <EyeOff className="h-4 w-4 shrink-0" />
                Agent view: only leads assigned to {viewer.name} are shown, and deal values are hidden.
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-paper-soft">
                  <tr className="border-b border-line text-ink-subtle">
                    <th scope="col" className="px-4 py-3 font-normal">Company</th>
                    <th scope="col" className="px-4 py-3 font-normal">Stage</th>
                    <th scope="col" className="px-4 py-3 text-right font-normal">Value</th>
                    <th scope="col" className="px-4 py-3 font-normal">Owner</th>
                    <th scope="col" className="px-4 py-3 font-normal">Source</th>
                    <th scope="col" className="px-4 py-3 font-normal">Updated</th>
                    <th scope="col" className="px-4 py-3 font-normal">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredLeads.map((lead) => {
                    const canEdit = perms.canEdit && (!perms.ownOnly || lead.ownerId === viewer.id);
                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-paper-soft/70">
                        <td className="px-4 py-3">
                          <p>{lead.company}</p>
                          <p className="text-xs text-ink-subtle">{lead.contact}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={stageMeta[lead.stage].tone}>{stageMeta[lead.stage].label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {perms.canViewValue ? formatCurrency(lead.value) : <span className="text-ink-subtle">Hidden</span>}
                        </td>
                        <td className="px-4 py-3">{lead.owner}</td>
                        <td className="px-4 py-3 text-ink-muted">{lead.source}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-subtle">
                          {dateFormatter.format(new Date(lead.updatedAt))} UTC
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Can edit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                              <Lock className="h-3.5 w-3.5" />
                              Read only
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-subtle">
                        No leads match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-subtle">
              <span>
                Showing {filteredLeads.length} of {scopedLeads.length} leads you can access
              </span>
              <span className="font-mono">organization_id: {org.id}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
