"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Upload } from "lucide-react";
import { FormAlert, Modal, SubmitButton } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { importLeads } from "@/lib/portal/actions/revenue";

export function ImportLeads({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(importLeads, idleState);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        Import CSV
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Import leads" description="Up to 500 rows. Duplicates are skipped.">
        <form action={action} className="space-y-5">
          <FormAlert state={state} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <p className="text-sm leading-relaxed text-ink-muted">
            The first row should name the columns. Contact, phone, email, company, source, stage, value, notes, address, and job are
            recognised. Stage must match one of this organisation&apos;s labels.
          </p>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-ink file:mr-3 file:border file:border-line file:bg-paper-soft file:px-3 file:py-2 file:text-sm"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
