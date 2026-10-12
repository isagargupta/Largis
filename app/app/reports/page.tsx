import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/portal/filters";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { formatDate, formatPeriod } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { getClientContext } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

function reportYear(r: { period_end: string | null; published_at: string | null }) {
  return (r.period_end ?? r.published_at ?? "").slice(0, 4);
}

export default async function ReportsPage({ searchParams }: { searchParams: { engagement?: string; year?: string } }) {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const supabase = createClient();
  const [{ data, error }, { data: engagements }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, title, engagement_id, period_start, period_end, summary, published_at")
      .eq("organization_id", org.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500),
    supabase.from("engagements").select("id, name").eq("organization_id", org.id).order("name"),
  ]);

  const all = data ?? [];
  const engagementNames = new Map((engagements ?? []).map((e) => [e.id, e.name]));
  const linkedEngagements = (engagements ?? []).filter((e) => all.some((r) => r.engagement_id === e.id));
  const years = Array.from(new Set(all.map(reportYear).filter(Boolean))).sort().reverse();

  const engagement = isUuid(searchParams.engagement) ? searchParams.engagement : null;
  const year = searchParams.year && years.includes(searchParams.year) ? searchParams.year : null;
  const rows = all.filter((r) => (!engagement || r.engagement_id === engagement) && (!year || reportYear(r) === year));
  const listPath = portalHref("/app/reports");
  const filtered = Boolean(engagement || year);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Service reports"
        description={`Performance and delivery reports the Largis team has published for ${org.name}.`}
      />

      {(linkedEngagements.length > 0 || years.length > 1) && (
        <FilterBar action={listPath} filtered={filtered}>
          {linkedEngagements.length > 0 && (
            <FilterSelect id="report-engagement" name="engagement" label="Engagement" defaultValue={engagement ?? ""} className="lg:w-64">
              <option value="">All engagements</option>
              {linkedEngagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </FilterSelect>
          )}
          {years.length > 1 && (
            <FilterSelect id="report-year" name="year" label="Period" defaultValue={year ?? ""}>
              <option value="">All periods</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </FilterSelect>
          )}
        </FilterBar>
      )}

      <Panel title={`${rows.length.toLocaleString("en-US")} ${rows.length === 1 ? "report" : "reports"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Reports could not be loaded. Please refresh the page.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<FileText className="h-5 w-5" />} title={filtered ? "No reports match" : "No reports yet"}>
            {filtered
              ? "Try a different engagement or period."
              : "Your Largis account team publishes reports here, typically monthly. You will be notified by email."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`${listPath}/${r.id}`} className="block px-4 py-4 hover:bg-paper-soft/70 sm:px-5">
                  <span className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <span className="text-[15px] font-medium">{r.title}</span>
                    {r.published_at && (
                      <span className="shrink-0 text-xs text-ink-subtle">Published {formatDate(r.published_at)}</span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-ink-subtle">
                    {[formatPeriod(r.period_start, r.period_end), r.engagement_id ? engagementNames.get(r.engagement_id) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {r.summary && <span className="mt-2 line-clamp-2 block text-sm text-ink-muted">{r.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
