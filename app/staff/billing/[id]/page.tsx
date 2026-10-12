import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteDraftButton, InvoiceActions, InvoiceEditor } from "@/components/portal/BillingForms";
import { DocumentLink, InvoiceStatusBadge } from "@/components/portal/BillingViews";
import { Breadcrumb } from "@/components/portal/filters";
import { FormAlert } from "@/components/portal/forms";
import { PageHeader, Panel } from "@/components/portal/ui";
import { hasVerifiedSender, isEmailConfigured } from "@/lib/email";
import { billingToday, effectiveInvoiceStatus, formatTaxRate } from "@/lib/portal/billing";
import { formatDateTime, formatDay, formatMoney } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { isUuid } from "@/lib/portal/params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

function issueNotice(params: { issued?: string; emailed?: string; pdf?: string }) {
  if (params.issued !== "1") return null;
  const parts = ["Invoice issued."];
  if (params.emailed !== undefined) {
    const sent = Number(params.emailed) || 0;
    parts.push(
      sent ? `${sent} client ${sent === 1 ? "contact was" : "contacts were"} emailed.` : "No email was sent; check the client's owners and admins.",
    );
  }
  if (params.pdf === "failed") parts.push("The PDF could not be generated; use Regenerate PDF.");
  return parts.join(" ");
}

export default async function StaffInvoicePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { issued?: string; emailed?: string; pdf?: string };
}) {
  if (!isUuid(params.id)) notFound();
  const supabase = createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, organization_id, contract_id, number, status, currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, issue_date, due_date, issued_at, paid_at, payment_reference, pdf_path, bill_to, notes, created_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!invoice) notFound();

  const today = billingToday();
  const [{ data: org }, { data: items }, { data: contracts }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", invoice.organization_id).maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id, description, quantity, unit_price_cents, amount_cents")
      .eq("invoice_id", invoice.id)
      .order("sort_order"),
    supabase.from("contracts").select("id, title, status").eq("organization_id", invoice.organization_id).order("title"),
  ]);

  const listPath = portalHref("/staff/billing");
  const clientPath = portalHref(`/staff/clients/${invoice.organization_id}`);
  const status = effectiveInvoiceStatus(invoice, today);
  const contract = (contracts ?? []).find((c) => c.id === invoice.contract_id);
  const notice = issueNotice(searchParams);
  const due = new Date(`${today}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 15);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Billing", href: listPath }, { label: invoice.number ?? "Draft invoice" }]} />
      <PageHeader
        eyebrow={org?.name ?? "Client"}
        title={invoice.number ?? "Draft invoice"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <InvoiceStatusBadge status={status} />
            <span>
              {invoice.status === "draft"
                ? `Created ${formatDay(invoice.created_at)}`
                : `Issued ${formatDay(invoice.issue_date)} · Due ${formatDay(invoice.due_date)}`}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`${clientPath}?tab=billing`} className="text-sm text-brand-700 hover:text-brand-800">
              Client billing
            </Link>
            {invoice.status !== "draft" && (
              <DocumentLink kind="invoices" id={invoice.id} available={Boolean(invoice.pdf_path)} label={`Download ${invoice.number}`}>
                Download PDF
              </DocumentLink>
            )}
          </div>
        }
      />

      {notice && <FormAlert state={{ status: searchParams.pdf === "failed" ? "error" : "success", message: notice }} />}

      {invoice.status === "draft" ? (
        <>
          <InvoiceEditor
            invoice={{
              id: invoice.id,
              organizationId: invoice.organization_id,
              contractId: invoice.contract_id,
              currency: invoice.currency,
              taxRateBps: invoice.tax_rate_bps,
              dueDate: invoice.due_date,
              billTo: invoice.bill_to,
              notes: invoice.notes,
              items: (items ?? []).map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unitPriceCents: it.unit_price_cents,
              })),
            }}
            contracts={(contracts ?? []).map((c) => ({ id: c.id, name: c.status === "active" ? c.title : `${c.title} (${c.status})` }))}
            defaultDueDate={formatDay(due.toISOString())}
            canEmail={isEmailConfigured() && hasVerifiedSender()}
          />
          <div className="flex justify-end border-t border-line pt-4">
            <DeleteDraftButton id={invoice.id} organizationId={invoice.organization_id} />
          </div>
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel title="Line items">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-subtle">
                    <th scope="col" className="px-4 py-2.5 font-normal sm:px-5">
                      Description
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-normal">
                      Qty
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-normal">
                      Unit price
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-normal sm:px-5">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(items ?? []).map((it) => (
                    <tr key={it.id}>
                      <td className="whitespace-pre-wrap px-4 py-3 sm:px-5">{it.description}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{Number(it.quantity).toLocaleString("en-US")}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatMoney(it.unit_price_cents, invoice.currency)}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">{formatMoney(it.amount_cents, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto max-w-xs space-y-1.5 border-t border-line px-4 py-4 text-sm sm:px-5">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(invoice.subtotal_cents, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">GST ({formatTaxRate(invoice.tax_rate_bps)})</dt>
                <dd className="tabular-nums">{formatMoney(invoice.tax_cents, invoice.currency)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-ink pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(invoice.total_cents, invoice.currency)}</dd>
              </div>
            </dl>
          </Panel>

          <div className="space-y-6">
            <Panel title="Payment" bodyClassName="space-y-4 p-4 sm:p-5">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-subtle">Status</dt>
                  <dd className="mt-0.5">
                    <InvoiceStatusBadge status={status} />
                  </dd>
                </div>
                {invoice.paid_at && (
                  <div>
                    <dt className="text-xs text-ink-subtle">Paid</dt>
                    <dd className="mt-0.5">{formatDateTime(invoice.paid_at)}</dd>
                  </div>
                )}
                {invoice.payment_reference && (
                  <div>
                    <dt className="text-xs text-ink-subtle">Reference</dt>
                    <dd className="mt-0.5 break-all font-mono text-xs">{invoice.payment_reference}</dd>
                  </div>
                )}
              </dl>
              <InvoiceActions id={invoice.id} organizationId={invoice.organization_id} status={invoice.status} today={today} />
            </Panel>

            <Panel title="Billed to" bodyClassName="space-y-3 p-4 text-sm sm:p-5">
              <p className="font-medium">{org?.name ?? "Client"}</p>
              {invoice.bill_to && <p className="whitespace-pre-wrap text-ink-muted">{invoice.bill_to}</p>}
              {contract && <p className="text-xs text-ink-subtle">Contract: {contract.title}</p>}
              {invoice.notes && (
                <div className="border-t border-line pt-3">
                  <p className="text-xs text-ink-subtle">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
