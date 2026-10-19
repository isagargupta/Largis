import type { Metadata } from "next";
import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { compactControl } from "@/components/portal/control-styles";
import { SelectBox } from "@/components/portal/forms";
import { EmptyState, PageHeader, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { onboardingManager } from "@/lib/onboarding/access";
import { formatDay } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { cleanQuery, oneOf } from "@/lib/portal/params";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

const statuses = ["open", "submitted", "reviewed", "revoked"] as const;

const statusMeta: Record<OnboardingStatus, { label: string; tone: "brand" | "success" | "warning" | "danger" | "neutral" }> = {
  open: { label: "Waiting", tone: "warning" },
  submitted: { label: "Ready to review", tone: "brand" },
  reviewed: { label: "Reviewed", tone: "success" },
  revoked: { label: "Revoked", tone: "neutral" },
};

export default async function OnboardingPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  await requireStaff();
  const manager = await onboardingManager();
  if (!manager) {
    return (
      <Panel>
        <p className="px-5 py-8 text-sm text-ink-muted">Employee onboarding is limited to admins and managers.</p>
      </Panel>
    );
  }

  const q = cleanQuery(searchParams.q);
  const status = oneOf(searchParams.status, statuses);
  const supabase = createClient();
  let query = supabase
    .from("employee_onboardings")
    .select("id, status, invite_name, full_name, email, invite_email, designation, joining_date, expires_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`full_name.ilike.%${q}%,invite_name.ilike.%${q}%,email.ilike.%${q}%,invite_email.ilike.%${q}%,designation.ilike.%${q}%`);
  const { data, error } = await query;
  const rows = data ?? [];
  const listPath = portalHref("/staff/onboarding");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Employee onboarding"
        description="Send a private joining form. It collects identity, the salary account, and marksheets, then keeps the record here."
        actions={<ButtonLink href={portalHref("/staff/onboarding/new")}>New hire</ButtonLink>}
      />

      <form action={listPath} method="get" role="search" className="flex flex-col gap-3 border border-line bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="onboarding-q" className="mb-1.5 block text-xs text-ink-subtle">
            Search
          </label>
          <input id="onboarding-q" name="q" type="search" defaultValue={q} placeholder="Name, email, or role" className={cn(compactControl, "w-full")} />
        </div>
        <div className="sm:w-52">
          <label htmlFor="onboarding-status" className="mb-1.5 block text-xs text-ink-subtle">
            Status
          </label>
          <SelectBox compact id="onboarding-status" name="status" defaultValue={status ?? ""}>
            <option value="">All</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusMeta[item].label}
              </option>
            ))}
          </SelectBox>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">
            Apply
          </Button>
          {(q || status) && (
            <Link href={listPath} className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <Panel title={`${rows.length.toLocaleString("en-IN")} ${rows.length === 1 ? "person" : "people"}`}>
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Onboarding could not be loaded. Apply the latest database migration if this is a new install, then refresh.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={<UserRoundPlus className="h-5 w-5" />} title={q || status ? "Nothing matches" : "No one is being onboarded"}>
            {q || status ? "Try a different name or status." : "Create a joining link and send it to the new hire. They fill in their own details and documents."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => {
              const expired = row.status === "open" && new Date(row.expires_at).getTime() <= Date.now();
              const meta = expired ? { label: "Link expired", tone: "warning" as const } : statusMeta[row.status];
              return (
                <li key={row.id}>
                  <Link href={portalHref(`/staff/onboarding/${row.id}`)} className="grid gap-2 px-4 py-3.5 hover:bg-paper-soft/70 sm:px-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-6">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.full_name ?? row.invite_name ?? "Unnamed"}</span>
                      <span className="block truncate text-xs text-ink-subtle">{row.email ?? row.invite_email ?? "No email"}</span>
                    </span>
                    <span className="min-w-0 text-xs text-ink-muted">
                      <span className="block truncate">{row.designation ?? "Role not set"}</span>
                      <span className="block truncate text-ink-subtle">{row.joining_date ? `Joining ${formatDay(row.joining_date)}` : "Joining date not set"}</span>
                    </span>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
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
