"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { MailPlus, Trash2, UserPlus, Users } from "lucide-react";
import { CopyButton, Field, FormAlert, Modal, SelectBox, SelectField, SubmitButton } from "@/components/portal/forms";
import { EmptyState, Panel } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { idleState, type ActionState } from "@/lib/portal/action-state";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/lib/portal/actions/team";
import { formatDate } from "@/lib/portal/format";
import { orgRoles, rolePermissions } from "@/lib/portal/meta";
import type { OrgRole } from "@/lib/supabase/types";

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
  isYou: boolean;
};

export type PendingInvite = {
  id: string;
  email: string;
  fullName: string | null;
  role: OrgRole;
  createdAt: string;
  link: string;
};

export function TeamManager({
  organizationId,
  members,
  invitations,
  canManage,
  canGrantOwner,
}: {
  organizationId: string;
  members: TeamMember[];
  invitations: PendingInvite[] | null;
  canManage: boolean;
  canGrantOwner: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const [flash, setFlash] = useState<ActionState>(idleState);
  const ownerCount = members.filter((m) => m.role === "owner").length;
  const assignable = canGrantOwner ? orgRoles : orgRoles.filter((r) => r !== "owner");

  const report = useCallback((state: ActionState) => {
    if (state.status !== "idle") setFlash(state);
  }, []);

  return (
    <div className="space-y-6">
      {canManage && (
        <div>
          <Button size="sm" onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4" />
            Invite member
          </Button>
        </div>
      )}

      <FormAlert state={flash} onDismiss={() => setFlash(idleState)} />

      <Panel title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No members yet">
            Invite the client&apos;s owner to get started.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-paper-soft">
                <tr className="border-b border-line text-ink-subtle">
                  <th scope="col" className="px-4 py-3 font-normal">Name</th>
                  <th scope="col" className="px-4 py-3 font-normal">Role</th>
                  <th scope="col" className="px-4 py-3 font-normal">Joined</th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <MemberRow
                    key={m.userId}
                    organizationId={organizationId}
                    member={m}
                    roles={assignable}
                    editable={canManage && (canGrantOwner || m.role !== "owner")}
                    lastOwner={m.role === "owner" && ownerCount === 1}
                    onResult={report}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {invitations && (
        <Panel title={`Pending invitations (${invitations.length})`}>
          {invitations.length === 0 ? (
            <EmptyState icon={<MailPlus className="h-5 w-5" />} title="No pending invitations" />
          ) : (
            <ul className="divide-y divide-line">
              {invitations.map((inv) => (
                <InvitationRow key={inv.id} invite={inv} canManage={canManage} onResult={report} />
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a member"
        description="They sign in with a one-time code sent to this address."
      >
        {inviting && (
          <InviteForm
            organizationId={organizationId}
            roles={assignable}
            onDone={(state) => {
              setInviting(false);
              setFlash(state);
            }}
            onCancel={() => setInviting(false)}
          />
        )}
      </Modal>
    </div>
  );
}

function MemberRow({
  organizationId,
  member,
  roles,
  editable,
  lastOwner,
  onResult,
}: {
  organizationId: string;
  member: TeamMember;
  roles: OrgRole[];
  editable: boolean;
  lastOwner: boolean;
  onResult: (s: ActionState) => void;
}) {
  const [roleState, roleAction] = useFormState(changeMemberRole, idleState);
  const [removeState, removeAction] = useFormState(removeMember, idleState);
  const [confirming, setConfirming] = useState(false);
  const roleForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (roleState.status === "error") roleForm.current?.reset();
    onResult(roleState);
  }, [roleState, onResult]);
  useEffect(() => onResult(removeState), [removeState, onResult]);

  const label = rolePermissions[member.role].label;

  return (
    <tr>
      <td className="px-4 py-3">
        <p>
          {member.name}
          {member.isYou && <span className="ml-2 text-xs text-ink-subtle">(you)</span>}
        </p>
        {member.name !== member.email && <p className="break-all text-xs text-ink-subtle">{member.email}</p>}
      </td>
      <td className="px-4 py-3">
        {editable && !lastOwner ? (
          <form ref={roleForm} action={roleAction} className="w-36">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="userId" value={member.userId} />
            <SelectBox
              compact
              name="role"
              defaultValue={member.role}
              aria-label={`Role for ${member.name}`}
              onChange={() => roleForm.current?.requestSubmit()}
            >
              {(roles.includes(member.role) ? roles : [member.role, ...roles]).map((r) => (
                <option key={r} value={r}>
                  {rolePermissions[r].label}
                </option>
              ))}
            </SelectBox>
          </form>
        ) : (
          <Badge tone={member.role === "owner" ? "brand" : "neutral"}>{label}</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDate(member.joinedAt)}</td>
      <td className="px-4 py-3 text-right">
        {editable && !member.isYou && !lastOwner && (
          <form action={removeAction} className="inline-flex items-center justify-end gap-2">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="userId" value={member.userId} />
            {confirming ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <SubmitButton size="sm" className="bg-red-700 hover:bg-red-800" pendingLabel="Removing…">
                  Remove
                </SubmitButton>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove<span className="sr-only"> {member.name}</span>
              </button>
            )}
          </form>
        )}
      </td>
    </tr>
  );
}

function InvitationRow({
  invite,
  canManage,
  onResult,
}: {
  invite: PendingInvite;
  canManage: boolean;
  onResult: (s: ActionState) => void;
}) {
  const [state, action] = useFormState(revokeInvitation, idleState);
  useEffect(() => onResult(state), [state, onResult]);

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm">{invite.fullName ? `${invite.fullName} · ${invite.email}` : invite.email}</p>
        <p className="text-xs text-ink-subtle">
          {rolePermissions[invite.role].label} · invited {formatDate(invite.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <CopyButton value={invite.link} label="Copy sign-in link" />
        {canManage && (
          <form action={action}>
            <input type="hidden" name="invitationId" value={invite.id} />
            <SubmitButton variant="ghost" size="sm" className="text-red-700" pendingLabel="Revoking…">
              Revoke
            </SubmitButton>
          </form>
        )}
      </div>
    </li>
  );
}

function InviteForm({
  organizationId,
  roles,
  onDone,
  onCancel,
}: {
  organizationId: string;
  roles: OrgRole[];
  onDone: (s: ActionState) => void;
  onCancel: () => void;
}) {
  const [state, action] = useFormState(inviteMember, idleState);

  useEffect(() => {
    if (state.status === "success") onDone(state);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field name="email" label="Work email" type="email" autoComplete="off" errors={state.fieldErrors} required autoFocus />
      <Field name="fullName" label="Name (optional)" errors={state.fieldErrors} />
      <SelectField name="role" label="Role" errors={state.fieldErrors} defaultValue="viewer">
        {roles.map((r) => (
          <option key={r} value={r}>
            {rolePermissions[r].label} — {rolePermissions[r].scope}
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
