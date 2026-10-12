import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { ContractSummaryList, InvoiceList, invoiceListColumns } from "@/components/portal/BillingViews";
import { EmptyState, PageHeader, Panel, Stat, StatGrid } from "@/components/portal/ui";
import { billingToday } from "@/lib/portal/billing";
import { contractColumns, loadBillingSummary, toContractView, toInvoiceListItem } from "@/lib/portal/billing-data";
import { formatMoney, formatMoneyTotals } from "@/lib/portal/format";
import { rolePermissions } from "@/lib/portal/meta";
import { getClientContext } from "@/lib/portal/session";
import { siteConfig } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Billing" };

export default async function ClientBillingPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  if (!rolePermissions[org.role].canViewBilling) {
    return (
      <div className="border border-line bg-white">
        <EmptyState icon={<Lock className="h-5 w-5" />} title="Billing is limited to owners, admins, and managers">
          Ask an owner or admin of {org.name} if you need a copy of an invoice.
        </EmptyState>
      </div>
    );
  }

  const now = Date.now();
  const today = billingToday(now);
  const supabase = createClient();
  const [{ data: invoices, error }, { data: contracts }, summary] = await Promise.all([
    supabase
      .from("invoices")
      .select(invoiceListColumns)
      .eq("organization_id", org.id)
      .neq("status", "draft")
      .order("issue_date", { ascending: false })
      .limit(500),
    supabase.from("contracts").select(contractColumns).eq("organization_id", org.id).eq("status", "active").order("start_date"),
    loadBillingSummary(org.id, now),
  ]);
  const zero = formatMoney(0, "INR");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Invoices and contracts"
        description={
          <>
            {org.name} · Questions about an invoice? Email{" "}
            <a href={`mailto:${siteConfig.email}`} className="text-brand-700 underline-offset-4 hover:underline">
              {siteConfig.email}
            </a>
            .
          </>
        }
      />

      <StatGrid className="xl:grid-cols-3">
        <Stat
          label="Outstanding balance"
          value={formatMoneyTotals(summary.outstanding, zero)}
          hint={`${summary.outstandingCount} ${summary.outstandingCount === 1 ? "invoice" : "invoices"} awaiting payment`}
        />
        <Stat
          label="Overdue"
          value={<span className={summary.overdueCount ? "text-red-700" : undefined}>{formatMoneyTotals(summary.overdue, zero)}</span>}
          hint={summary.overdueCount ? `${summary.overdueCount} past the due date` : "Nothing overdue"}
        />
        <Stat label="Paid this month" value={formatMoneyTotals(summary.paidThisMonth, zero)} />
      </StatGrid>

      <Panel title="Invoices">
        {error ? (
          <p role="alert" className="px-5 py-6 text-sm text-red-800">
            Invoices could not be loaded. Please refresh the page.
          </p>
        ) : (
          <InvoiceList
            invoices={(invoices ?? []).map((inv) => toInvoiceListItem(inv, today))}
            emptyTitle="No invoices yet"
            emptyText="Invoices from Largis appear here once issued, with a PDF you can download."
          />
        )}
      </Panel>

      <Panel title="Active contracts">
        <ContractSummaryList contracts={(contracts ?? []).map(toContractView)} />
      </Panel>
    </div>
  );
}
