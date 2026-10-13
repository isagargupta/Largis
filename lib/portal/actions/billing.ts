"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasVerifiedSender, isEmailConfigured, sendEmail } from "@/lib/email";
import { invoiceIssuedEmail } from "@/lib/emails/notifications";
import { logActivity } from "@/lib/portal/activity";
import { failure, friendlyDbError, type ActionState } from "@/lib/portal/action-state";
import { BILLING_BUCKET, contractPdfPath, invoicePdfPath } from "@/lib/portal/billing";
import { formatDay, formatMoney } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { renderInvoicePdf } from "@/lib/portal/invoice-pdf";
import { getProfiles, getStaffMember, getUser, requestHost } from "@/lib/portal/session";
import { sendPushToUsers } from "@/lib/push";
import { siteConfig } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Currency } from "@/lib/supabase/types";
import {
  contractSchema,
  fieldErrorsFrom,
  invoiceCreateSchema,
  invoiceDraftSchema,
  invoicePaidSchema,
  invoiceVoidSchema,
  recordRefSchema,
} from "@/lib/validations/portal";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function staffContext() {
  const [user, staff] = await Promise.all([getUser(), getStaffMember()]);
  return user && staff ? { user, staff } : null;
}

function dbFailure(error: { code?: string; message: string }) {
  return failure(friendlyDbError(error));
}

const notStaff = () => failure("Only Largis staff can manage billing.");

/** Storage writes use the secret-key client when configured; staff storage policies cover the fallback. */
function billingStorage() {
  return (createAdminClient() ?? createClient()).storage.from(BILLING_BUCKET);
}

async function readPdfUpload(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || value.size === 0) return { file: null };
  if (value.size > MAX_PDF_BYTES) return { error: "Upload a PDF under 10 MB." };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const header = new TextDecoder().decode(bytes.subarray(0, 5));
  if (header !== "%PDF-") return { error: "Upload the signed contract as a PDF." };
  return { file: bytes };
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export async function saveContract(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();

  const parsed = contractSchema.safeParse(Object.fromEntries(Array.from(formData.entries()).filter(([k]) => k !== "document")));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const { id, organizationId, ...input } = parsed.data;

  const upload = await readPdfUpload(formData.get("document"));
  if (upload.error) return failure("Please review the highlighted fields.", { document: upload.error });

  const fields = {
    title: input.title,
    service_line: input.serviceLine,
    status: input.status,
    billing_cycle: input.billingCycle,
    currency: input.currency,
    monthly_value_cents: input.monthlyValue,
    start_date: input.startDate,
    end_date: input.endDate,
    notes: input.notes,
  };

  const supabase = createClient();
  const result = id
    ? await supabase.from("contracts").update(fields).eq("id", id).eq("organization_id", organizationId).select("id").maybeSingle()
    : await supabase
        .from("contracts")
        .insert({ ...fields, organization_id: organizationId })
        .select("id")
        .single();
  if (result.error) return dbFailure(result.error);
  if (!result.data) return failure("That contract could not be found.");
  const contractId = result.data.id;

  let message = id ? "Contract saved." : `${input.title} added.`;
  if (upload.file) {
    const path = contractPdfPath(organizationId, contractId);
    const { error: uploadError } = await billingStorage().upload(path, upload.file, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) {
      console.error("[billing] Contract upload failed", uploadError.message);
      message = `${message} The PDF could not be uploaded; try again.`;
    } else {
      const { error } = await supabase.from("contracts").update({ document_path: path }).eq("id", contractId);
      if (error) console.error("[billing] Contract document path not saved", error.message);
    }
  }

  await logActivity(supabase, {
    organization_id: organizationId,
    action: id ? "contract.updated" : "contract.created",
    entity: "contract",
    entity_id: contractId,
    metadata: { label: input.title, status: input.status },
  });

  revalidatePath("/", "layout");
  return { status: "success", message, id: contractId };
}

