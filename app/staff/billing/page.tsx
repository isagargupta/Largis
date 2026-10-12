import type { Metadata } from "next";
import { NewInvoiceButton, OverdueCheckButton } from "@/components/portal/BillingForms";
import { InvoiceList, invoiceListColumns } from "@/components/portal/BillingViews";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/portal/filters";
import { PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { billingToday } from "@/lib/portal/billing";
import { loadBillingSummary, toInvoiceListItem } from "@/lib/portal/billing-data";
import { formatMoney, formatMoneyTotals } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { invoiceStatuses, invoiceStatusMeta } from "@/lib/portal/meta";
import { cleanQuery, isUuid, oneOf } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Billing" };

const LIMIT = 500;
const statusFilters = [...invoiceStatuses, "outstanding"] as const;

export default async function StaffBillingPage({
  searchParams,
}: {
  searchParams: { client?: string; status?: string; q?: string };
}) {
  const now = Date.now();
  const today = billingToday(now);
  const client = isUuid(searchParams.client) ? searchParams.client : null;
  const status = oneOf(searchParams.status, statusFilters);
  const q = cleanQuery(searchParams.q).replace(/[^A-Za-z0-9-]/g, "");

  const supabase = createClient();
  let query = supabase.from("invoices").select(invoiceListColumns).order("created_at", { ascending: false }).limit(LIMIT);
  if (client) query = query.eq("organization_id", client);
  if (status === "outstanding") query = query.in("status", ["issued", "overdue"]);
  else if (status === "overdue") query = query.or(`status.eq.overdue,and(status.eq.issued,due_date.lt.${today})`);
  else if (status === "issued") query = query.eq("status", "issued").gte("due_date", today);
  else if (status) query = query.eq("status", status);
  if (q) query = query.ilike("number", `%${q}%`);

  const [{ data, error }, { data: orgs }, { data: contracts }, summary, { count: drafts }] = await Promise.all([
    query,
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("contracts").select("id, title, organization_id, status").in("status", ["draft", "active"]).order("title"),
    loadBillingSummary(client, now),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "draft"),
  ]);

  const orgNames = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const invoices = (data ?? []).map((inv) => toInvoiceListItem(inv, today, orgNames.get(inv.organization_id) ?? null));
  const organizations = (orgs ?? []).map((o) => ({ id: o.id, name: o.name }));
  const listPath = portalHref("/staff/billing");
  const filtered = Boolean(client || status || q);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="GST invoices across every client. Drafts stay private to Largis until they are issued."
        actions={
          <NewInvoiceButton
            organizations={organizations}
            contracts={(contracts ?? []).map((c) => ({ id: c.id, name: c.title, organizationId: c.organization_id }))}
          />
        }
      />

      <StatGrid>
        <Stat label="Outstanding" value={formatMoneyTotals(summary.outstanding, formatMoney(0, "INR"))} hint={`${summary.outstandingCount} open ${summary.outstandingCount === 1 ? "invoice" : "invoices"}`} />
        <Stat
          label="Overdue"
          value={<span className={summary.overdueCount ? "text-red-700" : undefined}>{formatMoneyTotals(summary.overdue, formatMoney(0, "INR"))}</span>}
          hint={`${summary.overdueCount} past the due date`}
        />
        <Stat label="Paid this month" value={formatMoneyTotals(summary.paidThisMonth, formatMoney(0, "INR"))} hint="Recorded payments, IST calendar month" />
        <Stat label="Drafts" value={(drafts ?? 0).toLocaleString("en-US")} hint="Not visible to clients" />
      </StatGrid>

      <FilterBar action={listPath} filtered={filtered}>
        <FilterSearch id="billing-q" defaultValue={q} placeholder="Invoice number, e.g. LVI-2026-0004" />
        <FilterSelect id="billing-client" name="client" label="Client" defaultValue={client ?? ""}>
          <option value="">All clients</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect id="billing-status" name="status" label="Status" defaultValue={status ?? ""}>
          <option value="">Any status</option>
          <option value="outstanding">Outstanding</option>
          {invoiceStatuses.map((s) => (
            <option key={s} value={s}>
              {invoiceStatusMeta[s].label}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <Panel
        title={`${invoices.length.toLocaleString("en-US")}${invoices.length === LIMIT ? "+" : ""} ${invoices.length === 1 ? "invoice" : "invoices"}`}
        actions={<OverdueCheckButton />}
      >
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Invoices could not be loaded. Please refresh the page.
          </p>
        ) : (
          <InvoiceList
            invoices={invoices}
            basePath={listPath}
            emptyTitle={filtered ? "No invoices match" : "No invoices yet"}
            emptyText={filtered ? "Try different filters." : "Create a draft for a client, add line items, then issue it."}
          />
        )}
      </Panel>
    </div>
  );
}
