import type { Metadata } from "next";
import { TeamManager } from "@/components/portal/TeamManager";
import { PageHeader } from "@/components/portal/ui";
import { rolePermissions } from "@/lib/portal/meta";
import { loadTeam } from "@/lib/portal/queries";
import { getClientContext } from "@/lib/portal/session";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await getClientContext();
  const org = ctx?.active;
  if (!ctx || !org) return null;

  const perms = rolePermissions[org.role];
  const { members, invitations } = await loadTeam(org.id, ctx.user.id, perms.canManageTeam);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="People with access"
        description={
          perms.canManageTeam
            ? `Invite colleagues to ${org.name} and choose what each person can see.`
            : `Everyone with access to ${org.name}. Owners and admins manage invitations and roles.`
        }
      />
      <TeamManager
        key={org.id}
        organizationId={org.id}
        members={members}
        invitations={invitations}
        canManage={perms.canManageTeam}
        canGrantOwner={org.role === "owner"}
      />
    </div>
  );
}
