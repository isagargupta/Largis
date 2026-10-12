import type { Metadata } from "next";
import { LeadsManager } from "@/components/portal/LeadsManager";
import { PageHeader } from "@/components/portal/ui";
import { displayName } from "@/lib/portal/format";
import { rolePermissions, stageOrder } from "@/lib/portal/meta";
import { getClientContext, getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { LeadStage } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Sales Tracker" };

export default async function SalesTrackerPage({ searchParams }: { searchParams: { stage?: string } }) {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const perms = rolePermissions[org.role];
  const supabase = createClient();
  const [{ data: leads, error }, { data: memberships }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, company, contact_name, contact_email, stage, value_cents, owner_id, source, notes, updated_at")
      .eq("organization_id", org.id)
      .order("updated_at", { ascending: false })
      .limit(2000),
    supabase.from("memberships").select("user_id").eq("organization_id", org.id),
  ]);

  const profiles = await getProfiles((memberships ?? []).map((m) => m.user_id));
  const members = (memberships ?? [])
    .map((m) => ({ id: m.user_id, name: displayName(profiles.get(m.user_id)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = (leads ?? []).map((l) => (perms.canViewValue ? l : { ...l, value_cents: 0 }));
  const initialStage = stageOrder.includes(searchParams.stage as LeadStage) ? (searchParams.stage as LeadStage) : "all";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sales Tracker"
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
          initialStage={initialStage}
        />
      )}
    </div>
  );
}
