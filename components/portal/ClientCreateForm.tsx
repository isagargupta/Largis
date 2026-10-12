"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { Field, FormAlert, SelectField, ShareLink, SubmitButton } from "@/components/portal/forms";
import { ButtonLink } from "@/components/ui/button";
import { idleState } from "@/lib/portal/action-state";
import { createClientOrganization } from "@/lib/portal/actions/staff";
import { portalHref } from "@/lib/portal/hosts";
import { planOptions, regionSuggestions } from "@/lib/portal/meta";
import { slugify } from "@/lib/validations/portal";

export type ClientPrefill = { name: string; ownerEmail: string; ownerName: string; enquiryId: string | null };

export function ClientCreateForm({ prefill }: { prefill: ClientPrefill }) {
  const [state, action] = useFormState(createClientOrganization, idleState);
  const [name, setName] = useState(prefill.name);
  const [slug, setSlug] = useState(slugify(prefill.name));
  const [slugEdited, setSlugEdited] = useState(false);

  if (state.status === "success" && state.id) {
    return (
      <div role="status" className="space-y-5">
        <div className="flex items-start gap-3 border-l-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{state.message}</p>
            {state.link && <ShareLink link={state.link} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={portalHref(`/staff/clients/${state.id}`)}>Open client</ButtonLink>
          <Link
            href={portalHref("/staff/clients")}
            className="inline-flex h-11 items-center px-2 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Back to clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      {prefill.enquiryId && <input type="hidden" name="enquiryId" value={prefill.enquiryId} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="name"
          label="Client name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          errors={state.fieldErrors}
          autoComplete="organization"
          required
        />
        <Field
          name="slug"
          label="Identifier"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value.toLowerCase());
            setSlugEdited(true);
          }}
          hint="Lowercase letters, numbers, and hyphens. Used in exports."
          errors={state.fieldErrors}
          spellCheck={false}
          required
        />
        <SelectField name="plan" label="Plan" defaultValue="" errors={state.fieldErrors}>
          <option value="">Not set</option>
          {planOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <Field name="region" label="Data region" list="region-suggestions" placeholder="ap-south-1" errors={state.fieldErrors} />
        <datalist id="region-suggestions">
          {regionSuggestions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <fieldset className="border-t border-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Client owner</legend>
        <p className="mt-1 text-sm text-ink-muted">
          They receive the Owner role and can invite the rest of their team.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            name="ownerEmail"
            label="Owner email"
            type="email"
            defaultValue={prefill.ownerEmail}
            autoComplete="off"
            errors={state.fieldErrors}
            required
          />
          <Field name="ownerName" label="Owner name (optional)" defaultValue={prefill.ownerName} errors={state.fieldErrors} />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Creating…">Create client and invite owner</SubmitButton>
        <Link
          href={portalHref("/staff/clients")}
          className="px-2 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
