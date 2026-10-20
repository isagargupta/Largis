import { z } from "zod";
import { MAX_ATTACHMENTS } from "@/lib/attachments";
import { MAX_ARTICLE_LENGTH } from "@/lib/knowledge";
import {
  billingCycles,
  contractStatuses,
  currencies,
  engagementStatuses,
  enquiryStatuses,
  milestoneStatuses,
  orgRoles,
  orgStatuses,
  serviceLines,
  staffRoles,
  ticketChannels,
  ticketPriorities,
  ticketStatuses,
} from "@/lib/portal/meta";
import { leadStages } from "@/lib/revenue/stages";
import type { AssignmentMode, SuggestionKind } from "@/lib/supabase/types";

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .email("Enter a valid email address.");

const uuid = z.string().uuid();
const blank = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v == null ? "" : v), schema);
const optionalText = (max: number) =>
  blank(
    z
      .string()
      .trim()
      .max(max, `Keep this under ${max} characters.`)
      .transform((v) => v || null),
  );
const optionalUuid = blank(z.union([uuid, z.literal("")]).transform((v) => v || null));
const checkbox = z.preprocess((v) => v === "on" || v === "true", z.boolean());

/** Uploaded files as JSON (forms send a string); the database re-checks each one. */
const attachmentsField = z.preprocess(
  (v) => {
    if (v == null || v === "") return [];
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z
    .array(z.object({ path: z.string().min(1).max(300), name: z.string().trim().min(1).max(200) }), {
      message: "The attachments could not be read. Remove them and try again.",
    })
    .max(MAX_ATTACHMENTS, `Attach up to ${MAX_ATTACHMENTS} files at a time.`),
);

export const otpSendSchema = z.object({ email: emailField });

export const otpVerifySchema = z.object({
  email: emailField,
  token: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from your email."),
  next: z.string().max(200).optional(),
});

const totpCode = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .refine((v) => /^\d{6}$/.test(v), "Enter the 6-digit code from your authenticator app.");

export const mfaVerifySchema = z.object({
  factorId: uuid,
  code: totpCode,
  next: z.string().max(200).optional(),
});

export const mfaEnrollVerifySchema = z.object({ factorId: uuid, code: totpCode });

export const mfaEnrollSchema = z.object({
  friendlyName: blank(
    z
      .string()
      .trim()
      .max(60, "Keep the name under 60 characters.")
      .transform((v) => v || "Authenticator app"),
  ),
});

export const mfaRemoveSchema = z.object({ factorId: uuid });

export const staffMfaSettingSchema = z.object({ requireStaffMfa: checkbox });

const money = blank(
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[,\s$]/g, ""))
    .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount, e.g. 25000.")
    .transform((v) => (v === "" ? null : Math.round(Number(v) * 100))),
);

function withLeadIdentity<T extends z.ZodObject>(schema: T) {
  return schema.superRefine((input, ctx) => {
    const lead = input as { company?: string | null; contactEmail?: string | null; phone?: string | null };
    const company = lead.company?.trim() ?? "";
    if (company.length === 1) {
      ctx.addIssue({ code: "custom", path: ["company"], message: "Enter the company name." });
    }
    if (company.length < 2 && !lead.contactEmail && !lead.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["company"],
        message: "Enter a company, or a phone or email for this contact.",
      });
    }
  });
}

const leadObject = z.object({
  organizationId: uuid,
  company: blank(z.string().trim().max(160, "Keep this under 160 characters.").transform((v) => v || null)),
  contactName: z.string().trim().min(2, "Enter a contact name.").max(120),
  contactEmail: blank(
    z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address.")
      .transform((v) => v || null),
  ),
  phone: optionalText(40),
  serviceAddress: optionalText(300),
  jobType: optionalText(80),
  lostReason: optionalText(500),
  stage: z.enum(leadStages, { message: "Choose a stage." }),
  value: money,
  ownerId: optionalUuid,
  source: optionalText(60),
  notes: optionalText(5000),
});

