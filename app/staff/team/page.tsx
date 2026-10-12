import type { Metadata } from "next";
import { StaffTeamManager, type StaffInvite } from "@/components/portal/StaffTeamManager";
import { PageHeader } from "@/components/portal/ui";
import { signInLink } from "@/lib/portal/invitations";
import { loadStaffDirectory } from "@/lib/portal/queries";
import { requireStaff } from "@/lib/portal/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

export default async function StaffTeamPage() {
  const { user, staff } = await requireStaff();
  const isAdmin = staff.role === "admin";

  const [members, invites] = await Promise.all([
    loadStaffDirectory(),
    isAdmin
      ? createClient()
          .from("invitations")
          .select("id, email, full_name, staff_role, title, created_at")
          .eq("kind", "staff")
          .is("accepted_at", null)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const invitations: StaffInvite[] | null = invites.data
    ? invites.data.map((i) => ({
        id: i.id,
        email: i.email,
        fullName: i.full_name,
        role: i.staff_role ?? "agent",
        title: i.title,
        createdAt: i.created_at,
        link: signInLink("staff", i.email),
      }))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Largis staff"
        description={
          isAdmin
            ? "Invite employees to Largis Workspace, set their role and title, or deactivate access."
            : "Everyone with access to Largis Workspace. Staff admins manage invitations and roles."
        }
      />
      <StaffTeamManager members={members} invitations={invitations} canManage={isAdmin} currentUserId={user.id} />
    </div>
  );
}
