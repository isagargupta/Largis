import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/portal/filters";
import { Markdown } from "@/components/portal/Markdown";
import { PrintButton } from "@/components/portal/PrintButton";
import { Eyebrow } from "@/components/ui/card";
import { formatDate, formatPeriod } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { getOrgAccess } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Report" };

export default async function ClientReportPage({ params }: { params: { id: string } }) {
  if (!isUuid(params.id)) notFound();

  const supabase = createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, organization_id, engagement_id, title, period_start, period_end, summary, body, published_at")
    .eq("id", params.id)
    .eq("status", "published")
    .maybeSingle();
  if (!report || !(await getOrgAccess(report.organization_id))) notFound();

  const [{ data: org }, { data: engagement }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", report.organization_id).maybeSingle(),
    report.engagement_id
      ? supabase.from("engagements").select("name").eq("id", report.engagement_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const period = formatPeriod(report.period_start, report.period_end);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Reports", href: portalHref("/app/reports") }, { label: report.title }]} />

      <article className="border border-line bg-white print:border-0">
        <header className="border-b border-line px-5 py-6 sm:px-8 sm:py-8 print:px-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Eyebrow className="mb-3">{org?.name ?? "Report"}</Eyebrow>
              <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{report.title}</h1>
              <p className="mt-2 text-sm text-ink-muted">
                {[period, engagement?.name, report.published_at ? `Published ${formatDate(report.published_at)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <PrintButton />
          </div>
          {report.summary && (
            <p className="mt-6 whitespace-pre-wrap border-l-2 border-gold-500 bg-paper-soft/60 px-4 py-3 text-[15px] leading-relaxed text-ink">
              {report.summary}
            </p>
          )}
        </header>
        <div className="px-5 py-6 sm:px-8 sm:py-8 print:px-0">
          <Markdown source={report.body} className="max-w-3xl print:max-w-none" />
        </div>
        <footer className="border-t border-line px-5 py-4 text-xs text-ink-subtle sm:px-8 print:px-0">
          Prepared by Largis Venture for {org?.name ?? "your organisation"}. Confidential.
        </footer>
      </article>
    </div>
  );
}