export async function deleteContract(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That contract could not be found.");
  const { id, organizationId } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("title, document_path")
    .maybeSingle();
  if (error) {
    if (error.code === "23503") return failure("Invoices reference this contract. Mark it terminated instead.");
    return dbFailure(error);
  }
  if (!data) return failure("That contract could not be found.");

  if (data.document_path) {
    const { error: removeError } = await billingStorage().remove([data.document_path]);
    if (removeError) console.error("[billing] Contract PDF not removed", removeError.message);
  }

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "contract.deleted",
    entity: "contract",
    entity_id: id,
    metadata: { label: data.title },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${data.title} removed.` };
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = invoiceCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Choose a client first.", fieldErrorsFrom(parsed.error));
  const { organizationId, contractId } = parsed.data;

  const supabase = createClient();
  let currency: Currency = "INR";
  if (contractId) {
    const { data: contract } = await supabase
      .from("contracts")
      .select("currency")
      .eq("id", contractId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!contract) return failure("That contract belongs to a different client.", { contractId: "Choose one of this client's contracts." });
    currency = contract.currency as Currency;
  }

  const { data, error } = await supabase
    .from("invoices")
    .insert({ organization_id: organizationId, contract_id: contractId, currency })
    .select("id")
    .single();
  if (error || !data) return error ? dbFailure(error) : failure("The invoice could not be created.");

  revalidatePath("/staff", "layout");
  redirect(portalHref(`/staff/billing/${data.id}`));
}

export async function saveInvoiceDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = invoiceDraftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  if (input.intent === "issue" && !input.items.length) {
    return failure("Add at least one line item before issuing.", { items: "Add at least one line item." });
  }

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!existing) return failure("That invoice could not be found.");
  if (existing.status !== "draft") return failure("Issued invoices are locked. Void it and issue a new one to make changes.");

  const { error } = await supabase
    .from("invoices")
    .update({
      contract_id: input.contractId,
      currency: input.currency,
      tax_rate_bps: input.taxRate,
      due_date: input.dueDate,
      bill_to: input.billTo,
      notes: input.notes,
    })
    .eq("id", input.id);
  if (error) {
    if (error.code === "P0001") return failure("Please review the highlighted fields.", { contractId: error.message });
    return dbFailure(error);
  }

  const { error: itemsError } = await supabase.rpc("replace_invoice_items", {
    p_invoice: input.id,
    p_items: input.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPrice,
    })),
  });
  if (itemsError) {
    if (itemsError.code === "P0001" || itemsError.code === "23514") {
      return failure("Please review the line items.", { items: itemsError.code === "P0001" ? itemsError.message : "Check each line item's amounts." });
    }
    return dbFailure(itemsError);
  }

  if (input.intent === "save") {
    revalidatePath("/staff", "layout");
    return { status: "success", message: "Draft saved." };
  }
  return issueInvoice(input.id, input.organizationId, input.sendEmail);
}

async function issueInvoice(id: string, organizationId: string, notify: boolean): Promise<ActionState> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "issued" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .select("number, due_date, currency, total_cents")
    .maybeSingle();
  if (error) {
    if (error.code === "P0001") {
      const field = /due date/i.test(error.message) ? "dueDate" : "items";
      return failure(error.message, { [field]: error.message });
    }
    return dbFailure(error);
  }
  if (!data?.number) return failure("Only draft invoices can be issued.");

  const currency = data.currency as Currency;
  const pdfStored = await storeInvoicePdf(id);

  await logActivity(supabase, {
    organization_id: organizationId,
    action: "invoice.issued",
    entity: "invoice",
    entity_id: id,
    metadata: { label: data.number, total_cents: data.total_cents, currency },
  });

  // The draft editor unmounts once the invoice is issued, so the outcome travels in the URL.
  const outcome = new URLSearchParams({ issued: "1" });
  if (notify) {
    const sent = await notifyInvoiceIssued(organizationId, {
      number: data.number,
      total: formatMoney(data.total_cents, currency),
      dueDate: formatDay(data.due_date),
    });
    outcome.set("emailed", String(sent));
  }
  if (!pdfStored) outcome.set("pdf", "failed");

  revalidatePath("/", "layout");
  redirect(`${portalHref(`/staff/billing/${id}`)}?${outcome.toString()}`);
}

/** Renders the invoice PDF from the database copy and stores it at the conventional path. */
async function storeInvoicePdf(id: string) {
  const supabase = createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, organization_id, contract_id, number, issue_date, due_date, currency, subtotal_cents, tax_rate_bps, tax_cents, total_cents, bill_to, notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!invoice?.number || !invoice.issue_date || !invoice.due_date) return false;

  const [{ data: org }, { data: items }, { data: contract }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", invoice.organization_id).maybeSingle(),
    supabase
      .from("invoice_items")
      .select("description, quantity, unit_price_cents, amount_cents")
      .eq("invoice_id", id)
      .order("sort_order"),
    invoice.contract_id
      ? supabase.from("contracts").select("title").eq("id", invoice.contract_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  try {
    const bytes = await renderInvoicePdf({
      number: invoice.number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      currency: invoice.currency as Currency,
      subtotalCents: invoice.subtotal_cents,
      taxRateBps: invoice.tax_rate_bps,
      taxCents: invoice.tax_cents,
      totalCents: invoice.total_cents,
      organizationName: org?.name ?? "Client",
      billTo: invoice.bill_to,
      contractTitle: contract?.title ?? null,
      notes: invoice.notes,
      items: (items ?? []).map((item) => ({
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceCents: item.unit_price_cents,
        amountCents: item.amount_cents,
      })),
    });

    const path = invoicePdfPath(invoice.organization_id, invoice.id);
    const { error: uploadError } = await billingStorage().upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase.from("invoices").update({ pdf_path: path }).eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    console.error("[billing] Invoice PDF failed", err);
    return false;
  }
}

export async function regenerateInvoicePdf(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That invoice could not be found.");

  const ok = await storeInvoicePdf(parsed.data.id);
  revalidatePath("/", "layout");
  return ok ? { status: "success", message: "PDF regenerated." } : failure("The PDF could not be generated. Check the storage settings and try again.");
}

export async function markInvoicePaid(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = invoicePaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({
      status: "paid",
      payment_reference: input.reference,
      ...(input.paidOn ? { paid_at: new Date(`${input.paidOn}T12:00:00+05:30`).toISOString() } : {}),
    })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .in("status", ["issued", "overdue"])
    .select("number")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("Only issued or overdue invoices can be marked paid.");

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "invoice.paid",
    entity: "invoice",
    entity_id: input.id,
    metadata: { label: data.number, reference: input.reference },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${data.number} marked paid.` };
}

