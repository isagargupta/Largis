import Link from "next/link";
import { Download, FileText, ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { billingDocumentHref } from "@/lib/portal/billing";
import { formatDay, formatMoney, formatPeriod } from "@/lib/portal/format";
import { billingCycleLabel, contractStatusMeta, invoiceStatusMeta, serviceLineLabel } from "@/lib/portal/meta";
import type { BillingCycle, ContractStatus, Currency, InvoiceStatus, ServiceLine } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export const invoiceListColumns =
  "id, organization_id, contract_id, number, status, currency, total_cents, issue_date, due_date, paid_at, pdf_path, created_at";

export type InvoiceListItem = {
  id: string;
  number: string | null;
  /** Effective status: issued invoices past due read as overdue. */
  status: InvoiceStatus;
  currency: Currency;
  total_cents: number;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  pdf_path: string | null;
  created_at: string;
  organizationName?: string | null;
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = invoiceStatusMeta[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function invoiceDateLine(inv: InvoiceListItem) {
  if (inv.status === "draft") return `Draft created ${formatDay(inv.created_at)}`;
  if (inv.status === "paid") return `Paid ${formatDay(inv.paid_at)}`;
  if (inv.status === "void") return `Issued ${formatDay(inv.issue_date)} · Void`;
  return `${inv.status === "overdue" ? "Was due" : "Due"} ${formatDay(inv.due_date)}`;
}

/** Staff rows link to the invoice; client rows offer the PDF instead. */
export function InvoiceList({
  invoices,
  basePath,
  emptyTitle,
  emptyText,
}: {
  invoices: InvoiceListItem[];
  basePath?: string;
  emptyTitle: string;
  emptyText?: string;
}) {
  if (!invoices.length) {
    return (
      <EmptyState icon={<ReceiptText className="h-5 w-5" />} title={emptyTitle}>
        {emptyText}
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {invoices.map((inv) => {
        const body = (
          <>
            <span className="min-w-0">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 font-mono text-xs text-ink-subtle">{inv.number ?? "Draft"}</span>
                {inv.organizationName && <span className="truncate text-sm font-medium">{inv.organizationName}</span>}
              </span>
              <span className={cn("mt-0.5 block truncate text-xs", inv.status === "overdue" ? "text-red-700" : "text-ink-subtle")}>
                {invoiceDateLine(inv)}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-3 md:justify-end">
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  inv.status === "void" && "text-ink-subtle line-through decoration-ink-subtle/50",
                )}
              >
                {formatMoney(inv.total_cents, inv.currency)}
              </span>
              <InvoiceStatusBadge status={inv.status} />
            </span>
          </>
        );
        const rowClass =
          "grid gap-2 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6";

        return (
          <li key={inv.id}>
            {basePath ? (
              <Link href={`${basePath}/${inv.id}`} className={cn(rowClass, "hover:bg-paper-soft/70")}>
                {body}
              </Link>
            ) : (
              <div className={cn(rowClass, "md:grid-cols-[minmax(0,1fr)_auto_auto]")}>
                {body}
                <DocumentLink kind="invoices" id={inv.id} available={Boolean(inv.pdf_path)} label={`Download ${inv.number ?? "invoice"}`} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function DocumentLink({
  kind,
  id,
  available,
  label,
  children = "PDF",
}: {
  kind: "invoices" | "contracts";
  id: string;
  available: boolean;
  label: string;
  children?: React.ReactNode;
}) {
  if (!available) return <span className="text-xs text-ink-subtle">PDF pending</span>;
  return (
    <a
      href={billingDocumentHref(kind, id)}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
      aria-label={label}
    >
      <Download className="h-3.5 w-3.5" />
      {children}
    </a>
  );
}

export type ContractView = {
  id: string;
  title: string;
  serviceLine: ServiceLine;
  status: ContractStatus;
  billingCycle: BillingCycle;
  currency: Currency;
  monthlyValueCents: number;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  hasDocument: boolean;
};

export function ContractSummaryList({ contracts }: { contracts: ContractView[] }) {
  if (!contracts.length) {
    return (
      <EmptyState icon={<FileText className="h-5 w-5" />} title="No active contracts">
        Contracts appear here once Largis activates them.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {contracts.map((c) => (
        <li key={c.id} className="grid gap-2 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{c.title}</span>
              <Badge tone={contractStatusMeta[c.status].tone}>{contractStatusMeta[c.status].label}</Badge>
            </span>
            <span className="mt-0.5 block text-xs text-ink-subtle">
              {[serviceLineLabel[c.serviceLine], billingCycleLabel[c.billingCycle], formatPeriod(c.startDate, c.endDate)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-4 md:justify-end">
            {c.monthlyValueCents > 0 && (
              <span className="text-sm tabular-nums">
                {formatMoney(c.monthlyValueCents, c.currency)}
                <span className="text-xs text-ink-subtle"> / month</span>
              </span>
            )}
            {c.hasDocument && <DocumentLink kind="contracts" id={c.id} available label={`Download ${c.title}`} />}
          </span>
        </li>
      ))}
    </ul>
  );
}
