import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { displayName, type Profile } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Loaded<T> = { key: string; data: T | null; error: string | null };

/**
 * Loads data for a screen and reloads it quietly whenever the screen regains focus. `deps` must be
 * JSON-serialisable; when they change, the previous data is dropped. `refresh` drives pull-to-refresh.
 */
export function useLoader<T>(load: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<Loaded<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const loadLatest = useEffectEvent(load);

  useEffect(() => {
    let active = true;
    loadLatest()
      .then(
        (data) => active && setResult({ key, data, error: null }),
        (err: unknown) =>
          active &&
          setResult((prev) => ({
            key,
            data: prev?.key === key ? prev.data : null,
            error: err instanceof Error ? err.message : "Something went wrong. Pull to refresh.",
          })),
      )
      .finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
  }, [key, tick]);

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) setTick((n) => n + 1);
      focusedBefore.current = true;
    }, []),
  );

  const current = result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: !current,
    refreshing,
    refresh: useCallback(() => {
      setRefreshing(true);
      setTick((n) => n + 1);
    }, []),
    reload: useCallback(() => setTick((n) => n + 1), []),
  };
}

/** Throws a readable error for failed Supabase reads so useLoader can show it. */
export function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what} could not be loaded. Pull to refresh.`);
  return result.data as T;
}

export async function getProfiles(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  const map = new Map<string, Profile>();
  if (!unique.length) return map;
  const { data } = await supabase.from("profiles").select("id, email, full_name").in("id", unique);
  (data ?? []).forEach((p) => map.set(p.id, p));
  return map;
}

/** Names for people the caller may not have a profile row for; clients see staff by name only. */
export async function loadPeopleNames(ids: (string | null | undefined)[], staffFallback = "Largis team") {
  const profiles = await getProfiles(ids);
  const names = new Map<string, string>();
  profiles.forEach((p, id) => names.set(id, displayName(p)));
  const missing = Array.from(new Set(ids.filter((id): id is string => Boolean(id) && !names.has(id!))));
  if (missing.length) {
    const { data } = await supabase.rpc("staff_names", { p_ids: missing });
    (data ?? []).forEach((s) => names.set(s.user_id, s.full_name || staffFallback));
  }
  return names;
}

export const ticketListColumns =
  "id, organization_id, reference, subject, priority, status, assigned_to, created_at, updated_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes";

export const leadColumns = "id, company, contact_name, contact_email, stage, owner_id, source, notes, updated_at";

export async function loadLeadValues(organizationId: string) {
  const { data } = await supabase.rpc("lead_values", { p_org: organizationId });
  return new Map((data ?? []).map((r) => [r.id, r.value_cents]));
}
