import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { rolePermissions, staffPermissions, type RolePermissions } from "@/lib/portal/meta";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database, OrgRole } from "@/lib/supabase/types";

export const ORG_COOKIE = "largis_org";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
export type ClientOrg = Pick<OrgRow, "id" | "name" | "slug" | "plan" | "region" | "status"> & { role: OrgRole };

export function requestHost() {
  return headers().get("host");
}

export const getUser = cache(async () => {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createClient().auth.getUser();
  return data.user ?? null;
});

export async function requireUser(next: string) {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(portalHref(next))}`);
  return user;
}

export const getStaffMember = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const { data } = await createClient()
    .from("staff_members")
    .select("user_id, role, title, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  return data;
});

export async function requireStaff() {
  const user = await requireUser("/staff");
  const staff = await getStaffMember();
  if (!staff) redirect(portalUrl("app", "/app", requestHost()));
  return { user, staff };
}

export async function hasClientMembership(userId: string) {
  const { count } = await createClient()
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export const getClientContext = cache(async () => {
  const user = await getUser();
  if (!user) return null;

  const supabase = createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id);

  const roles = new Map((memberships ?? []).map((m) => [m.organization_id, m.role]));
  let orgs: ClientOrg[] = [];
  if (roles.size) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug, plan, region, status")
      .in("id", Array.from(roles.keys()))
      .order("name");
    orgs = (data ?? []).map((o) => ({ ...o, role: roles.get(o.id)! }));
  }

  const preferred = cookies().get(ORG_COOKIE)?.value;
  const active = orgs.find((o) => o.id === preferred) ?? orgs[0] ?? null;
  return { user, orgs, active };
});

/** The caller's effective permissions in an organization: staff, member, or none. */
export async function getOrgAccess(organizationId: string) {
  const user = await getUser();
  if (!user) return null;

  const staff = await getStaffMember();
  if (staff) return { user, role: null as OrgRole | null, staff: true, perms: staffPermissions };

  const { data } = await createClient()
    .from("memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;

  const perms: RolePermissions = rolePermissions[data.role];
  return { user, role: data.role, staff: false, perms };
}

export async function getProfiles(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const map = new Map<string, Profile>();
  if (!unique.length) return map;
  const { data } = await createClient().from("profiles").select("id, email, full_name").in("id", unique);
  (data ?? []).forEach((p) => map.set(p.id, p));
  return map;
}
