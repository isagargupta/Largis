"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { Field, FormAlert, Modal, SelectField, SubmitButton, TextareaField } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/portal/action-state";
import { createTicket, replyToTicket, saveSlaPolicy, setTicketStatus, updateTicket } from "@/lib/portal/actions/support";
import {
  defaultSla,
  ticketChannelLabel,
  ticketChannels,
  ticketPriorities,
  ticketPriorityMeta,
  ticketStatuses,
  ticketStatusMeta,
} from "@/lib/portal/meta";
import { formatDuration, isClosedStatus } from "@/lib/portal/sla";
import type { TicketPriority, TicketStatus } from "@/lib/supabase/types";

export type Option = { id: string; name: string };

function withCurrent(options: Option[], currentId: string | null, fallback: string) {
  return currentId && !options.some((o) => o.id === currentId) ? [...options, { id: currentId, name: fallback }] : options;
}

export function NewTicketButton({
  organizationId,
  organizations,
  staff,
  label = "New ticket",
}: {
  /** Fixed organization; staff without one pick from `organizations`. */
  organizationId?: string;
  organizations?: Option[];
  /** Present only for Largis staff, who can also set channel, requester, and assignee. */
  staff?: Option[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={staff ? "Log a ticket" : "Open a support ticket"}
        description={
          staff
            ? "Record a request that came in by email, chat, or phone."
            : "Tell us what you need. The Largis support team replies here and by email."
        }
      >
        {open && (
          <TicketCreateForm
            organizationId={organizationId}
            organizations={organizations}
            staff={staff}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

function TicketCreateForm({
  organizationId,
  organizations,
  staff,
  onCancel,
}: {
  organizationId?: string;
  organizations?: Option[];
  staff?: Option[];
  onCancel: () => void;
}) {
  const [state, action] = useFormState(createTicket, idleState);
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const target = defaultSla[priority];

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      {organizationId ? (
        <input type="hidden" name="organizationId" value={organizationId} />
      ) : (
        <SelectField name="organizationId" label="Client" errors={state.fieldErrors} defaultValue="" required>
          <option value="" disabled>
            Choose a client
          </option>
          {(organizations ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </SelectField>
      )}
      <Field name="subject" label="Subject" errors={state.fieldErrors} maxLength={200} required autoFocus />
      <div>
        <SelectField
          name="priority"
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TicketPriority)}
          errors={state.fieldErrors}
        >
          {ticketPriorities.map((p) => (
            <option key={p} value={p}>
              {ticketPriorityMeta[p].label}
            </option>
          ))}
        </SelectField>
        <p className="mt-1.5 text-xs text-ink-subtle">
          Standard targets: first response within {formatDuration(target.firstResponse)}, resolution within{" "}
          {formatDuration(target.resolution)}.
        </p>
      </div>
      <TextareaField
        name="description"
        label={staff ? "Details" : "What do you need help with?"}
        errors={state.fieldErrors}
        maxLength={10000}
        required
      />
      {staff && (
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField name="channel" label="Received via" defaultValue="email" errors={state.fieldErrors}>
            {ticketChannels.map((c) => (
              <option key={c} value={c}>
                {ticketChannelLabel[c]}
              </option>
            ))}
          </SelectField>
          <SelectField name="assignedTo" label="Assign to" defaultValue="" errors={state.fieldErrors}>
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <Field name="requesterName" label="Requester name" errors={state.fieldErrors} maxLength={120} />
          <Field
            name="requesterEmail"
            label="Requester email"
            type="email"
            autoComplete="off"
            errors={state.fieldErrors}
            hint="Public replies are emailed here when email is set up."
          />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Opening…">{staff ? "Log ticket" : "Open ticket"}</SubmitButton>
      </div>
    </form>
  );
}

export function TicketReplyForm({
  ticketId,
  status,
  staff = false,
}: {
  ticketId: string;
  status: TicketStatus;
  staff?: boolean;
}) {
  const [state, action] = useFormState(replyToTicket, idleState);
  const [internal, setInternal] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      form.current?.reset();
      setInternal(false);
    }
  }, [state]);

  return (
    <form ref={form} action={action} noValidate className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="ticketId" value={ticketId} />
      <TextareaField
        name="body"
        label={internal ? "Internal note" : staff ? "Reply to the client" : "Your reply"}
        errors={state.fieldErrors}
        maxLength={10000}
        className={internal ? "min-h-[120px] border-amber-300 bg-amber-50/40" : "min-h-[120px]"}
        placeholder={internal ? "Only visible to Largis staff." : undefined}
        hint={!staff && isClosedStatus(status) ? "Replying reopens this ticket." : undefined}
        required
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {staff ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="internal"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Internal note
            </label>
            <div className="sm:w-56">
              <SelectField name="nextStatus" label="Then set status" defaultValue="">
                <option value="">Keep {ticketStatusMeta[status].label.toLowerCase()}</option>
                {(["pending_client", "in_progress", "resolved"] as const)
                  .filter((s) => s !== status)
                  .map((s) => (
                    <option key={s} value={s}>
                      {ticketStatusMeta[s].label}
                    </option>
                  ))}
              </SelectField>
            </div>
          </div>
        ) : (
          <span />
        )}
        <SubmitButton pendingLabel="Sending…" variant={internal ? "dark" : "primary"}>
          {internal ? "Add note" : "Send reply"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function TicketStatusButton({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const [state, action] = useFormState(setTicketStatus, idleState);
  const closed = isClosedStatus(status);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={ticketId} />
      <input type="hidden" name="status" value={closed ? "open" : "resolved"} />
      <SubmitButton variant="outline" size="sm" pendingLabel={closed ? "Reopening…" : "Saving…"}>
        {closed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {closed ? "Reopen ticket" : "Mark as resolved"}
      </SubmitButton>
      {state.status === "error" && <FormAlert state={state} />}
    </form>
  );
}

export function TicketControls({
  ticket,
  staff,
}: {
  ticket: { id: string; status: TicketStatus; priority: TicketPriority; assignedTo: string | null };
  staff: Option[];
}) {
  const [state, action] = useFormState(updateTicket, idleState);
  const assignable = withCurrent(staff, ticket.assignedTo, "Former staff member");

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={ticket.id} />
      <SelectField name="status" label="Status" defaultValue={ticket.status} errors={state.fieldErrors}>
        {ticketStatuses.map((s) => (
          <option key={s} value={s}>
            {ticketStatusMeta[s].label}
          </option>
        ))}
      </SelectField>
      <SelectField name="priority" label="Priority" defaultValue={ticket.priority} errors={state.fieldErrors}>
        {ticketPriorities.map((p) => (
          <option key={p} value={p}>
            {ticketPriorityMeta[p].label}
          </option>
        ))}
      </SelectField>
      <SelectField name="assignedTo" label="Assigned to" defaultValue={ticket.assignedTo ?? ""} errors={state.fieldErrors}>
        <option value="">Unassigned</option>
        {assignable.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <p className="text-xs text-ink-subtle">Changing the priority resets the SLA targets to that priority&apos;s defaults.</p>
      <SubmitButton pendingLabel="Saving…" className="w-full sm:w-auto">
        Save changes
      </SubmitButton>
    </form>
  );
}

export type SlaOverrides = Partial<Record<TicketPriority, { firstResponse: number | null; resolution: number | null }>>;

export function SlaPolicyForm({ organizationId, overrides }: { organizationId: string; overrides: SlaOverrides }) {
  const [state, action] = useFormState(saveSlaPolicy, idleState);
  const input =
    "w-full border border-[#d6d0c4] bg-white px-3 py-2 text-sm tabular-nums focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 aria-[invalid=true]:border-red-600";

  return (
    <form action={action} noValidate className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-paper-soft">
            <tr className="border-b border-line text-ink-subtle">
              <th scope="col" className="px-3 py-2.5 font-normal">Priority</th>
              <th scope="col" className="px-3 py-2.5 font-normal">First response (minutes)</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Resolution (minutes)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ticketPriorities.map((p) => {
              const fr = `${p}FirstResponse`;
              const res = `${p}Resolution`;
              return (
                <tr key={p}>
                  <th scope="row" className="px-3 py-2.5 font-normal">
                    {ticketPriorityMeta[p].label}
                  </th>
                  <td className="px-3 py-2.5">
                    <input
                      name={fr}
                      inputMode="numeric"
                      aria-label={`${ticketPriorityMeta[p].label} first response target in minutes`}
                      aria-invalid={state.fieldErrors?.[fr] ? true : undefined}
                      defaultValue={overrides[p]?.firstResponse ?? ""}
                      placeholder={`${defaultSla[p].firstResponse} (default)`}
                      className={input}
                    />
                    {state.fieldErrors?.[fr] && <p className="mt-1 text-xs text-red-700">{state.fieldErrors[fr]}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      name={res}
                      inputMode="numeric"
                      aria-label={`${ticketPriorityMeta[p].label} resolution target in minutes`}
                      aria-invalid={state.fieldErrors?.[res] ? true : undefined}
                      defaultValue={overrides[p]?.resolution ?? ""}
                      placeholder={`${defaultSla[p].resolution} (default)`}
                      className={input}
                    />
                    {state.fieldErrors?.[res] && <p className="mt-1 text-xs text-red-700">{state.fieldErrors[res]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-subtle">
        Leave a field blank to use the Largis default. New targets apply to tickets opened after you save.
      </p>
      <SubmitButton size="sm" pendingLabel="Saving…">
        Save SLA targets
      </SubmitButton>
    </form>
  );
}
