import type { Currency, InvoiceStatus } from "@/lib/supabase/types";

/** Today's date in India (YYYY-MM-DD); billing dates follow IST, matching public.billing_today(). */
export function billingToday(now = Date.now()) {
  return new Date(now + 330 * 60_000).toISOString().slice(0, 10);
}

/** The first day of the current IST month, as an ISO timestamp. */
export function billingMonthStartIso(now = Date.now()) {
  return new Date(`${billingToday(now).slice(0, 7)}-01T00:00:00+05:30`).toISOString();
}

/**
 * Status as it should be shown: issued invoices past their due date read as overdue even before
 * mark_overdue_invoices() has run.
 */
export function effectiveInvoiceStatus(invoice: { status: InvoiceStatus; due_date: string | null }, today: string): InvoiceStatus {
  if (invoice.status === "issued" && invoice.due_date && invoice.due_date < today) return "overdue";
  return invoice.status;
}

export function isOutstanding(status: InvoiceStatus) {
  return status === "issued" || status === "overdue";
}

export function sumByCurrency<T extends { currency: Currency }>(rows: T[], amount: (row: T) => number) {
  const totals: Partial<Record<Currency, number>> = {};
  for (const row of rows) totals[row.currency] = (totals[row.currency] ?? 0) + amount(row);
  return totals;
}

export function invoicePdfPath(organizationId: string, invoiceId: string) {
  return `${organizationId}/invoices/${invoiceId}.pdf`;
}

export function contractPdfPath(organizationId: string, contractId: string) {
  return `${organizationId}/contracts/${contractId}.pdf`;
}

export const BILLING_BUCKET = "billing";

/** Route that checks access and redirects to a short-lived signed URL. */
export function billingDocumentHref(kind: "invoices" | "contracts", id: string) {
  return `/api/billing/${kind}/${id}`;
}

export function formatTaxRate(bps: number) {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
