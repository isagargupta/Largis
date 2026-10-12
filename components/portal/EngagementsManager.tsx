"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { Briefcase, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Field, FormAlert, Modal, SelectBox, SelectField, SubmitButton, TextareaField } from "@/components/portal/forms";
import type { Option } from "@/components/portal/SupportForms";
import { EmptyState, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import {
  deleteEngagement,
  deleteMilestone,
  saveEngagement,
  saveMilestone,
  setMilestoneStatus,
} from "@/lib/portal/actions/delivery";
import { formatDay, formatPeriod } from "@/lib/portal/format";
import {
  engagementStatuses,
  engagementStatusMeta,
  milestoneStatuses,
  milestoneStatusMeta,
  serviceLineLabel,
  serviceLines,
} from "@/lib/portal/meta";
import type { EngagementStatus, MilestoneStatus, ServiceLine } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export type MilestoneView = {
  id: string;
  title: string;
  dueDate: string | null;
  status: MilestoneStatus;
  completedAt: string | null;
  sortOrder: number;
};

export type EngagementView = {
  id: string;
  name: string;
  serviceLine: ServiceLine;
  status: EngagementStatus;
  startDate: string | null;
  endDate: string | null;
  ownerStaffId: string | null;
  ownerName: string | null;
  summary: string | null;
  milestones: MilestoneView[];
};

type Report = (s: ActionState) => void;

export function EngagementsManager({
  organizationId,
  engagements,
  staff,
  today,
}: {
  organizationId: string;
  engagements: EngagementView[];
  staff: Option[];
  today: string;
}) {
  const [editing, setEditing] = useState<EngagementView | "new" | null>(null);
  const [flash, setFlash] = useState<ActionState>(idleState);
  const report = useCallback((state: ActionState) => {
    if (state.status !== "idle") setFlash(state);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          New engagement
        </Button>
      </div>

      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />

      {engagements.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<Briefcase className="h-5 w-5" />} title="No engagements yet">
            Add an engagement for each service line you run for this client, then break it into milestones the client can
            follow on their overview.
          </EmptyState>
        </div>
      ) : (
        engagements.map((e) => (
          <EngagementCard
            key={e.id}
            organizationId={organizationId}
            engagement={e}
            today={today}
            onEdit={() => setEditing(e)}
            onResult={report}
          />
        ))
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New engagement" : "Edit engagement"}
        description="Clients see the name, status, dates, summary, and milestones."
      >
        {editing !== null && (
          <EngagementForm
            organizationId={organizationId}
            engagement={editing === "new" ? null : editing}
            staff={staff}
            onDone={(state) => {
              setEditing(null);
              setFlash(state);
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function EngagementCard({
  organizationId,
  engagement: e,
  today,
  onEdit,
  onResult,
}: {
  organizationId: string;
  engagement: EngagementView;
  today: string;
  onEdit: () => void;
  onResult: Report;
}) {
  const [deleteState, deleteAction] = useFormState(deleteEngagement, idleState);
  const [confirming, setConfirming] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<MilestoneView | null>(null);
  useEffect(() => onResult(deleteState), [deleteState, onResult]);

  const status = engagementStatusMeta[e.status];
  const done = e.milestones.filter((m) => m.status === "done").length;
  const total = e.milestones.length;
  const period = formatPeriod(e.startDate, e.endDate);

  return (
    <section id={`engagement-${e.id}`} className="scroll-mt-24 border border-line bg-white">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">{e.name}</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            {[serviceLineLabel[e.serviceLine], period, e.ownerName ? `Owner: ${e.ownerName}` : "No owner"].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit<span className="sr-only"> {e.name}</span>
          </button>
          <form action={deleteAction} className="inline-flex items-center gap-2">
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="organizationId" value={organizationId} />
            {confirming ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Removing…">
                  Remove engagement
                </SubmitButton>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove<span className="sr-only"> {e.name}</span>
              </button>
            )}
          </form>
        </div>
      </div>

      {e.summary && <p className="whitespace-pre-wrap border-b border-line px-4 py-3 text-sm text-ink-muted sm:px-5">{e.summary}</p>}

      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4 text-xs text-ink-subtle">
          <span>Milestones</span>
          <span className="tabular-nums">
            {done} of {total} done
          </span>
        </div>
        <div className="mt-2 h-1.5 bg-neutral-100" aria-hidden="true">
          <div className="h-full bg-emerald-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>

        {total > 0 && (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {e.milestones.map((m) => (
              <MilestoneRow
                key={m.id}
                organizationId={organizationId}
                milestone={m}
                today={today}
                onEdit={() => setEditingMilestone(m)}
                onResult={onResult}
              />
            ))}
          </ul>
        )}

        <AddMilestoneForm organizationId={organizationId} engagementId={e.id} onResult={onResult} />
      </div>

      <Modal open={editingMilestone !== null} onClose={() => setEditingMilestone(null)} title="Edit milestone">
        {editingMilestone && (
          <MilestoneForm
            organizationId={organizationId}
            engagementId={e.id}
            milestone={editingMilestone}
            onDone={(state) => {
              setEditingMilestone(null);
              onResult(state);
            }}
            onCancel={() => setEditingMilestone(null)}
          />
        )}
      </Modal>
    </section>
  );
}

function MilestoneRow({
  organizationId,
  milestone: m,
  today,
  onEdit,
  onResult,
}: {
  organizationId: string;
  milestone: MilestoneView;
  today: string;
  onEdit: () => void;
  onResult: Report;
}) {
  const [statusState, statusAction] = useFormState(setMilestoneStatus, idleState);
  const [deleteState, deleteAction] = useFormState(deleteMilestone, idleState);
  const statusForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (statusState.status === "error") statusForm.current?.reset();
    onResult(statusState);
  }, [statusState, onResult]);
  useEffect(() => onResult(deleteState), [deleteState, onResult]);

  const overdue = m.status !== "done" && m.dueDate !== null && m.dueDate < today;

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", m.status === "done" && "text-ink-subtle line-through decoration-ink-subtle/50")}>{m.title}</p>
        <p className={cn("text-xs", overdue ? "text-red-700" : "text-ink-subtle")}>
          {m.status === "done" && m.completedAt
            ? `Completed ${formatDay(m.completedAt)}`
            : m.dueDate
              ? `${overdue ? "Overdue · was due" : "Due"} ${formatDay(m.dueDate)}`
              : "No due date"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <form ref={statusForm} action={statusAction} className="w-36">
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <SelectBox
            key={m.status}
            compact
            name="status"
            defaultValue={m.status}
            aria-label={`Status for ${m.title}`}
            onChange={() => statusForm.current?.requestSubmit()}
          >
            {milestoneStatuses.map((s) => (
              <option key={s} value={s}>
                {milestoneStatusMeta[s].label}
              </option>
            ))}
          </SelectBox>
        </form>
        {m.status !== "done" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="status" value="done" />
            <button
              type="submit"
              title="Mark as done"
              className="grid h-8 w-8 place-items-center border border-line text-ink-muted hover:border-emerald-600 hover:text-emerald-700"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Mark {m.title} as done</span>
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="grid h-8 w-8 place-items-center text-ink-muted hover:text-ink"
          title="Edit milestone"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit {m.title}</span>
        </button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <button type="submit" className="grid h-8 w-8 place-items-center text-ink-muted hover:text-red-700" title="Remove milestone">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Remove {m.title}</span>
          </button>
        </form>
      </div>
    </li>
  );
}

function AddMilestoneForm({
  organizationId,
  engagementId,
  onResult,
}: {
  organizationId: string;
  engagementId: string;
  onResult: Report;
}) {
  const [state, action] = useFormState(saveMilestone, idleState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") {
      form.current?.reset();
      onResult(state);
    }
  }, [state, onResult]);

  return (
    <form ref={form} action={action} noValidate className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`ms-title-${engagementId}`} className="sr-only">
          Milestone title
        </label>
        <input
          id={`ms-title-${engagementId}`}
          name="title"
          placeholder="Add a milestone"
          maxLength={200}
          aria-invalid={state.fieldErrors?.title ? true : undefined}
          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 aria-[invalid=true]:border-red-600"
        />
        {state.status === "error" && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors?.title ?? state.fieldErrors?.dueDate ?? state.message}</p>
        )}
      </div>
      <div>
        <label htmlFor={`ms-due-${engagementId}`} className="sr-only">
          Due date
        </label>
        <input
          id={`ms-due-${engagementId}`}
          name="dueDate"
          type="date"
          className="w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 sm:w-40"
        />
      </div>
      <SubmitButton size="sm" variant="outline" pendingLabel="Adding…">
        <Plus className="h-4 w-4" />
        Add
      </SubmitButton>
    </form>
  );
}

function MilestoneForm({
  organizationId,
  engagementId,
  milestone,
  onDone,
  onCancel,
}: {
  organizationId: string;
  engagementId: string;
  milestone: MilestoneView;
  onDone: Report;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(saveMilestone, idleState);
  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={milestone.id} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="engagementId" value={engagementId} />
      <Field name="title" label="Title" defaultValue={milestone.title} errors={state.fieldErrors} maxLength={200} required />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field name="dueDate" label="Due date" type="date" defaultValue={milestone.dueDate ?? ""} errors={state.fieldErrors} />
        <SelectField name="status" label="Status" defaultValue={milestone.status} errors={state.fieldErrors}>
          {milestoneStatuses.map((s) => (
            <option key={s} value={s}>
              {milestoneStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <Field
          name="sortOrder"
          label="Order"
          inputMode="numeric"
          defaultValue={String(milestone.sortOrder)}
          errors={state.fieldErrors}
          hint="Lower numbers first."
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">Save milestone</SubmitButton>
      </div>
    </form>
  );
}

function EngagementForm({
  organizationId,
  engagement,
  staff,
  onDone,
  onCancel,
}: {
  organizationId: string;
  engagement: EngagementView | null;
  staff: Option[];
  onDone: Report;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(saveEngagement, idleState);
  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  const owners =
    engagement?.ownerStaffId && !staff.some((s) => s.id === engagement.ownerStaffId)
      ? [...staff, { id: engagement.ownerStaffId, name: engagement.ownerName ?? "Former staff member" }]
      : staff;

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      {engagement && <input type="hidden" name="id" value={engagement.id} />}
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field name="name" label="Name" defaultValue={engagement?.name} errors={state.fieldErrors} maxLength={160} required autoFocus />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="serviceLine" label="Service line" defaultValue={engagement?.serviceLine ?? "support"} errors={state.fieldErrors}>
          {serviceLines.map((s) => (
            <option key={s} value={s}>
              {serviceLineLabel[s]}
            </option>
          ))}
        </SelectField>
        <SelectField name="status" label="Status" defaultValue={engagement?.status ?? "planning"} errors={state.fieldErrors}>
          {engagementStatuses.map((s) => (
            <option key={s} value={s}>
              {engagementStatusMeta[s].label}
            </option>
          ))}
        </SelectField>
        <Field name="startDate" label="Start date" type="date" defaultValue={engagement?.startDate ?? ""} errors={state.fieldErrors} />
        <Field name="endDate" label="End date" type="date" defaultValue={engagement?.endDate ?? ""} errors={state.fieldErrors} />
      </div>
      <SelectField name="ownerStaffId" label="Largis owner" defaultValue={engagement?.ownerStaffId ?? ""} errors={state.fieldErrors}>
        <option value="">No owner yet</option>
        {owners.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <TextareaField
        name="summary"
        label="Summary"
        defaultValue={engagement?.summary ?? ""}
        errors={state.fieldErrors}
        maxLength={5000}
        className="min-h-[110px]"
        hint="Scope and goals in a few sentences. Visible to the client."
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">{engagement ? "Save engagement" : "Add engagement"}</SubmitButton>
      </div>
    </form>
  );
}
