"use client";

import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { Field, FormAlert, SelectField, SubmitButton } from "@/components/portal/forms";
import { employmentOptions, shiftOptions, workModeOptions } from "@/lib/onboarding/schema";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { createOnboarding } from "@/lib/portal/actions/onboarding";
import { portalHref } from "@/lib/portal/hosts";

export function InviteForm() {
  const router = useRouter();
  const [state, action] = useFormState(async (prev: ActionState, formData: FormData) => {
    const result = await createOnboarding(prev, formData);
    if (result.id) router.push(portalHref(`/staff/onboarding/${result.id}`));
    return result;
  }, idleState);

  return (
    <form action={action} className="space-y-5">
      <FormAlert state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="invite_name" label="Full name" errors={state.fieldErrors} required maxLength={120} autoComplete="name" placeholder="The name you know them by" />
        <Field name="invite_email" label="Personal email" errors={state.fieldErrors} required type="email" autoComplete="email" />
        <Field name="invite_phone" label="Mobile number" errors={state.fieldErrors} type="tel" inputMode="numeric" hint="Optional. They can correct it on the form." autoComplete="tel" />
        <Field name="designation" label="Role" errors={state.fieldErrors} maxLength={120} hint="Optional. Prefilled on their form." placeholder="Support specialist" />
        <Field name="department" label="Department" errors={state.fieldErrors} maxLength={80} hint="Optional." />
        <SelectField name="employment_type" label="Employment type" errors={state.fieldErrors}>
          <option value="">They&apos;ll choose</option>
          {employmentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField name="work_mode" label="Where they'll work" errors={state.fieldErrors}>
          <option value="">They&apos;ll choose</option>
          {workModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <Field name="joining_date" label="Date of joining" errors={state.fieldErrors} type="date" hint="Optional." />
        <SelectField name="shift_preference" label="Shift" errors={state.fieldErrors}>
          <option value="">Optional</option>
          {shiftOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>
      <SubmitButton pendingLabel="Creating link…">Create joining link</SubmitButton>
    </form>
  );
}
