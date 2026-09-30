import { z } from "zod";
import { serviceInterests } from "@/lib/site";

const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"];

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(254)
    .refine((v) => !FREE_EMAIL_DOMAINS.includes(v.split("@")[1] ?? ""), {
      message: "Please use your business email address.",
    }),
  company: z.string().trim().min(2, "Please enter your company name.").max(160),
  interest: z.enum(serviceInterests, { message: "Please select a service." }),
  message: z.string().trim().min(20, "Please share a few details (at least 20 characters).").max(5000),
  // Honeypot: must stay empty. Bots that auto-fill every field are silently dropped.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactFieldErrors = Partial<Record<keyof ContactInput, string>>;
