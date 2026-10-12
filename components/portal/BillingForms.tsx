"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { FileText, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { DocumentLink, type ContractView } from "@/components/portal/BillingViews";
import { Field, FormAlert, Modal, SelectField, SubmitButton, TextareaField, compactControl } from "@/components/portal/forms";
import { EmptyState, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import {
  createInvoice,
  deleteContract,
  deleteDraftInvoice,
  markInvoicePaid,
  regenerateInvoicePdf,
  runOverdueCheck,
  saveContract,
  saveInvoiceDraft,
  voidInvoice,
} from "@/lib/portal/actions/billing";
import { formatTaxRate } from "@/lib/portal/billing";
import { formatMoney, formatPeriod } from "@/lib/portal/format";
import {
  billingCycleLabel,
  billingCycles,
  contractStatusMeta,
  contractStatuses,
  currencies,
  serviceLineLabel,
  serviceLines,
} from "@/lib/portal/meta";
import type { Currency, InvoiceStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Report = (s: ActionState) => void;

function amountInput(cents: number) {
  return cents ? (cents / 100).toFixed(2).replace(/\.00$/, "") : "";
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export function ContractsManager({ organizationId, contracts }: { organizationId: string; contracts: ContractView[] }) {
  const [editing, setEditing] = useState<ContractView | "new" | null>(null);
  const [flash, setFlash] = useState<ActionState>(idleState);
  const report = useCallback((state: ActionState) => {
    if (state.status !== "idle") setFlash(state);
  }, []);

  return (
    <Panel
      title="Contracts"
      actions={
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          New contract
        </Button>
      }
    >
      {flash.status !== "idle" && (
        <div className="border-b border-line p-4 sm:px-5">
          <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />
        </div>
      )}
      {contracts.length === 0 ? (
        <EmptyState icon={<FileText className="h-5 w-5" />} title="No contracts yet">
          Record the commercial terms for each service line. Clients see active, expired, and terminated contracts, never drafts.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {contracts.map((c) => (
            <ContractRow key={c.id} organizationId={organizationId} contract={c} onEdit={() => setEditing(c)} onResult={report} />
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New contract" : "Edit contract"}
        description="Client owners, admins, and managers can see non-draft contracts and download the signed PDF."
      >
        {editing !== null && (
          <ContractForm
            organizationId={organizationId}
            contract={editing === "new" ? null : editing}
            onDone={(state) => {
              setEditing(null);
              setFlash(state);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </Panel>
  );
}

function ContractRow({
  organizationId,
  contract: c,
  onEdit,
  onResult,
}: {
  organizationId: string;
  contract: ContractView;
  onEdit: () => void;
  onResult: Report;
}) {
  const [state, action] = useFormState(deleteContract, idleState);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (state.status !== "idle") setConfirming(false);
    onResult(state);
  }, [state, onResult]);

  const status = contractStatusMeta[c.status];
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{c.title}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {[
            serviceLineLabel[c.serviceLine],
            billingCycleLabel[c.billingCycle],
            c.monthlyValueCents ? `${formatMoney(c.monthlyValueCents, c.currency)} / month` : null,
            formatPeriod(c.startDate, c.endDate),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        {c.hasDocument && <DocumentLink kind="contracts" id={c.id} available label={`Download ${c.title}`} />}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit<span className="sr-only"> {c.title}</span>
        </button>
        <form action={action} className="inline-flex items-center gap-2">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          {confirming ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep
              </Button>
              <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Removing…">
                Remove contract
              </SubmitButton>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove<span className="sr-only"> {c.title}</span>
            </button>
          )}
        </form>
      </div>
    </li>
  );
}

function ContractForm({
  organizationId,
  contract,
  onDone,
  onCancel,
}: {
  organizationId: string;
  contract: ContractView | null;
  onDone: Report;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(saveContract, idleState);
  const fileId = useId();
  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field name="title" label="Title" defaultValue={contract?.title} errors={state.fieldErrors} maxLength={200} required autoFocus />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="serviceLine" label="Service line" defaultValue={contract?.serviceLine ?? "support"} errors={state.fieldErrors}>
          {serviceLines.map((s) => (
            <option key={s} value={s}>
              {serviceLineLabel[s]}
            </option>
          ))}
        </SelectField>
        <SelectField name="status" label="Status" defaultValue={contract?.status ?? "draft"} errors={state.fieldErrors}>
          {contractStatuses.map((s) => (
            <option key={s} value={s}>
              {contractStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <SelectField name="billingCycle" label="Billing cycle" defaultValue={contract?.billingCycle ?? "monthly"} errors={state.fieldErrors}>
          {billingCycles.map((b) => (
            <option key={b} value={b}>
              {billingCycleLabel[b]}
            </option>
          ))}
        </SelectField>
        <SelectField name="currency" label="Currency" defaultValue={contract?.currency ?? "INR"} errors={state.fieldErrors}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <Field
          name="monthlyValue"
          label="Monthly value"
          inputMode="decimal"
          defaultValue={amountInput(contract?.monthlyValueCents ?? 0)}
          errors={state.fieldErrors}
          hint="Before GST. Leave blank for usage-based contracts."
        />
        <div className="hidden sm:block" aria-hidden="true" />
        <Field name="startDate" label="Start date" type="date" defaultValue={contract?.startDate ?? ""} errors={state.fieldErrors} />
        <Field name="endDate" label="End date" type="date" defaultValue={contract?.endDate ?? ""} errors={state.fieldErrors} />
      </div>
      <TextareaField
        name="notes"
        label="Notes"
        defaultValue={contract?.notes ?? ""}
        errors={state.fieldErrors}
        maxLength={5000}
        className="min-h-[90px]"
        hint="Payment terms, notice periods, or scope notes. Visible to the client once the contract is active."
      />
      <div>
        <label htmlFor={fileId} className="mb-2 block text-sm text-ink">
          Signed contract (PDF)
        </label>
        <input
          id={fileId}
          name="document"
          type="file"
          accept="application/pdf"
          aria-invalid={state.fieldErrors?.document ? true : undefined}
          className="block w-full text-sm text-ink-muted file:mr-4 file:border file:border-line file:bg-paper-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-paper"
        />
        {state.fieldErrors?.document ? (
          <p className="mt-1.5 text-sm text-red-700">{state.fieldErrors.document}</p>
        ) : (
          <p className="mt-1.5 text-xs text-ink-subtle">
            {contract?.hasDocument ? "A PDF is on file. Uploading replaces it." : "Up to 10 MB. Optional."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">{contract ? "Save contract" : "Add contract"}</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// New invoice
// ---------------------------------------------------------------------------

export type ContractOption = { id: string; name: string; organizationId: string };

export function NewInvoiceButton({
  organizationId,
  organizations,
  contracts,
  label = "New invoice",
  variant = "primary",
}: {
  /** Fixed client; otherwise staff pick from `organizations`. */
  organizationId?: string;
  organizations?: { id: string; name: string }[];
  contracts: ContractOption[];
  label?: string;
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New invoice"
        description="Creates a draft. Clients see invoices only once they are issued."
      >
        {open && (
          <NewInvoiceForm
            organizationId={organizationId}
            organizations={organizations ?? []}
            contracts={contracts}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function NewInvoiceForm({
  organizationId,
  organizations,
  contracts,
  onCancel,
}: {
  organizationId?: string;
  organizations: { id: string; name: string }[];
  contracts: ContractOption[];
  onCancel: () => void;
}) {
  const [state, action] = useFormState(createInvoice, idleState);
  const [org, setOrg] = useState(organizationId ?? "");
  const available = contracts.filter((c) => c.organizationId === org);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : (
        <SelectField
          name="organizationId"
          label="Client"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          errors={state.fieldErrors}
          required
        >
          <option value="">Choose a client</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      )}
      <SelectField name="contractId" label="Contract" defaultValue="" errors={state.fieldErrors} disabled={!org} key={org}>
        <option value="">No contract</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Draft editor
// ---------------------------------------------------------------------------

export type DraftInvoice = {
  id: string;
  organizationId: string;
  contractId: string | null;
  currency: Currency;
  taxRateBps: number;
  dueDate: string | null;
  billTo: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unitPriceCents: number }[];
};

type ItemRow = { key: number; description: string; quantity: string; unitPrice: string };

function centsOf(value: string) {
  const n = Number(value.replace(/[,\s₹$€£]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

function qtyOf(value: string) {
  const n = Number(value.trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function InvoiceEditor({
  invoice,
  contracts,
  defaultDueDate,
  canEmail,
}: {
  invoice: DraftInvoice;
  contracts: { id: string; name: string }[];
  defaultDueDate: string;
  canEmail: boolean;
}) {
  const [state, action] = useFormState(saveInvoiceDraft, idleState);
  const nextKey = useRef(invoice.items.length + 1);
  const [items, setItems] = useState<ItemRow[]>(() =>
    invoice.items.length
      ? invoice.items.map((it, i) => ({
          key: i,
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: amountInput(it.unitPriceCents) || "0",
        }))
      : [{ key: 0, description: "", quantity: "1", unitPrice: "" }],
  );
  const [currency, setCurrency] = useState<Currency>(invoice.currency);
  const [taxRate, setTaxRate] = useState(String(invoice.taxRateBps / 100));

  const payload = useMemo(
    () =>
      JSON.stringify(
        items
          .filter((it) => it.description.trim() || it.unitPrice.trim())
          .map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })),
      ),
    [items],
  );

  const subtotal = items.reduce((sum, it) => sum + Math.round(qtyOf(it.quantity) * centsOf(it.unitPrice)), 0);
  const rateBps = Math.round((Number(taxRate) || 0) * 100);
  const tax = Math.round((subtotal * rateBps) / 10000);

  const update = (key: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form action={action} noValidate className="space-y-6">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={invoice.id} />
      <input type="hidden" name="organizationId" value={invoice.organizationId} />
      <input type="hidden" name="items" value={payload} />

      <Panel title="Details" bodyClassName="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <SelectField name="contractId" label="Contract" defaultValue={invoice.contractId ?? ""} errors={state.fieldErrors}>
          <option value="">No contract</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <Field
          name="dueDate"
          label="Due date"
          type="date"
          defaultValue={invoice.dueDate ?? ""}
          errors={state.fieldErrors}
          hint={`Leave blank for 15 days after issue (${defaultDueDate} if issued today).`}
        />
        <SelectField
          name="currency"
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          errors={state.fieldErrors}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <Field
          name="taxRate"
          label="GST rate (%)"
          inputMode="decimal"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
          errors={state.fieldErrors}
          hint="18% for most services. Use 0 for exports under LUT."
        />
        <div className="sm:col-span-2">
          <TextareaField
            name="billTo"
            label="Bill to"
            defaultValue={invoice.billTo ?? ""}
            errors={state.fieldErrors}
            maxLength={1000}
            className="min-h-[90px]"
            hint="Billing address and the client's GSTIN, printed under the client's name."
          />
        </div>
      </Panel>

      <Panel title="Line items" bodyClassName="p-4 sm:p-5">
        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_9rem_8rem_2rem] gap-3 pb-2 text-xs text-ink-subtle md:grid">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ul className="space-y-4 md:space-y-2">
          {items.map((it, i) => {
            const amount = Math.round(qtyOf(it.quantity) * centsOf(it.unitPrice));
            return (
              <li
                key={it.key}
                className="grid grid-cols-2 gap-2 border-b border-line pb-4 md:grid-cols-[minmax(0,1fr)_6rem_9rem_8rem_2rem] md:items-center md:gap-3 md:border-0 md:pb-0"
              >
                <label className="col-span-2 md:col-span-1">
                  <span className="sr-only">Line {i + 1} description</span>
                  <input
                    value={it.description}
                    onChange={(e) => update(it.key, { description: e.target.value })}
                    maxLength={500}
                    placeholder="Description"
                    className={cn(compactControl, "w-full")}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-ink-subtle md:sr-only">Quantity</span>
                  <input
                    value={it.quantity}
                    onChange={(e) => update(it.key, { quantity: e.target.value })}
                    inputMode="decimal"
                    className={cn(compactControl, "w-full text-right tabular-nums")}
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs text-ink-subtle md:sr-only">Unit price</span>
                  <input
                    value={it.unitPrice}
                    onChange={(e) => update(it.key, { unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={cn(compactControl, "w-full text-right tabular-nums")}
                  />
                </label>
                <p className="self-center text-sm tabular-nums md:text-right">
                  <span className="text-xs text-ink-subtle md:hidden">Amount </span>
                  {formatMoney(amount, currency)}
                </p>
                <button
                  type="button"
                  onClick={() => setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== it.key) : rows))}
                  disabled={items.length === 1}
                  className="grid h-8 w-8 place-items-center justify-self-end text-ink-muted hover:text-red-700 disabled:opacity-30"
                  title="Remove line"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove line {i + 1}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {state.fieldErrors?.items && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {state.fieldErrors.items}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={items.length >= 100}
            onClick={() =>
              setItems((rows) => [...rows, { key: nextKey.current++, description: "", quantity: "1", unitPrice: "" }])
            }
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
          <dl className="w-full space-y-1.5 text-sm sm:w-72">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatMoney(subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">GST ({formatTaxRate(rateBps)})</dt>
              <dd className="tabular-nums">{formatMoney(tax, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-ink pt-1.5 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(subtotal + tax, currency)}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <TextareaField
        name="notes"
        label="Notes on the invoice"
        defaultValue={invoice.notes ?? ""}
        errors={state.fieldErrors}
        maxLength={2000}
        className="min-h-[80px]"
        hint="Printed on the PDF, e.g. the service period or a purchase order number."
      />

      <div className="flex flex-col gap-4 border border-line bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <label className={cn("flex items-start gap-2.5 text-sm", !canEmail && "text-ink-subtle")}>
          <input
            type="checkbox"
            name="sendEmail"
            defaultChecked={canEmail}
            disabled={!canEmail}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            Email client owners and admins when issued
            {!canEmail && <span className="block text-xs">Unavailable until a verified sender is configured.</span>}
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <SubmitButton name="intent" value="save" variant="outline" pendingLabel="Saving…">
            Save draft
          </SubmitButton>
          <SubmitButton name="intent" value="issue" pendingLabel="Issuing…">
            Issue invoice
          </SubmitButton>
        </div>
      </div>
      <p className="text-xs text-ink-subtle">
        Issuing assigns the next invoice number, sets today as the issue date, generates the PDF, and locks the invoice. Corrections
        after that need a void and a new invoice.
      </p>
    </form>
  );
}

export function DeleteDraftButton({ id, organizationId }: { id: string; organizationId: string }) {
  const [state, action] = useFormState(deleteDraftInvoice, idleState);
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {state.status === "error" && <span className="text-xs text-red-700">{state.message}</span>}
      {confirming ? (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Deleting…">
            Delete draft
          </SubmitButton>
        </>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)} className="text-red-700">
          <Trash2 className="h-4 w-4" />
          Delete draft
        </Button>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Issued invoices
// ---------------------------------------------------------------------------

export function InvoiceActions({
  id,
  organizationId,
  status,
  today,
}: {
  id: string;
  organizationId: string;
  /** Stored status; the effective one may read overdue. */
  status: InvoiceStatus;
  today: string;
}) {
  const [flash, setFlash] = useState<ActionState>(idleState);
  const [mode, setMode] = useState<"paid" | "void" | null>(null);
  const [paidState, paidAction] = useFormState(markInvoicePaid, idleState);
  const [voidState, voidAction] = useFormState(voidInvoice, idleState);
  const [pdfState, pdfAction] = useFormState(regenerateInvoicePdf, idleState);

  useEffect(() => {
    if (paidState.status !== "idle") setFlash(paidState);
    if (paidState.status === "success") setMode(null);
  }, [paidState]);
  useEffect(() => {
    if (voidState.status !== "idle") setFlash(voidState);
    if (voidState.status === "success") setMode(null);
  }, [voidState]);
  useEffect(() => {
    if (pdfState.status !== "idle") setFlash(pdfState);
  }, [pdfState]);

  const open = status === "issued" || status === "overdue";
  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="organizationId" value={organizationId} />
    </>
  );

  return (
    <div className="space-y-4">
      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />
      <div className="flex flex-wrap gap-3">
        {open && (
          <>
            <Button size="sm" onClick={() => setMode(mode === "paid" ? null : "paid")} aria-expanded={mode === "paid"}>
              Mark paid
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(mode === "void" ? null : "void")} aria-expanded={mode === "void"}>
              Void
            </Button>
          </>
        )}
        <form action={pdfAction}>
          {hidden}
          <SubmitButton size="sm" variant="ghost" pendingLabel="Generating…">
            <RefreshCw className="h-4 w-4" />
            Regenerate PDF
          </SubmitButton>
        </form>
      </div>

      {open && mode === "paid" && (
        <form action={paidAction} noValidate className="grid gap-4 border border-line bg-paper-soft/50 p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          {hidden}
          <Field name="reference" label="Payment reference" placeholder="UTR or transaction ID" maxLength={120} errors={paidState.fieldErrors} />
          <Field name="paidOn" label="Received on" type="date" defaultValue={today} max={today} errors={paidState.fieldErrors} />
          <SubmitButton size="md" pendingLabel="Saving…">
            Record payment
          </SubmitButton>
        </form>
      )}

      {open && mode === "void" && (
        <form action={voidAction} noValidate className="space-y-4 border border-red-200 bg-red-50/50 p-4">
          {hidden}
          <p className="text-sm text-red-900">
            Voiding keeps the number and PDF for your records but cancels the amount due. Issue a new invoice if the client still
            owes a corrected amount.
          </p>
          <Field name="reason" label="Reason (internal)" maxLength={500} errors={voidState.fieldErrors} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode(null)}>
              Keep invoice
            </Button>
            <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Voiding…">
              Void invoice
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

export function OverdueCheckButton() {
  const [state, action] = useFormState(runOverdueCheck, idleState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton size="sm" variant="outline" pendingLabel="Checking…">
        Update overdue statuses
      </SubmitButton>
      {state.status !== "idle" && (
        <span role="status" className={cn("text-xs", state.status === "error" ? "text-red-700" : "text-ink-muted")}>
          {state.message}
        </span>
      )}
    </form>
  );
}
