"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

type Subscription = { table: "support_tickets" | "ticket_messages" | "chat_messages"; filter?: string };

/**
 * Re-renders the current server page when matching rows change. Row-level security applies to
 * realtime too, so a client is never notified about rows (or internal notes) it cannot read.
 */
export function RealtimeRefresh({ channel, subscriptions }: { channel: string; subscriptions: Subscription[] }) {
  const router = useRouter();
  const signature = JSON.stringify(subscriptions);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };

    const live = supabase.channel(channel);
    for (const sub of JSON.parse(signature) as Subscription[]) {
      live.on("postgres_changes", { event: "*", schema: "public", table: sub.table, filter: sub.filter }, refresh);
    }
    live.subscribe();

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(live);
    };
  }, [channel, signature, router]);

  return null;
}
