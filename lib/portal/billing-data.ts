import "server-only";
import type { ContractView, InvoiceListItem } from "@/components/portal/BillingViews";
import { billingMonthStartIso, billingToday, effectiveInvoiceStatus, sumByCurrency } from "@/lib/portal/billing";
import { createClient } from "@/lib/supabase/server";
import type { BillingCycle, ContractStatus, Currency, InvoiceStatus, ServiceLine } from "@/lib/supabase/types";

export const contractColumns =
  "id, organization_id, title, service_line, status, billing_cycle, currency, monthly_value_cents, start_date, end_date, notes, document_path";

type ContractRow = {
  id: string;
  title: string;
  service_line: string;
  status: ContractStatus;
  billing_cycle: BillingCycle;
  currency: string;
  monthly_value_cents: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  document_path: string | null;
};

export function toContractView(c: ContractRow): ContractView {
  return {
    id: c.id,
    title: c.title,
    serviceLine: c.service_line as ServiceLine,
    status: c.status,
    billingCycle: c.billing_cycle,
    currency: c.currency as Currency,
    monthlyValueCents: c.monthly_value_cents,
    startDate: c.start_date,
    endDate: c.end_date,
    notes: c.notes,
    hasDocument: Boolean(c.document_path),
  };
}

type InvoiceRow = Omit<InvoiceListItem, "currency" | "organizationName"> & { currency: string };

export function toInvoiceListItem(row: InvoiceRow, today: string, organizationName?: string | null): InvoiceListItem {
  return {
    ...row,
    currency: row.currency as Currency,
    status: effectiveInvoiceStatus(row, today),
    organizationName,
  };
}

/** Outstanding, overdue, and paid-this-month totals for one client or, for staff, every client. */
export async function loadBillingSummary(organizationId: string | null, now = Date.now()) {
  const supabase = createClient();
  const today = billingToday(now);

  let open = supabase.from("invoices").select("currency, total_cents, status, due_date").in("status", ["issued", "overdue"]);
  let paid = supabase
    .from("invoices")
    .select("currency, total_cents")
    .eq("status", "paid")
    .gte("paid_at", billingMonthStartIso(now));
  if (organizationId) {
    open = open.eq("organization_id", organizationId);
    paid = paid.eq("organization_id", organizationId);
  }

  const [{ data: openRows, error }, { data: paidRows }] = await Promise.all([open, paid]);
  const outstanding = (openRows ?? []).map((r) => ({
    currency: r.currency as Currency,
    total_cents: r.total_cents,
    status: effectiveInvoiceStatus({ status: r.status as InvoiceStatus, due_date: r.due_date }, today),
  }));
  const overdue = outstanding.filter((r) => r.status === "overdue");

  return {
    ok: !error,
    outstandingCount: outstanding.length,
    outstanding: sumByCurrency(outstanding, (r) => r.total_cents),
    overdueCount: overdue.length,
    overdue: sumByCurrency(overdue, (r) => r.total_cents),
    paidThisMonth: sumByCurrency(
      (paidRows ?? []).map((r) => ({ currency: r.currency as Currency, total_cents: r.total_cents })),
      (r) => r.total_cents,
    ),
  };
}
