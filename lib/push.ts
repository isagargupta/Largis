import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

export type PushPayload = {
  title: string;
  body: string;
  /** Read by the app to open the right screen, e.g. { screen: "ticket", id }. */
  data?: Record<string, string>;
};

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

function excerpt(text: string, max = 180) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Sends a push notification to every registered device of the given users through Expo's push service.
 * Best effort: failures are logged, and tokens Expo reports as unregistered are removed.
 */
export async function sendPushToUsers(userIds: (string | null | undefined)[], payload: PushPayload) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const admin = createAdminClient();
  if (!ids.length || !admin) return;

  const { data: devices, error } = await admin.from("device_tokens").select("token").in("user_id", ids);
  if (error) {
    console.error("[push] Could not load device tokens", error.message);
    return;
  }
  const tokens = (devices ?? []).map((d) => d.token);
  if (!tokens.length) return;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  const stale: string[] = [];
  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(
          batch.map((to) => ({
            to,
            title: payload.title,
            body: excerpt(payload.body),
            data: payload.data ?? {},
            sound: "default",
            priority: "high",
          })),
        ),
      });
      if (!res.ok) {
        console.error("[push] Expo responded", res.status, await res.text());
        continue;
      }
      const { data } = (await res.json()) as { data?: ExpoTicket[] };
      (data ?? []).forEach((ticket, j) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") stale.push(batch[j]);
      });
    } catch (err) {
      console.error("[push] Send failed", err);
    }
  }

  if (stale.length) await admin.from("device_tokens").delete().in("token", stale);
}

/** Members of a client organization, for organization-wide notifications. */
export async function orgMemberIds(organizationId: string) {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("memberships").select("user_id").eq("organization_id", organizationId);
  return (data ?? []).map((m) => m.user_id);
}
