import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Badge,
  Button,
  Card,
  Chips,
  Divider,
  EmptyState,
  ErrorView,
  Loading,
  Screen,
  Stat,
  StatGrid,
  useUi,
} from "@/components/ui";
import { must, ticketListColumns, useLoader } from "@/lib/data";
import type { TicketStatus } from "@/lib/database.types";
import { formatDate } from "@/lib/format";
import { activeTicketStatuses, ticketPriorityMeta, ticketStatuses, ticketStatusMeta } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { loadSupportStats, slaBadge } from "@/lib/queries";
import { formatDuration, formatPercent } from "@/lib/sla";
import { supabase } from "@/lib/supabase";

type Filter = "active" | "all" | TicketStatus;

const filters: { value: Filter; label: string }[] = [
  { value: "active", label: "Open" },
  { value: "all", label: "All" },
  ...ticketStatuses.map((s) => ({ value: s as Filter, label: ticketStatusMeta[s].clientLabel })),
];

export default function SupportScreen() {
  const { org, perms } = useActiveOrg();
  const [filter, setFilter] = useState<Filter>("active");
  const ui = useUi();

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    const now = Date.now();
    let query = supabase
      .from("support_tickets")
      .select(ticketListColumns)
      .eq("organization_id", org.id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (filter === "active") query = query.in("status", activeTicketStatuses);
    else if (filter !== "all") query = query.eq("status", filter);
    const [tickets, stats] = await Promise.all([query, loadSupportStats(org.id, now)]);
    return { tickets: must(tickets, "Tickets") ?? [], stats, now };
  }, [org.id, filter]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {perms.canEdit && <Button title="New ticket" icon="add" onPress={() => router.push("/ticket/new")} />}

      {data && (
        <StatGrid>
          <Stat
            label="Open tickets"
            value={data.stats.open.toLocaleString("en-US")}
            hint={data.stats.awaitingClient ? `${data.stats.awaitingClient} awaiting your reply` : "None awaiting your reply"}
          />
          <Stat
            label="Avg. first response"
            value={data.stats.recent.avgFirstResponseMinutes === null ? "—" : formatDuration(data.stats.recent.avgFirstResponseMinutes)}
            hint="Last 30 days"
          />
          <Stat label="Replies within SLA" value={formatPercent(data.stats.recent.firstResponseRate)} hint="Last 30 days" />
          <Stat label="Resolved within SLA" value={formatPercent(data.stats.recent.resolutionRate)} hint="Last 30 days" />
        </StatGrid>
      )}

      <Chips options={filters} value={filter} onChange={setFilter} />

      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorView message={error ?? "Tickets could not be loaded."} onRetry={refresh} />
      ) : (
        <Card title={`${data.tickets.length}${data.tickets.length === 200 ? "+" : ""} ${data.tickets.length === 1 ? "ticket" : "tickets"}`}>
          {data.tickets.length === 0 ? (
            <EmptyState icon="help-buoy-outline" title={filter === "active" ? "No open tickets" : "No tickets match"}>
              {perms.canEdit ? "Open a ticket whenever you need help from the Largis team." : "Tickets your organisation opens will appear here."}
            </EmptyState>
          ) : (
            data.tickets.map((t, i) => {
              const status = ticketStatusMeta[t.status];
              const sla = slaBadge(t, data.now);
              return (
                <View key={t.id}>
                  {i > 0 && <Divider />}
                  <Pressable
                    onPress={() => router.push(`/ticket/${t.id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [{ padding: 16, gap: 6 }, pressed && ui.pressed]}
                  >
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Text style={ui.mono}>{t.reference}</Text>
                      <Text style={[ui.small, { marginLeft: "auto" }]}>Updated {formatDate(t.updated_at)}</Text>
                    </View>
                    <Text style={ui.rowTitle} numberOfLines={2}>
                      {t.subject}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      <Badge tone={status.tone} label={status.clientLabel} />
                      <Badge tone={ticketPriorityMeta[t.priority].tone} label={ticketPriorityMeta[t.priority].label} />
                      <Badge tone={sla.tone} label={sla.label} />
                    </View>
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>
      )}
    </Screen>
  );
}
