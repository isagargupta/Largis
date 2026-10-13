import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/portal/format";
import { portalHref, portalUrl } from "@/lib/portal/hosts";
import { rolePermissions, staffPermissions, type RolePermissions } from "@/lib/portal/meta";
import { aalFromAccessToken, verifiedTotpFactors } from "@/lib/portal/mfa";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getAuthSession } from "@/lib/supabase/server";
import type { Database, OrgRole } from "@/lib/supabase/types";

export const ORG_COOKIE = "largis_org";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
export type ClientOrg = Pick<OrgRow, "id" | "name" | "slug" | "plan" | "region" | "status"> & { role: OrgRole };

export function requestHost() {
  return headers().get("host");
}

const getAuth = cache(async () => {
  if (!isSupabaseConfigured()) return { user: null, accessToken: null };
  return getAuthSession();
});

export const getUser = cache(async () => (await getAuth()).user);

/** Verified factors and the session's assurance level for the signed-in user. */
export const getMfaState = cache(async () => {
  const { user, accessToken } = await getAuth();
  if (!user) return null;
  const factors = verifiedTotpFactors(user);
  const aal = aalFromAccessToken(accessToken);
  return { user, factors, aal, needsChallenge: factors.length > 0 && aal !== "aal2" };
});

/** Whether a staff admin has made MFA mandatory for every staff account. */
export const getStaffMfaRequired = cache(async () => {
  const { data } = await createClient().from("security_settings").select("require_staff_mfa").maybeSingle();
  return data?.require_staff_mfa ?? false;
});

/** Names of the caller's client organizations that require MFA for their members. */
export const getClientMfaRequirement = cache(async () => {
  const ctx = await getClientContext();
  if (!ctx?.orgs.length) return [];
  const { data } = await createClient()
    .from("organizations")
    .select("name")
    .in(
      "id",
      ctx.orgs.map((o) => o.id),
    )
    .eq("require_mfa", true);
  return (data ?? []).map((o) => o.name);
});

/** The external path of the current portal request, as forwarded by middleware. */
export function requestPath() {
  return headers().get("x-largis-path") ?? "";
}

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
