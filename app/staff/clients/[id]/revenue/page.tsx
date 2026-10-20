import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { RevenueSettings } from "@/components/portal/RevenueSettings";
import { PageHeader } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { loadAssignment } from "@/lib/revenue/assign";
import { loadOrgMembers, loadPipelineStages } from "@/lib/revenue/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pipeline settings" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StaffRevenuePage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const { data: org } = await createClient().from("organizations").select("id, name").eq("id", params.id).maybeSingle();
  if (!org) notFound();

  const [stages, assignment, members] = await Promise.all([
    loadPipelineStages(org.id),
    loadAssignment(org.id),
    loadOrgMembers(org.id),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href={`${portalHref(`/staff/clients/${org.id}`)}?tab=leads`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        {org.name}
      </Link>
      <PageHeader
        eyebrow="RevenueDesk"
        title="Pipeline settings"
        description="Labels, visibility, and how new leads are assigned."
      />
      <RevenueSettings
        organizationId={org.id}
        stages={stages}
        mode={assignment.mode}
        fixedOwnerId={assignment.fixedOwnerId}
        members={members}
      />
    </div>
  );
}
