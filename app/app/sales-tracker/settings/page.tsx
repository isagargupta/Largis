import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RevenueSettings } from "@/components/portal/RevenueSettings";
import { PageHeader } from "@/components/portal/ui";
import { portalHref } from "@/lib/portal/hosts";
import { rolePermissions } from "@/lib/portal/meta";
import { getClientContext } from "@/lib/portal/session";
import { loadAssignment } from "@/lib/revenue/assign";
import { loadOrgMembers, loadPipelineStages } from "@/lib/revenue/data";

export const metadata: Metadata = { title: "RevenueDesk settings" };

export default async function RevenueSettingsPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;
  const perms = rolePermissions[org.role];
  if (!perms.canManageTeam) {
    return (
      <p role="alert" className="border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">
        Only owners and admins can change the pipeline.
      </p>
    );
  }

  const [stages, assignment, members] = await Promise.all([
    loadPipelineStages(org.id),
    loadAssignment(org.id),
    loadOrgMembers(org.id),
  ]);

  return (
    <div className="space-y-6">
      <Link href={portalHref("/app/sales-tracker")} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
        All leads
      </Link>
      <PageHeader
        eyebrow="RevenueDesk"
        title="Pipeline settings"
        description="Labels, visibility, and how new leads are assigned. Existing organisations keep their current labels until you change them."
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
