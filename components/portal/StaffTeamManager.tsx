"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { MailPlus, Pencil, UserPlus, Users } from "lucide-react";
import { CopyButton, Field, FormAlert, Modal, SelectField, SubmitButton } from "@/components/portal/forms";
import { EmptyState, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { inviteStaff, updateStaffMember } from "@/lib/portal/actions/staff";
import { revokeInvitation } from "@/lib/portal/actions/team";
import { formatDate } from "@/lib/portal/format";
import { staffRoleLabel, staffRoleScope, staffRoles } from "@/lib/portal/meta";
import type { StaffRole } from "@/lib/supabase/types";

export type StaffDirectoryEntry = {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
  title: string | null;
  active: boolean;
  joinedAt: string;
};

export type StaffInvite = {
  id: string;
  email: string;
  fullName: string | null;
  role: StaffRole;
  title: string | null;
  createdAt: string;
  link: string;
};

export function StaffTeamManager({
  members,
  invitations,
  canManage,
  currentUserId,
}: {
  members: StaffDirectoryEntry[];
  invitations: StaffInvite[] | null;
  canManage: boolean;
  currentUserId: string;
}) {
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<StaffDirectoryEntry | null>(null);
  const [flash, setFlash] = useState<ActionState>(idleState);
  const active = members.filter((m) => m.active).length;

  const report = useCallback((state: ActionState) => {
    if (state.status !== "idle") setFlash(state);
  }, []);
  const closeInvite = useCallback((state: ActionState) => {
    setInviting(false);
    setFlash(state);
  }, []);
  const closeEdit = useCallback((state: ActionState) => {
    setEditing(null);
    setFlash(state);
  }, []);

  return (
    <div className="space-y-6">
      {canManage && (
        <div>
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4" />
            Invite employee
          </Button>
        </div>
      )}

      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />

      <Panel title={`Staff (${active} active)`}>
        {members.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No staff members yet" />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li
                key={m.userId}
                className="grid gap-2 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] md:items-center md:gap-6"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.userId === currentUserId && <span className="ml-2 text-xs font-normal text-ink-subtle">(you)</span>}
                  </p>
                  {m.name !== m.email && <p className="break-all text-xs text-ink-subtle">{m.email}</p>}
                </div>
                <div className="min-w-0 text-xs text-ink-muted">
                  <p className="truncate">{m.title || "No title"}</p>
                  <p className="text-ink-subtle">Joined {formatDate(m.joinedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <Badge tone={m.role === "admin" ? "brand" : "neutral"}>{staffRoleLabel[m.role]}</Badge>
                  {!m.active && <Badge tone="danger">Deactivated</Badge>}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit<span className="sr-only"> {m.name}</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {invitations && (
        <Panel title={`Pending invitations (${invitations.length})`}>
          {invitations.length === 0 ? (
            <EmptyState icon={<MailPlus className="h-5 w-5" />} title="No pending invitations" />
          ) : (
            <ul className="divide-y divide-line">
              {invitations.map((inv) => (
                <InvitationRow key={inv.id} invite={inv} onResult={report} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      {!canManage && (
        <p className="text-sm text-ink-subtle">Only staff admins can invite employees or change roles.</p>
      )}

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite an employee"
        description="They sign in to Largis Workspace with a one-time code sent to this address."
      >
        {inviting && <InviteForm onDone={closeInvite} onCancel={() => setInviting(false)} />}
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit staff member"}
        description={editing?.email}
      >
        {editing && (
          <EditForm
            member={editing}
            isYou={editing.userId === currentUserId}
            onDone={closeEdit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function InvitationRow({ invite, onResult }: { invite: StaffInvite; onResult: (s: ActionState) => void }) {
  const [state, action] = useFormState(revokeInvitation, idleState);
  useEffect(() => onResult(state), [state, onResult]);

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm">{invite.fullName ? `${invite.fullName} · ${invite.email}` : invite.email}</p>
        <p className="text-xs text-ink-subtle">
          {staffRoleLabel[invite.role]}
          {invite.title && ` · ${invite.title}`} · invited {formatDate(invite.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <CopyButton value={invite.link} label="Copy sign-in link" />
        <form action={action}>
          <input type="hidden" name="invitationId" value={invite.id} />
          <SubmitButton variant="ghost" size="sm" className="text-red-700" pendingLabel="Revoking…">
            Revoke
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

function InviteForm({ onDone, onCancel }: { onDone: (s: ActionState) => void; onCancel: () => void }) {
  const [state, action] = useFormState(inviteStaff, idleState);

  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <Field name="email" label="Work email" type="email" autoComplete="off" errors={state.fieldErrors} required autoFocus />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="fullName" label="Name (optional)" errors={state.fieldErrors} />
        <Field name="title" label="Job title (optional)" placeholder="Support lead" errors={state.fieldErrors} />
      </div>
      <SelectField name="role" label="Staff role" defaultValue="agent" errors={state.fieldErrors}>
        {staffRoles.map((r) => (
          <option key={r} value={r}>
            {staffRoleLabel[r]} — {staffRoleScope[r]}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Inviting…">Send invitation</SubmitButton>
      </div>
    </form>
  );
}

function EditForm({
  member,
  isYou,
  onDone,
  onCancel,
}: {
  member: StaffDirectoryEntry;
  isYou: boolean;
  onDone: (s: ActionState) => void;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(updateStaffMember, idleState);

  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="userId" value={member.userId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField name="role" label="Staff role" defaultValue={member.role} errors={state.fieldErrors}>
          {staffRoles.map((r) => (
            <option key={r} value={r}>
              {staffRoleLabel[r]}
            </option>
          ))}
        </SelectField>
        <Field name="title" label="Job title" defaultValue={member.title ?? ""} errors={state.fieldErrors} />
      </div>
      {isYou ? (
        <input type="hidden" name="active" value="true" />
      ) : (
        <SelectField
          name="active"
          label="Access"
          defaultValue={member.active ? "true" : "false"}
          errors={state.fieldErrors}
        >
          <option value="true">Active — can sign in to Largis Workspace</option>
          <option value="false">Deactivated — no staff access</option>
        </SelectField>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