export const leadSchema = withLeadIdentity(leadObject);
export const leadUpdateSchema = withLeadIdentity(leadObject.extend({ id: uuid }));

const dueAt = blank(
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v), "Enter a due date and time.")
    .transform((v) => {
      if (!v) return null;
      const normalised = v.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(v) ? v : `${v.slice(0, 16)}:00Z`;
      return new Date(normalised).toISOString();
    }),
);

export const taskSchema = z.object({
  organizationId: uuid,
  leadId: uuid,
  title: z.string().trim().min(1, "Enter the follow-up.").max(200),
  dueAt,
  ownerId: optionalUuid,
});

export const taskStatusSchema = z.object({
  organizationId: uuid,
  leadId: uuid,
  id: uuid,
  status: z.enum(["open", "done"]),
});

export const suggestionSchema = z.object({
  organizationId: uuid,
  leadId: uuid,
  kind: z.enum(["summary", "reply", "next_action"] satisfies [SuggestionKind, ...SuggestionKind[]]),
});

export const suggestionDecisionSchema = z.object({
  organizationId: uuid,
  leadId: uuid,
  id: uuid,
});

const assignmentModes = ["manual", "round_robin", "fixed"] as const satisfies readonly AssignmentMode[];

export const assignmentSchema = z
  .object({
    organizationId: uuid,
    mode: z.enum(assignmentModes, { message: "Choose how leads are assigned." }),
    fixedOwnerId: optionalUuid,
  })
  .superRefine((input, ctx) => {
    if (input.mode === "fixed" && !input.fixedOwnerId) {
      ctx.addIssue({ code: "custom", path: ["fixedOwnerId"], message: "Choose the owner." });
    }
  });

export const inviteMemberSchema = z.object({
  organizationId: uuid,
  email: emailField,
  fullName: optionalText(120),
  role: z.enum(orgRoles, { message: "Choose a role." }),
});

export const memberRoleSchema = z.object({
  organizationId: uuid,
  userId: uuid,
  role: z.enum(orgRoles),
});

export const memberRemoveSchema = z.object({ organizationId: uuid, userId: uuid });

export const invitationRevokeSchema = z.object({ invitationId: uuid, organizationId: uuid.optional() });

export const enquiryUpdateSchema = z.object({
  id: uuid,
  status: z.enum(enquiryStatuses),
  assignedTo: optionalUuid,
  internalNotes: optionalText(10000),
});

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Enter a short identifier.")
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2, "Enter the client's name.").max(160),
  slug: slugField,
  plan: optionalText(40),
  region: optionalText(40),
  ownerEmail: emailField,
  ownerName: optionalText(120),
  enquiryId: optionalUuid,
});

export const clientUpdateSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2, "Enter the client's name.").max(160),
  plan: optionalText(40),
  region: optionalText(40),
  status: z.enum(orgStatuses),
  requireMfa: checkbox,
});

export const staffInviteSchema = z.object({
  email: emailField,
  fullName: optionalText(120),
  role: z.enum(staffRoles, { message: "Choose a role." }),
  title: optionalText(120),
});

export const staffUpdateSchema = z.object({
  userId: uuid,
  role: z.enum(staffRoles),
  title: optionalText(120),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

const optionalEmail = blank(
  z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address.")
    .transform((v) => v || null),
);

const optionalDate = blank(
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), "Enter a valid date.")
    .transform((v) => v || null),
);

const optionalMinutes = blank(
  z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d{1,6}$/.test(v) && Number(v) >= 1 && Number(v) <= 525600), "Enter whole minutes, 1 or more.")
    .transform((v) => (v === "" ? null : Number(v))),
);

export const ticketCreateSchema = z.object({
  organizationId: uuid,
  subject: z.string().trim().min(3, "Enter a short subject.").max(200, "Keep the subject under 200 characters."),
  description: z.string().trim().min(1, "Describe what you need help with.").max(10000, "Keep this under 10,000 characters."),
  priority: z.enum(ticketPriorities, { message: "Choose a priority." }),
  channel: blank(z.union([z.enum(ticketChannels), z.literal("")]).transform((v) => v || "portal")),
  requesterName: optionalText(120),
  requesterEmail: optionalEmail,
  assignedTo: optionalUuid,
  attachments: attachmentsField,
});

