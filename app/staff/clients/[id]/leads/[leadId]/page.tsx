import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadRecord } from "@/components/portal/LeadRecord";
import { portalHref } from "@/lib/portal/hosts";
import { staffPermissions } from "@/lib/portal/meta";
import { loadLeadValues } from "@/lib/portal/queries";
import { getProfiles, getUser } from "@/lib/portal/session";
import { loadLeadDetail } from "@/lib/revenue/data";

export const metadata: Metadata = { title: "Lead" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StaffLeadPage({ params }: { params: { id: string; leadId: string } }) {
  if (!UUID.test(params.id) || !UUID.test(params.leadId)) notFound();
  const user = await getUser();
  if (!user) notFound();

  const detail = await loadLeadDetail(params.id, params.leadId);
  if (detail.error || !detail.lead) notFound();

  const values = await loadLeadValues(params.id);
  const profiles = await getProfiles(detail.activity.map((item) => item.actor_id));
  const listHref = `${portalHref(`/staff/clients/${params.id}`)}?tab=leads`;

  return (
    <LeadRecord
      organizationId={params.id}
      lead={{ ...detail.lead, value_cents: values.get(detail.lead.id) ?? 0 }}
      stages={detail.stages}
      members={detail.members}
      tasks={detail.tasks}
      suggestions={detail.suggestions}
      activity={detail.activity}
      profiles={profiles}
      perms={staffPermissions}
      currentUserId={user.id}
      backHref={listHref}
      leadBase={portalHref(`/staff/clients/${params.id}/leads`)}
      usage={detail.usage}
    />
  );
}
