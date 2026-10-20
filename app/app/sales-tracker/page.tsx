import type { Metadata } from "next";
import { LeadsManager } from "@/components/portal/LeadsManager";
import { PageHeader } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { rolePermissions } from "@/lib/portal/meta";
import { leadColumns, loadLeadValues } from "@/lib/portal/queries";
import { getClientContext } from "@/lib/portal/session";
import { loadOrgMembers, loadOverdueLeadIds, loadPipelineStages } from "@/lib/revenue/data";
import { isLeadStage } from "@/lib/revenue/stages";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "RevenueDesk" };

export default async function SalesTrackerPage({ searchParams }: { searchParams: { stage?: string } }) {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const perms = rolePermissions[org.role];
  const supabase = createClient();
  const [{ data: leads, error }, values, stages, members, overdueLeadIds] = await Promise.all([
    supabase.from("leads").select(leadColumns).eq("organization_id", org.id).order("updated_at", { ascending: false }).limit(2000),
    perms.canViewValue ? loadLeadValues(org.id) : Promise.resolve(new Map<string, number>()),
    loadPipelineStages(org.id),
    loadOrgMembers(org.id),
    loadOverdueLeadIds(org.id),
  ]);

  const rows = (leads ?? []).map((l) => ({ ...l, value_cents: perms.canViewValue ? values.get(l.id) ?? 0 : null }));
  const initialStage: LeadStage | "all" = searchParams.stage && isLeadStage(searchParams.stage) ? searchParams.stage : "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="RevenueDesk"
        title="Leads and pipeline"
        description={
          <>
            {org.name}
            {org.region && <span className="font-mono text-xs"> · {org.region}</span>}
          </>
        }
      />
      {error ? (
        <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
          Leads could not be loaded. Please refresh the page.
        </p>
      ) : (
        <LeadsManager
          key={org.id}
          organizationId={org.id}
          exportName={org.slug}
          leads={rows}
          members={members}
          perms={perms}
          currentUserId={ctx.user.id}
          stages={stages}
          overdueLeadIds={overdueLeadIds}
          leadBase={portalHref("/app/sales-tracker")}
          canImport={perms.canEdit && !perms.ownOnly}
          settingsHref={perms.canManageTeam ? portalHref("/app/sales-tracker/settings") : undefined}
          initialStage={initialStage}
        />
      )}
    </div>
  );
}
