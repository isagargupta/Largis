"use client";

import { useFormState } from "react-dom";
import { Field, FormAlert, SubmitButton, TextareaField } from "@/components/portal/forms";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { updateOnboardingHr } from "@/lib/portal/actions/onboarding";
import type { OnboardingStatus } from "@/lib/supabase/types";

export function ReviewActions({
  id,
  status,
  notes,
  salary,
  expired,
}: {
  id: string;
  status: OnboardingStatus;
  notes: string | null;
  salary: number | null;
  expired: boolean;
}) {
  const [state, action] = useFormState(updateOnboardingHr, idleState);
  const open = status === "open";

  return (
    <div className="space-y-4">
      <FormAlert state={state} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <Field
            name="offered_monthly_inr"
            label="Monthly salary (₹)"
            errors={state.fieldErrors}
            defaultValue={salary ? String(salary) : ""}
            inputMode="numeric"
            hint="What will be credited. The employee doesn't see this."
          />
          <TextareaField name="staff_notes" label="Internal notes" errors={state.fieldErrors} defaultValue={notes ?? ""} rows={3} className="min-h-[88px]" />
        </div>
        <div className="flex flex-wrap gap-3">
          <SubmitButton name="intent" value="save" pendingLabel="Saving…" variant="outline" size="sm">
            Save notes
          </SubmitButton>
          {status === "submitted" || status === "reviewed" ? (
            <SubmitButton name="intent" value="review" pendingLabel="Saving…" size="sm">
              {status === "reviewed" ? "Save and keep reviewed" : "Mark as reviewed"}
            </SubmitButton>
          ) : null}
        </div>
      </form>
      {open && (
        <div className="flex flex-wrap gap-3">
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton name="intent" value="extend" pendingLabel="Extending…" variant="outline" size="sm">
              {expired ? "Renew link for 30 days" : "Extend link by 30 days"}
            </SubmitButton>
          </form>
          <form action={action}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton name="intent" value="revoke" pendingLabel="Revoking…" variant="ghost" size="sm">
              Revoke link
            </SubmitButton>
          </form>
        </div>
      )}
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm("Delete this onboarding record and its documents? This cannot be undone.")) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <SubmitButton name="intent" value="delete" pendingLabel="Deleting…" variant="ghost" size="sm">
          Delete record
        </SubmitButton>
      </form>
    </div>
  );
}