export const ticketReplySchema = z
  .object({
    ticketId: uuid,
    body: blank(z.string().trim().max(10000, "Keep replies under 10,000 characters.")),
    internal: checkbox,
    nextStatus: blank(z.union([z.enum(ticketStatuses), z.literal("")]).transform((v) => v || null)),
    attachments: attachmentsField,
  })
  .refine((v) => v.body || v.attachments.length, { message: "Write a reply first.", path: ["body"] });

export const chatMessageSchema = z
  .object({
    organizationId: uuid,
    body: blank(z.string().trim().max(4000, "Keep messages under 4,000 characters.")),
    attachments: attachmentsField,
  })
  .refine((v) => v.body || v.attachments.length, { message: "Write a message first.", path: ["body"] });

export const ticketUpdateSchema = z.object({
  id: uuid,
  status: z.enum(ticketStatuses),
  priority: z.enum(ticketPriorities),
  assignedTo: optionalUuid,
});

export const ticketClientStatusSchema = z.object({ id: uuid, status: z.enum(["resolved", "open"]) });

export const slaPolicySchema = z.object({
  organizationId: uuid,
  urgentFirstResponse: optionalMinutes,
  urgentResolution: optionalMinutes,
  highFirstResponse: optionalMinutes,
  highResolution: optionalMinutes,
  normalFirstResponse: optionalMinutes,
  normalResolution: optionalMinutes,
  lowFirstResponse: optionalMinutes,
  lowResolution: optionalMinutes,
});

const endAfterStart = (start: string | null, end: string | null) => !start || !end || end >= start;

export const engagementSchema = z
  .object({
    id: optionalUuid,
    organizationId: uuid,
    name: z.string().trim().min(2, "Name the engagement.").max(160),
    serviceLine: z.enum(serviceLines, { message: "Choose a service line." }),
    status: z.enum(engagementStatuses, { message: "Choose a status." }),
    startDate: optionalDate,
    endDate: optionalDate,
    ownerStaffId: optionalUuid,
    summary: optionalText(5000),
  })
  .refine((d) => endAfterStart(d.startDate, d.endDate), { message: "End on or after the start date.", path: ["endDate"] });

export const milestoneSchema = z.object({
  id: optionalUuid,
  organizationId: uuid,
  engagementId: uuid,
  title: z.string().trim().min(2, "Enter a milestone title.").max(200),
  dueDate: optionalDate,
  status: blank(z.union([z.enum(milestoneStatuses), z.literal("")]).transform((v) => v || "pending")),
  sortOrder: blank(
    z
      .string()
      .trim()
      .refine((v) => v === "" || /^-?\d{1,4}$/.test(v), "Enter a whole number.")
      .transform((v) => (v === "" ? null : Number(v))),
  ),
});

export const milestoneStatusSchema = z.object({ id: uuid, organizationId: uuid, status: z.enum(milestoneStatuses) });

export const recordRefSchema = z.object({ id: uuid, organizationId: uuid });

export const reportCreateSchema = z
  .object({
    organizationId: uuid,
    title: z.string().trim().min(2, "Give the report a title.").max(200),
    engagementId: optionalUuid,
    periodStart: optionalDate,
    periodEnd: optionalDate,
  })
  .refine((d) => endAfterStart(d.periodStart, d.periodEnd), { message: "End on or after the start date.", path: ["periodEnd"] });

export const reportSaveSchema = z
  .object({
    id: uuid,
    organizationId: uuid,
    title: z.string().trim().min(2, "Give the report a title.").max(200),
    engagementId: optionalUuid,
    periodStart: optionalDate,
    periodEnd: optionalDate,
    summary: optionalText(2000),
    body: blank(z.string().max(100000, "Keep the report under 100,000 characters.")),
    intent: z.enum(["save", "publish", "unpublish"]),
  })
  .refine((d) => endAfterStart(d.periodStart, d.periodEnd), { message: "End on or after the start date.", path: ["periodEnd"] });

