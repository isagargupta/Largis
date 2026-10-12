import "server-only";
import type { StaffDirectoryEntry } from "@/components/portal/StaffTeamManager";
import type { PendingInvite, TeamMember } from "@/components/portal/TeamManager";
import { displayName } from "@/lib/portal/format";
import { signInLink } from "@/lib/portal/invitations";
import { getProfiles } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

const rolePriority = { owner: 0, admin: 1, manager: 2, agent: 3, viewer: 4 } as const;

export async function loadTeam(organizationId: string, currentUserId: string, includeInvites: boolean) {
  const supabase = createClient();
  const [{ data: memberships }, invites] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at").eq("organization_id", organizationId),
    includeInvites
      ? supabase
          .from("invitations")
          .select("id, email, full_name, org_role, created_at")
          .eq("kind", "client")
          .eq("organization_id", organizationId)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const profiles = await getProfiles((memberships ?? []).map((m) => m.user_id));
  const members: TeamMember[] = (memberships ?? [])
    .map((m) => {
      const p = profiles.get(m.user_id);
      return {
        userId: m.user_id,
        name: displayName(p),
        email: p?.email ?? "",
        role: m.role,
        joinedAt: m.created_at,
        isYou: m.user_id === currentUserId,
      };
    })
    .sort((a, b) => rolePriority[a.role] - rolePriority[b.role] || a.name.localeCompare(b.name));

  const invitations: PendingInvite[] | null = invites.data
    ? invites.data.map((i) => ({
        id: i.id,
        email: i.email,
        fullName: i.full_name,
        role: i.org_role ?? "viewer",
        createdAt: i.created_at,
        link: signInLink("client", i.email),
      }))
    : null;

  return { members, invitations };
}

const staffRolePriority = { admin: 0, manager: 1, agent: 2 } as const;

export async function loadStaffDirectory() {
  const { data } = await createClient().from("staff_members").select("user_id, role, title, active, created_at");
  const profiles = await getProfiles((data ?? []).map((s) => s.user_id));
  return (data ?? [])
    .map(
      (s): StaffDirectoryEntry => ({
        userId: s.user_id,
        name: displayName(profiles.get(s.user_id)),
        email: profiles.get(s.user_id)?.email ?? "",
        role: s.role,
        title: s.title,
        active: s.active,
        joinedAt: s.created_at,
      }),
    )
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        staffRolePriority[a.role] - staffRolePriority[b.role] ||
        a.name.localeCompare(b.name),
    );
}
