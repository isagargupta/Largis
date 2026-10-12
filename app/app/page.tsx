import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, EyeOff } from "lucide-react";
import { ActivityList } from "@/components/portal/ActivityList";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { openStages, orgStatusMeta, rolePermissions, stageColor, stageMeta, stageOrder } from "@/lib/portal/meta";
import { getClientContext, getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!org) return null;

  const perms = rolePermissions[org.role];
  const supabase = createClient();
  const [{ data: leads }, { count: memberCount }, { data: activity }] = await Promise.all([
    supabase.from("leads").select("stage, value_cents").eq("organization_id", org.id).limit(5000),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
    supabase
      .from("activity_log")
      .select("id, action, entity, actor_id, metadata, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(perms.ownOnly ? 40 : 10),
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
  const profiles = await getProfiles(visibleActivity.map((a) => a.actor_id));
  const status = orgStatusMeta[org.status];

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
          Figures below cover the leads assigned to you. Deal values are hidden for your role.
        </p>
      )}

      <StatGrid>
        <Stat label="Open leads" value={open.length.toLocaleString("en-US")} hint="New through negotiation" />
        <Stat
          label="Open pipeline value"
          value={perms.canViewValue ? formatCents(openValue) : <span className="text-ink-subtle">Hidden</span>}
          hint="Sum of open deal values"
        />
        <Stat
          label="Closed won"
          value={counts.won.toLocaleString("en-US")}
          hint={perms.canViewValue ? `${formatCents(wonValue)} in total` : undefined}
        />
        <Stat label="Team members" value={(memberCount ?? 0).toLocaleString("en-US")} />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Panel
          title="Pipeline by stage"
          actions={
            <Link
              href={portalHref("/app/sales-tracker")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Open Sales Tracker
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
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

        <Panel title="Recent activity">
          <ActivityList items={visibleActivity} profiles={profiles} />
        </Panel>
      </div>
    </div>
  );
}
