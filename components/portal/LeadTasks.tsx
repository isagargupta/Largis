"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { Field, FormAlert, SelectField, SubmitButton } from "@/components/portal/forms";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/portal/action-state";
import { createTask, deleteTask, setTaskStatus } from "@/lib/portal/actions/tasks";
import { formatDateTime } from "@/lib/portal/format";
import type { RolePermissions } from "@/lib/portal/meta";
import type { LeadTaskStatus } from "@/lib/supabase/types";
import type { MemberOption } from "@/components/portal/LeadsManager";

export type TaskRow = {
  id: string;
  title: string;
  owner_id: string | null;
  due_at: string | null;
  status: LeadTaskStatus;
};

export function LeadTasks({
  organizationId,
  leadId,
  tasks,
  members,
  perms,
  canEdit,
}: {
  organizationId: string;
  leadId: string;
  tasks: TaskRow[];
  members: MemberOption[];
  perms: RolePermissions;
  canEdit: boolean;
}) {
  const open = tasks.filter((task) => task.status === "open");
  const done = tasks.filter((task) => task.status === "done");
  const names = new Map(members.map((member) => [member.id, member.name]));
  const now = Date.now();

  return (
    <section className="border border-line bg-white">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-semibold">Follow-ups</h2>
      </div>
      {canEdit && <TaskForm organizationId={organizationId} leadId={leadId} members={members} canAssign={perms.canAssign} />}
      {tasks.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-subtle sm:px-5">No follow-ups yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {[...open, ...done].map((task) => {
            const overdue = task.status === "open" && task.due_at && new Date(task.due_at).getTime() < now;
            return (
              <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className={task.status === "done" ? "text-sm text-ink-subtle line-through" : "text-sm"}>{task.title}</p>
                  <p className={`mt-1 text-xs ${overdue ? "text-red-700" : "text-ink-subtle"}`}>
                    {task.owner_id ? names.get(task.owner_id) ?? "Former member" : "Unassigned"}
                    {task.due_at ? ` · ${overdue ? "Overdue" : "Due"} ${formatDateTime(task.due_at)}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-3">
                    <StatusButton
                      organizationId={organizationId}
                      leadId={leadId}
                      task={task}
                      next={task.status === "open" ? "done" : "open"}
                    />
                    <DeleteButton organizationId={organizationId} leadId={leadId} taskId={task.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskForm({
  organizationId,
  leadId,
  members,
  canAssign,
}: {
  organizationId: string;
  leadId: string;
  members: MemberOption[];
  canAssign: boolean;
}) {
  const [state, action] = useFormState(createTask, idleState);
  useEffect(() => {
    if (state.status === "success") {
      const form = document.getElementById(`task-form-${leadId}`) as HTMLFormElement | null;
      form?.reset();
    }
  }, [state, leadId]);

  return (
    <form id={`task-form-${leadId}`} action={action} className="space-y-4 border-b border-line px-4 py-4 sm:px-5">
      <FormAlert state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="title" label="Follow-up" errors={state.fieldErrors} required />
        <Field name="dueAt" label="Due (UTC)" type="datetime-local" errors={state.fieldErrors} />
      </div>
      {canAssign && (
        <SelectField name="ownerId" label="Owner" errors={state.fieldErrors} defaultValue="">
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </SelectField>
      )}
      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Adding…">
          Add follow-up
        </SubmitButton>
      </div>
    </form>
  );
}

function StatusButton({
  organizationId,
  leadId,
  task,
  next,
}: {
  organizationId: string;
  leadId: string;
  task: TaskRow;
  next: "open" | "done";
}) {
  const [state, action] = useFormState(setTaskStatus, idleState);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="status" value={next} />
      {state.status === "error" && <FormAlert state={state} />}
      <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">
        {next === "done" ? "Mark done" : "Reopen"}
      </SubmitButton>
    </form>
  );
}

function DeleteButton({ organizationId, leadId, taskId }: { organizationId: string; leadId: string; taskId: string }) {
  const [state, action] = useFormState(deleteTask, idleState);
  return (
    <form action={action}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="id" value={taskId} />
      {state.status === "error" && <FormAlert state={state} />}
      <Button type="submit" variant="ghost" size="sm">
        Remove
      </Button>
    </form>
  );
}
