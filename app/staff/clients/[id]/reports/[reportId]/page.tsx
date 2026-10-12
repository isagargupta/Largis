import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/portal/filters";
import { ReportEditor } from "@/components/portal/ReportForms";
import { PageHeader } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { displayName, formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { reportStatusMeta } from "@/lib/portal/meta";
import { isUuid } from "@/lib/portal/params";
import { getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Report" };

export default async function ReportEditorPage({ params }: { params: { id: string; reportId: string } }) {
  if (!isUuid(params.id) || !isUuid(params.reportId)) notFound();

  const supabase = createClient();
  const [{ data: org }, { data: report }, { data: engagements }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", params.id).maybeSingle(),
    supabase
      .from("reports")
      .select("id, organization_id, title, engagement_id, period_start, period_end, summary, body, status, published_at, published_by, updated_at")
      .eq("id", params.reportId)
      .eq("organization_id", params.id)
      .maybeSingle(),
    supabase.from("engagements").select("id, name").eq("organization_id", params.id).order("name"),
  ]);
  if (!org || !report) notFound();

  const publisher = report.published_by ? (await getProfiles([report.published_by])).get(report.published_by) : null;
  const status = reportStatusMeta[report.status];
  const clientPath = portalHref(`/staff/clients/${org.id}`);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Clients", href: portalHref("/staff/clients") },
          { label: org.name, href: clientPath },
          { label: "Reports", href: `${clientPath}?tab=reports` },
          { label: report.title },
        ]}
      />
      <PageHeader
        title={report.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span>
              {report.published_at
                ? `Published ${formatDateTime(report.published_at)}${publisher ? ` by ${displayName(publisher)}` : ""}`
                : `Last edited ${formatDateTime(report.updated_at)} · not visible to the client`}
            </span>
          </span>
        }
      />
      <ReportEditor
        report={{
          id: report.id,
          organizationId: report.organization_id,
          title: report.title,
          engagementId: report.engagement_id,
          periodStart: report.period_start,
          periodEnd: report.period_end,
          summary: report.summary,
          body: report.body,
          status: report.status,
        }}
        engagements={engagements ?? []}
      />
    </div>
  );
}
