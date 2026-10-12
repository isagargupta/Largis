import { z } from "zod";
import { enquiryStatuses, orgRoles, orgStatuses, stageOrder, staffRoles } from "@/lib/portal/meta";

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

export const otpSendSchema = z.object({ email: emailField });

export const otpVerifySchema = z.object({
  email: emailField,
  token: z.string().trim().regex(/^\d{6,10}$/, "Enter the code from your email."),
  next: z.string().max(200).optional(),
});

export const leadSchema = z.object({
  organizationId: uuid,
  company: z.string().trim().min(2, "Enter the company name.").max(160),
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
  stage: z.enum(stageOrder, { message: "Choose a stage." }),
  value: blank(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[,\s$]/g, ""))
      .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "Enter an amount, e.g. 25000.")
      .transform((v) => (v === "" ? null : Math.round(Number(v) * 100))),
  ),
  ownerId: optionalUuid,
  source: optionalText(60),
  notes: optionalText(5000),
});

export const leadUpdateSchema = leadSchema.extend({ id: uuid });

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

export function fieldErrorsFrom(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
