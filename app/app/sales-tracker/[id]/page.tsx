import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadRecord } from "@/components/portal/LeadRecord";
import { portalHref } from "@/lib/portal/hosts";
import { rolePermissions } from "@/lib/portal/meta";
import { loadLeadValues } from "@/lib/portal/queries";
import { getClientContext, getProfiles } from "@/lib/portal/session";
import { loadLeadDetail } from "@/lib/revenue/data";

export const metadata: Metadata = { title: "Lead" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LeadPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const perms = rolePermissions[org.role];
  const detail = await loadLeadDetail(org.id, params.id);
  if (detail.error || !detail.lead) notFound();

  const values = perms.canViewValue ? await loadLeadValues(org.id) : new Map<string, number>();
  const profiles = await getProfiles(detail.activity.map((item) => item.actor_id));

  return (
    <LeadRecord
      organizationId={org.id}
      lead={{ ...detail.lead, value_cents: perms.canViewValue ? values.get(detail.lead.id) ?? 0 : null }}
      stages={detail.stages}
      members={detail.members}
      tasks={detail.tasks}
      suggestions={detail.suggestions}
      activity={detail.activity}
      profiles={profiles}
      perms={perms}
      currentUserId={ctx.user.id}
      backHref={portalHref("/app/sales-tracker")}
      leadBase={portalHref("/app/sales-tracker")}
      usage={detail.usage}
    />
  );
}
