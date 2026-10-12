import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { compactControl } from "@/components/portal/control-styles";
import { SelectBox } from "@/components/portal/forms";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayName, formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { enquiryStatusMeta, enquiryStatuses } from "@/lib/portal/meta";
import { getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { EnquiryStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Enquiries" };

/** Keeps search text safe inside a PostgREST `or=(...)` filter. */
function cleanQuery(value: unknown) {
  return typeof value === "string"
    ? value
        .replace(/[^\p{L}\p{N}@.\-_' ]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    : "";
}

export default async function EnquiriesPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const status = enquiryStatuses.includes(searchParams.status as EnquiryStatus)
    ? (searchParams.status as EnquiryStatus)
    : null;
  const q = cleanQuery(searchParams.q);

  let query = createClient()
    .from("contact_submissions")
    .select("id, name, email, company, interest, status, assigned_to, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);

  const { data, error } = await query;
  const rows = data ?? [];
  const assignees = await getProfiles(rows.map((r) => r.assigned_to));
  const filtered = Boolean(status || q);
  const listPath = portalHref("/staff/enquiries");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enquiries"
        title="Website enquiries"
        description="Every submission from the largis.co contact form. Assign an owner, keep notes, and convert good fits into clients."
      />

      <form action={listPath} method="get" role="search" className="flex flex-col gap-3 border border-line bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="enquiry-q" className="mb-1.5 block text-xs text-ink-subtle">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="enquiry-q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, email, or company"
              className={cn(compactControl, "w-full pl-9")}
            />
          </div>
        </div>
        <div className="sm:w-44">
          <label htmlFor="enquiry-status" className="mb-1.5 block text-xs text-ink-subtle">
            Status
          </label>
          <SelectBox compact id="enquiry-status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {enquiryStatuses.map((s) => (
              <option key={s} value={s}>
                {enquiryStatusMeta[s].label}
              </option>
            ))}
          </SelectBox>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            Apply
          </Button>
          {filtered && (
            <Link href={listPath} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <Panel title={`${rows.length.toLocaleString("en-US")}${rows.length === 200 ? "+" : ""} ${rows.length === 1 ? "enquiry" : "enquiries"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Enquiries could not be loaded. Please refresh the page.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Inbox className="h-5 w-5" />} title={filtered ? "No enquiries match" : "No enquiries yet"}>
            {filtered ? "Try a different search or status." : "Submissions from the website contact form will appear here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((e) => {
              const meta = enquiryStatusMeta[e.status];
              return (
                <li key={e.id}>
                  <Link
                    href={portalHref(`/staff/enquiries/${e.id}`)}
                    className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center md:gap-6"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{e.company}</span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {e.name} · {e.email}
                      </span>
                    </span>
                    <span className="min-w-0 text-xs text-ink-muted">
                      <span className="block truncate">{e.interest}</span>
                      <span className="block truncate text-ink-subtle">
                        {e.assigned_to ? `Assigned to ${displayName(assignees.get(e.assigned_to))}` : "Unassigned"}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 md:justify-end">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="whitespace-nowrap text-xs text-ink-subtle">{formatDateTime(e.created_at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
