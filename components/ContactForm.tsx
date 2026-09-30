"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { serviceInterests, siteConfig, type ServiceInterest } from "@/lib/site";
import { contactSchema, type ContactFieldErrors } from "@/lib/validations/contact";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm({ defaultInterest }: { defaultInterest?: ServiceInterest }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));

    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      const next: ContactFieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ContactFieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      form.querySelector<HTMLElement>(`[name="${Object.keys(next)[0]}"]`)?.focus();
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("submitting");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; fieldErrors?: ContactFieldErrors };

      if (!res.ok || !data.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        setFormError(data.error ?? "Please review the highlighted fields.");
        setStatus("error");
        return;
      }

      form.reset();
      setStatus("success");
    } catch {
      setFormError(`Network error. Please try again or email ${siteConfig.email}.`);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rule-accent pt-10" role="status">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        <h2 className="mt-6 text-3xl">Thank you. We have your request.</h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-muted">
          {siteConfig.responseSla} We will reply to the email address you provided.
        </p>
        <Button variant="outline" className="mt-8" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  const fieldProps = (name: keyof ContactFieldErrors) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    disabled: status === "submitting",
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {formError}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input {...fieldProps("name")} autoComplete="name" />
          <FieldError id="name-error" message={errors.name} />
        </div>
        <div>
          <Label htmlFor="email">Business email</Label>
          <Input {...fieldProps("email")} type="email" autoComplete="email" />
          <FieldError id="email-error" message={errors.email} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="company">Company name</Label>
          <Input {...fieldProps("company")} autoComplete="organization" />
          <FieldError id="company-error" message={errors.company} />
        </div>
        <div>
          <Label htmlFor="interest">Service interest</Label>
          <div className="relative">
            <Select {...fieldProps("interest")} defaultValue={defaultInterest ?? ""}>
              <option value="" disabled>
                Select a service
              </option>
              {serviceInterests.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          </div>
          <FieldError id="interest-error" message={errors.interest} />
        </div>
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          {...fieldProps("message")}
          placeholder="Your current systems, team size, and what you would like to change."
        />
        <FieldError id="message-error" message={errors.message} />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          We use your details only to respond. See our{" "}
          <Link href="/legal/privacy" className="text-ink underline underline-offset-4 hover:text-brand-600">
            Privacy Policy
          </Link>
          .
        </p>
        <Button type="submit" size="lg" disabled={status === "submitting"}>
          {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "submitting" ? "Sending…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
