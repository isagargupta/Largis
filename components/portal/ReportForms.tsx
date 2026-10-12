"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Eye, FilePlus2, PenLine, Trash2 } from "lucide-react";
import { Field, FormAlert, Modal, SelectField, SubmitButton, TextareaField } from "@/components/portal/forms";
import { Markdown } from "@/components/portal/Markdown";
import type { Option } from "@/components/portal/SupportForms";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/portal/action-state";
import { createReport, deleteReport, saveReport } from "@/lib/portal/actions/delivery";
import type { ReportStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function NewReportButton({ organizationId, engagements }: { organizationId: string; engagements: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FilePlus2 className="h-4 w-4" />
        New report
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New report" description="Starts as a draft. Clients see it only once you publish.">
        {open && <NewReportForm organizationId={organizationId} engagements={engagements} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function NewReportForm({
  organizationId,
  engagements,
  onCancel,
}: {
  organizationId: string;
  engagements: Option[];
  onCancel: () => void;
}) {
  const [state, action] = useFormState(createReport, idleState);
  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field name="title" label="Title" placeholder="e.g. Support operations — October" errors={state.fieldErrors} maxLength={200} required autoFocus />
      <EngagementSelect engagements={engagements} errors={state.fieldErrors} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="periodStart" label="Period start" type="date" errors={state.fieldErrors} />
        <Field name="periodEnd" label="Period end" type="date" errors={state.fieldErrors} />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
      </div>
    </form>
  );
}

function EngagementSelect({
  engagements,
  defaultValue = "",
  errors,
}: {
  engagements: Option[];
  defaultValue?: string;
  errors?: Record<string, string>;
}) {
  return (
    <SelectField name="engagementId" label="Engagement" defaultValue={defaultValue} errors={errors}>
      <option value="">Not linked to an engagement</option>
      {engagements.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </SelectField>
  );
}

export type EditableReport = {
  id: string;
  organizationId: string;
  title: string;
  engagementId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  summary: string | null;
  body: string;
  status: ReportStatus;
};

const syntaxHelp = [
  ["# Heading", "Section heading"],
  ["**bold**  *italic*", "Emphasis"],
  ["- item  /  1. item", "Lists"],
  ["[label](https://…)", "Link"],
  ["| A | B |  then  |---|---|", "Table"],
  ["> note", "Callout"],
] as const;

export function ReportEditor({ report, engagements }: { report: EditableReport; engagements: Option[] }) {
  const [state, action] = useFormState(saveReport, idleState);
  const [body, setBody] = useState(report.body);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const published = report.status === "published";

  return (
    <div className="space-y-6">
      <form action={action} noValidate className="space-y-6">
        <FormAlert state={state} />
        <input type="hidden" name="id" value={report.id} />
        <input type="hidden" name="organizationId" value={report.organizationId} />

        <div className="border border-line bg-white p-4 sm:p-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Field name="title" label="Title" defaultValue={report.title} errors={state.fieldErrors} maxLength={200} required />
            </div>
            <EngagementSelect engagements={engagements} defaultValue={report.engagementId ?? ""} errors={state.fieldErrors} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field name="periodStart" label="Period start" type="date" defaultValue={report.periodStart ?? ""} errors={state.fieldErrors} />
              <Field name="periodEnd" label="Period end" type="date" defaultValue={report.periodEnd ?? ""} errors={state.fieldErrors} />
            </div>
            <div className="lg:col-span-2">
              <TextareaField
                name="summary"
                label="Summary"
                defaultValue={report.summary ?? ""}
                errors={state.fieldErrors}
                maxLength={2000}
                className="min-h-[90px]"
                hint="Two or three sentences shown in the report list and the notification email."
              />
            </div>
          </div>
        </div>

        <section className="border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
            <h2 className="text-[15px] font-semibold">Report</h2>
            <div role="tablist" aria-label="Editor mode" className="flex gap-1">
              {(
                [
                  ["write", "Write", PenLine],
                  ["preview", "Preview", Eye],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`report-${id}`}
                  onClick={() => setTab(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                    tab === id ? "border-gold-500 text-ink" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div id="report-write" role="tabpanel" hidden={tab !== "write"} className="p-4 sm:p-5">
            <label htmlFor="report-body" className="sr-only">
              Report body (Markdown)
            </label>
            <textarea
              id="report-body"
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={100000}
              spellCheck
              aria-invalid={state.fieldErrors?.body ? true : undefined}
              placeholder={"## Highlights\n\n- Median first response: 6 minutes\n- 1,240 chats handled\n\n## Next month\n\n…"}
              className="min-h-[420px] w-full resize-y border border-[#d6d0c4] bg-white px-4 py-3 font-mono text-[13px] leading-relaxed text-ink focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 aria-[invalid=true]:border-red-600"
            />
            {state.fieldErrors?.body && <p className="mt-1.5 text-sm text-red-700">{state.fieldErrors.body}</p>}
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-ink-subtle sm:grid-cols-2 lg:grid-cols-3">
              {syntaxHelp.map(([syntax, label]) => (
                <div key={label} className="flex gap-2">
                  <dt className="font-mono text-ink-muted">{syntax}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div id="report-preview" role="tabpanel" hidden={tab !== "preview"} className="p-4 sm:p-6">
            {body.trim() ? (
              <Markdown source={body} className="max-w-3xl" />
            ) : (
              <p className="text-sm text-ink-subtle">Nothing to preview yet.</p>
            )}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {published ? (
            <>
              <SubmitButton variant="outline" name="intent" value="unpublish" pendingLabel="Unpublishing…">
                Unpublish
              </SubmitButton>
              <SubmitButton name="intent" value="save" pendingLabel="Saving…">
                Save changes
              </SubmitButton>
            </>
          ) : (
            <>
              <SubmitButton variant="outline" name="intent" value="save" pendingLabel="Saving…">
                Save draft
              </SubmitButton>
              <SubmitButton name="intent" value="publish" pendingLabel="Publishing…">
                Publish to client
              </SubmitButton>
            </>
          )}
        </div>
      </form>

      {!published && <DeleteDraft id={report.id} organizationId={report.organizationId} />}
    </div>
  );
}

function DeleteDraft({ id, organizationId }: { id: string; organizationId: string }) {
  const [state, action] = useFormState(deleteReport, idleState);
  const [confirming, setConfirming] = useState(false);
  return (
    <form action={action} className="flex flex-col items-start gap-3 border-t border-line pt-6">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="organizationId" value={organizationId} />
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-muted">Delete this draft permanently?</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Deleting…">
            Delete draft
          </SubmitButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-800"
        >
          <Trash2 className="h-4 w-4" />
          Delete draft
        </button>
      )}
    </form>
  );
}
