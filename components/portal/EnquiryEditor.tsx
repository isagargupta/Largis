"use client";

import { useFormState } from "react-dom";
import { FormAlert, SelectField, SubmitButton } from "@/components/portal/forms";
import { Label, Textarea } from "@/components/ui/field";
import { idleState } from "@/lib/portal/action-state";
import { updateEnquiry } from "@/lib/portal/actions/staff";
import { enquiryStatusMeta, enquiryStatuses } from "@/lib/portal/meta";
import type { EnquiryStatus } from "@/lib/supabase/types";

export type StaffOption = { id: string; name: string };

export function EnquiryEditor({
  enquiry,
  staff,
}: {
  enquiry: { id: string; status: EnquiryStatus; assignedTo: string | null; internalNotes: string | null };
  staff: StaffOption[];
}) {
  const [state, action] = useFormState(updateEnquiry, idleState);
  const assignable =
    enquiry.assignedTo && !staff.some((s) => s.id === enquiry.assignedTo)
      ? [...staff, { id: enquiry.assignedTo, name: "Former staff member" }]
      : staff;

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={enquiry.id} />
      <SelectField name="status" label="Status" defaultValue={enquiry.status} errors={state.fieldErrors}>
        {enquiryStatuses.map((s) => (
          <option key={s} value={s}>
            {enquiryStatusMeta[s].label}
          </option>
        ))}
      </SelectField>
      <SelectField name="assignedTo" label="Assigned to" defaultValue={enquiry.assignedTo ?? ""} errors={state.fieldErrors}>
        <option value="">Unassigned</option>
        {assignable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <div>
        <Label htmlFor="internalNotes">Internal notes</Label>
        <Textarea
          id="internalNotes"
          name="internalNotes"
          defaultValue={enquiry.internalNotes ?? ""}
          maxLength={10000}
          placeholder="Only visible to Largis staff."
          aria-invalid={state.fieldErrors?.internalNotes ? true : undefined}
          className="min-h-[140px]"
        />
        {state.fieldErrors?.internalNotes && (
          <p className="mt-1.5 text-sm text-red-700">{state.fieldErrors.internalNotes}</p>
        )}
      </div>
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        Save changes
      </SubmitButton>
    </form>
  );
}