export async function voidInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = invoiceVoidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Please review the highlighted fields.", fieldErrorsFrom(parsed.error));
  const input = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .in("status", ["issued", "overdue"])
    .select("number")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("Only issued or overdue invoices can be voided.");

  await logActivity(supabase, {
    organization_id: input.organizationId,
    action: "invoice.voided",
    entity: "invoice",
    entity_id: input.id,
    metadata: { label: data.number, reason: input.reason },
  });

  revalidatePath("/", "layout");
  return { status: "success", message: `${data.number} voided.` };
}

export async function deleteDraftInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const parsed = recordRefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("That invoice could not be found.");
  const { id, organizationId } = parsed.data;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return dbFailure(error);
  if (!data) return failure("Only drafts can be deleted. Void issued invoices instead.");

  revalidatePath("/staff", "layout");
  redirect(portalHref("/staff/billing"));
}

export async function runOverdueCheck(_: ActionState): Promise<ActionState> {
  if (!(await staffContext())) return notStaff();
  const { data, error } = await createClient().rpc("mark_overdue_invoices");
  if (error) return dbFailure(error);

  revalidatePath("/", "layout");
  const changed = data ?? 0;
  return {
    status: "success",
    message: changed ? `${changed} ${changed === 1 ? "invoice" : "invoices"} marked overdue.` : "No invoices are newly overdue.",
  };
}

/** Emails client owners and admins; delivery problems never block issuing. */
async function notifyInvoiceIssued(organizationId: string, invoice: { number: string; total: string; dueDate: string }) {
  const supabase = createClient();
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle(),
    supabase.from("memberships").select("user_id, role").eq("organization_id", organizationId).in("role", ["owner", "admin", "manager"]),
  ]);
  await sendPushToUsers((members ?? []).map((m) => m.user_id), {
    title: `Invoice ${invoice.number}`,
    body: `${invoice.total} due ${invoice.dueDate}`,
    data: { screen: "billing", organizationId },
  });
  if (!isEmailConfigured() || !hasVerifiedSender()) return 0;

  const profiles = await getProfiles(
    (members ?? []).filter((m) => m.role !== "manager").map((m) => m.user_id),
  );
  const link = portalUrl("app", "/app/billing", requestHost());

  let sent = 0;
  for (const profile of Array.from(profiles.values())) {
    if (!profile.email) continue;
    try {
      await sendEmail({
        to: profile.email,
        replyTo: siteConfig.email,
        ...invoiceIssuedEmail({
          number: invoice.number,
          organizationName: org?.name ?? "your organisation",
          total: invoice.total,
          dueDate: invoice.dueDate,
          recipientName: profile.full_name,
          link,
        }),
      });
      sent++;
    } catch (err) {
      console.error("[billing] Invoice email failed", err);
    }
  }
  return sent;
}
