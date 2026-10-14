import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/lib/auth";
import type { OrgRole, OrgStatus } from "@/lib/database.types";
import { rolePermissions, type RolePermissions } from "@/lib/meta";
import { supabase } from "@/lib/supabase";

const ACTIVE_KEY = "largis-active-org";

export type ClientOrg = {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  region: string | null;
  status: OrgStatus;
  requireMfa: boolean;
  role: OrgRole;
};

type OrgValue = {
  loading: boolean;
  error: string | null;
  orgs: ClientOrg[];
  active: ClientOrg | null;
  perms: RolePermissions | null;
  /** Organizations that require two-step verification while the user has no authenticator yet. */
  mustEnrollFor: string[];
  unread: Record<string, number>;
  setActive: (id: string) => Promise<void>;
  reload: () => Promise<void>;
  refreshUnread: () => Promise<void>;
};

const OrgContext = createContext<OrgValue | null>(null);

type OrgLoad = { ok: true; orgs: ClientOrg[]; stored: string | null } | { ok: false };

async function fetchOrgs(userId: string): Promise<OrgLoad> {
  const { data: memberships, error } = await supabase.from("memberships").select("organization_id, role").eq("user_id", userId);
  if (error) return { ok: false };
  const roles = new Map((memberships ?? []).map((m) => [m.organization_id, m.role]));
  let orgs: ClientOrg[] = [];
  if (roles.size) {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, slug, plan, region, status, require_mfa")
      .in("id", Array.from(roles.keys()))
      .order("name");
    orgs = (data ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      region: o.region,
      status: o.status,
      requireMfa: o.require_mfa,
      role: roles.get(o.id)!,
    }));
  }
  return { ok: true, orgs, stored: await SecureStore.getItemAsync(ACTIVE_KEY) };
}

async function fetchUnread() {
  const { data } = await supabase.rpc("chat_unread_counts");
  const map: Record<string, number> = Object.fromEntries((data ?? []).map((r) => [r.organization_id, r.unread]));
  const total = Object.values(map).reduce((sum, n) => sum + n, 0);
  Notifications.setBadgeCountAsync(total).catch(() => {});
  return map;
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user, factors, enrollmentCheck } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<ClientOrg[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const userId = user?.id ?? null;

  const applyOrgs = useCallback((result: OrgLoad) => {
    if (result.ok) {
      setOrgs(result.orgs);
      setActiveId((current) => result.orgs.find((o) => o.id === (current ?? result.stored))?.id ?? result.orgs[0]?.id ?? null);
      setError(null);
    } else {
      setError("Your organisations could not be loaded. Check your connection and try again.");
    }
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    if (userId) applyOrgs(await fetchOrgs(userId));
  }, [userId, applyOrgs]);

  const refreshUnread = useCallback(async () => {
    setUnread(await fetchUnread());
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    fetchOrgs(userId).then((result) => active && applyOrgs(result));
    fetchUnread().then((map) => active && setUnread(map));
    return () => {
      active = false;
    };
  }, [userId, applyOrgs, enrollmentCheck]);

  useEffect(() => {
    const update = () => fetchUnread().then(setUnread);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    const channel = supabase
      .channel("chat-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, update)
      .subscribe();
    return () => {
      sub.remove();
      supabase.removeChannel(channel);
    };
  }, []);

  const setActive = useCallback(async (id: string) => {
    setActiveId(id);
    await SecureStore.setItemAsync(ACTIVE_KEY, id);
  }, []);

  const value = useMemo<OrgValue>(() => {
    const active = orgs.find((o) => o.id === activeId) ?? null;
    return {
      loading,
      error,
      orgs,
      active,
      perms: active ? rolePermissions[active.role] : null,
      mustEnrollFor: factors.length ? [] : orgs.filter((o) => o.requireMfa).map((o) => o.name),
      unread,
      setActive,
      reload,
      refreshUnread,
    };
  }, [orgs, activeId, loading, error, factors.length, unread, setActive, reload, refreshUnread]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used inside OrgProvider");
  return ctx;
}

/** The active organization and its permissions; screens render only once one exists. */
export function useActiveOrg() {
  const ctx = useOrg();
  return { ...ctx, org: ctx.active!, perms: ctx.perms! };
}