const MAX_AMOUNT_UNITS = 100_000_000_000;

/** A non-negative amount in major units ("1,18,000.50") converted to minor units. */
const amountField = (message = "Enter an amount, e.g. 45000.") =>
  blank(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[,\s₹$€£]/g, ""))
      .refine((v) => v === "" || (/^\d{1,12}(\.\d{1,2})?$/.test(v) && Number(v) <= MAX_AMOUNT_UNITS), message)
      .transform((v) => (v === "" ? 0 : Math.round(Number(v) * 100))),
  );

export const contractSchema = z
  .object({
    id: optionalUuid,
    organizationId: uuid,
    title: z.string().trim().min(2, "Give the contract a title.").max(200),
    serviceLine: z.enum(serviceLines, { message: "Choose a service line." }),
    status: z.enum(contractStatuses, { message: "Choose a status." }),
    billingCycle: z.enum(billingCycles, { message: "Choose a billing cycle." }),
    currency: z.enum(currencies, { message: "Choose a currency." }),
    monthlyValue: amountField(),
    startDate: optionalDate,
    endDate: optionalDate,
    notes: optionalText(5000),
  })
  .refine((d) => endAfterStart(d.startDate, d.endDate), { message: "End on or after the start date.", path: ["endDate"] });

export const invoiceCreateSchema = z.object({ organizationId: uuid, contractId: optionalUuid });

const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, "Describe each line item.").max(500, "Keep line item descriptions under 500 characters."),
  quantity: z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}(\.\d{1,2})?$/.test(v) && Number(v) > 0 && Number(v) <= 1_000_000, "Quantities must be above 0.")
    .transform(Number),
  unitPrice: z
    .string()
    .trim()
    .transform((v) => v.replace(/[,\s₹$€£]/g, ""))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v) && Number(v) <= MAX_AMOUNT_UNITS, "Enter each unit price, e.g. 45000.")
    .transform((v) => Math.round(Number(v) * 100)),
});

export type InvoiceItemInput = z.input<typeof invoiceItemSchema>;

export const invoiceDraftSchema = z.object({
  id: uuid,
  organizationId: uuid,
  contractId: optionalUuid,
  currency: z.enum(currencies, { message: "Choose a currency." }),
  taxRate: z
    .string()
    .trim()
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100, "Enter a GST rate between 0 and 100.")
    .transform((v) => Math.round(Number(v) * 100)),
  dueDate: optionalDate,
  billTo: optionalText(1000),
  notes: optionalText(2000),
  items: z.preprocess(
    (v) => {
      try {
        return JSON.parse(String(v ?? "[]"));
      } catch {
        return null;
      }
    },
    z.array(invoiceItemSchema, { message: "Line items could not be read. Reload and try again." }).max(100, "Use at most 100 line items."),
  ),
  intent: z.enum(["save", "issue"]),
  sendEmail: checkbox,
});

export const invoicePaidSchema = z.object({
  id: uuid,
  organizationId: uuid,
  reference: optionalText(120),
  paidOn: optionalDate,
});

export const invoiceVoidSchema = z.object({
  id: uuid,
  organizationId: uuid,
  reason: optionalText(500),
});

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const knowledgeArticleSchema = z.object({
  id: optionalUuid,
  title: z.string().trim().min(3, "Give the article a clear title.").max(200, "Keep the title under 200 characters."),
  category: optionalText(60),
  body: z
    .string()
    .trim()
    .min(40, "Add a bit more detail so Largis AI has something to work with.")
    .max(MAX_ARTICLE_LENGTH, `Keep articles under ${MAX_ARTICLE_LENGTH.toLocaleString("en-IN")} characters; split longer ones.`),
});

export const knowledgeUploadSchema = z.object({
  name: z.string().trim().min(1).max(200, "Rename the file to something shorter (under 200 characters)."),
  type: z.string().max(200),
  size: z.number().int().nonnegative(),
  category: optionalText(60),
});

export function fieldErrorsFrom(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
