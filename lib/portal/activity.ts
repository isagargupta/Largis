import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Client = ReturnType<typeof createClient>;
type Entry = Database["public"]["Tables"]["activity_log"]["Insert"];

export async function logActivity(supabase: Client, entry: Entry) {
  const { error } = await supabase.from("activity_log").insert(entry);
  if (error) console.error("[activity] Failed to record", entry.action, error.message);
}
