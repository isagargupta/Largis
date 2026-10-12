"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SelectField, SubmitButton } from "@/components/portal/forms";
import { idleState } from "@/lib/portal/action-state";
import { updateClientOrganization } from "@/lib/portal/actions/staff";
import { orgStatusMeta, orgStatuses, planOptions, regionSuggestions } from "@/lib/portal/meta";
import type { OrgStatus } from "@/lib/supabase/types";

export function ClientSettingsForm({
  client,
}: {
  client: { id: string; name: string; plan: string | null; region: string | null; status: OrgStatus };
}) {
  const [state, action] = useFormState(updateClientOrganization, idleState);
  const plans: string[] = client.plan && !(planOptions as readonly string[]).includes(client.plan)
    ? [...planOptions, client.plan]
    : [...planOptions];

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={client.id} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Client name" defaultValue={client.name} errors={state.fieldErrors} required />
        <SelectField name="status" label="Status" defaultValue={client.status} errors={state.fieldErrors}>
          {orgStatuses.map((s) => (
            <option key={s} value={s}>
              {orgStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <SelectField name="plan" label="Plan" defaultValue={client.plan ?? ""} errors={state.fieldErrors}>
          <option value="">Not set</option>
          {plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <Field
          name="region"
          label="Data region"
          list="client-region-suggestions"
          defaultValue={client.region ?? ""}
          errors={state.fieldErrors}
        />
        <datalist id="client-region-suggestions">
          {regionSuggestions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>
      <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
    </form>
  );
}
