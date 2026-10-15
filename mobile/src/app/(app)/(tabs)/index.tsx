import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import {
  Badge,
  Card,
  Divider,
  EmptyState,
  ErrorView,
  LinkText,
  Loading,
  Notice,
  Progress,
  Row,
  Screen,
  Stat,
  StatGrid,
  useUi,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getProfiles, loadLeadValues, must, useLoader } from "@/lib/data";
import type { LeadStage } from "@/lib/database.types";
import {
  describeActivity,
  displayName,
  formatCents,
  formatDate,
  formatDay,
  formatMoney,
  formatMoneyTotals,
  formatPeriod,
  todayUtc,
} from "@/lib/format";
import { engagementStatusMeta, openStages, orgStatusMeta, serviceLineLabel, stageMeta, stageOrder } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { loadBillingSummary, loadSupportStats } from "@/lib/queries";
import { formatPercent } from "@/lib/sla";
import { supabase } from "@/lib/supabase";
import { stageDot, useTheme } from "@/lib/theme";

const engagementOrder = { active: 0, planning: 1, on_hold: 2, completed: 3 } as const;

export default function HomeScreen() {
  const { org, perms } = useActiveOrg();
  const { user } = useAuth();
  const ui = useUi();
  const { colors } = useTheme();

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    const now = Date.now();
    const [leads, members, activity, support, engagements, milestones, reports, values, billing] = await Promise.all([
      supabase.from("leads").select("id, stage").eq("organization_id", org.id).limit(5000),
      supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("organization_id", org.id),
      supabase
        .from("activity_log")
        .select("id, action, entity, actor_id, metadata, created_at")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(perms.ownOnly ? 40 : 10),
      loadSupportStats(org.id, now),
      supabase
        .from("engagements")
        .select("id, name, service_line, status, start_date, end_date")
        .eq("organization_id", org.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false }),
      supabase.from("milestones").select("id, engagement_id, title, due_date, status").eq("organization_id", org.id).limit(2000),
      supabase
        .from("reports")
        .select("id, title, period_start, period_end, summary, published_at")
        .eq("organization_id", org.id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(1),
      perms.canViewValue ? loadLeadValues(org.id) : Promise.resolve(new Map<string, number>()),
      perms.canViewBilling ? loadBillingSummary(org.id, now) : Promise.resolve(null),
    ]);

    const rows = must(leads, "Leads");
    const visibleActivity = (activity.data ?? [])
      .filter((a) => !perms.ownOnly || a.entity !== "lead" || a.actor_id === user?.id)
      .slice(0, 10);
    const profiles = await getProfiles(visibleActivity.map((a) => a.actor_id));

    const counts = Object.fromEntries(stageOrder.map((s) => [s, 0])) as Record<LeadStage, number>;
    rows.forEach((l) => counts[l.stage]++);
    const open = rows.filter((l) => openStages.includes(l.stage));
    const valueOf = (id: string) => values.get(id) ?? 0;

    const engagementRows = (engagements.data ?? [])
      .map((e) => {
        const own = (milestones.data ?? []).filter((m) => m.engagement_id === e.id);
        const next = own
          .filter((m) => m.status !== "done")
          .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
        return { ...e, total: own.length, done: own.filter((m) => m.status === "done").length, next };
      })
      .sort((a, b) => engagementOrder[a.status] - engagementOrder[b.status]);

    return {
      total: rows.length,
      counts,
      openCount: open.length,
      openValue: open.reduce((sum, l) => sum + valueOf(l.id), 0),
      wonValue: rows.filter((l) => l.stage === "won").reduce((sum, l) => sum + valueOf(l.id), 0),
      memberCount: members.count ?? 0,
      activity: visibleActivity,
      profiles,
      support,
      engagements: engagementRows,
      latestReport: reports.data?.[0] ?? null,
      billing,
      today: todayUtc(now),
    };
  }, [org.id, perms]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={error ?? "Something went wrong."} onRetry={refresh} />;

  const status = orgStatusMeta[org.status];
  const { support, billing, latestReport } = data;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: 8 }}>
        <Text style={ui.eyebrow}>Overview</Text>
        <Text style={ui.title}>{org.name}</Text>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone={status.tone} label={status.label} />
          {org.plan && <Text style={ui.small}>{org.plan} plan</Text>}
          {org.region && <Text style={ui.mono}>{org.region}</Text>}
        </View>
      </View>

      {perms.ownOnly && <Notice>Lead figures below cover the leads assigned to you. Deal values are hidden for your role.</Notice>}

      <StatGrid>
        <Stat label="Open leads" value={data.openCount.toLocaleString("en-US")} hint="New through negotiation" />
        <Stat
          label="Open pipeline"
          value={perms.canViewValue ? formatCents(data.openValue) : "Hidden"}
          hint={perms.canViewValue ? `${formatCents(data.wonValue)} won to date` : "Sum of open deal values"}
        />
        <Stat
          label="Open tickets"
          value={support.open.toLocaleString("en-US")}
          hint={
            support.breached
              ? `${support.breached} past an SLA target`
              : support.awaitingClient
                ? `${support.awaitingClient} awaiting your reply`
                : "All within SLA"
          }
        />
        <Stat label="Replies within SLA" value={formatPercent(support.recent.firstResponseRate)} hint="Last 30 days" />
      </StatGrid>

      <Card title="Pipeline by stage" action={<LinkText title="Sales" onPress={() => router.navigate("/sales")} />}>
        <View style={{ flexDirection: "row", height: 8, margin: 16, marginBottom: 4, backgroundColor: colors.paperSoft, overflow: "hidden" }}>
          {stageOrder.map((s) =>
            data.total && data.counts[s] ? (
              <View key={s} style={{ flex: data.counts[s], backgroundColor: stageDot[s] }} />
            ) : null,
          )}
        </View>
        {stageOrder.map((s, i) => (
          <View key={s}>
            {i > 0 && <Divider />}
            <Pressable
              onPress={() => router.navigate({ pathname: "/sales", params: { stage: s } })}
              accessibilityRole="button"
              accessibilityLabel={`${stageMeta[s].label}: ${data.counts[s]} leads`}
              style={({ pressed }) => [
                { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 11, gap: 10 },
                pressed && ui.pressed,
              ]}
            >
              <View style={{ width: 10, height: 10, backgroundColor: stageDot[s] }} />
              <Text style={[ui.body, { flex: 1 }]}>{stageMeta[s].label}</Text>
              <Text style={ui.muted}>{data.counts[s]}</Text>
            </Pressable>
          </View>
        ))}
        {data.total === 0 && <Text style={[ui.small, { padding: 16 }]}>No leads yet.</Text>}
      </Card>

      {billing && (
        <Card title="Billing" action={<LinkText title="Invoices" onPress={() => router.push("/billing")} />} padded>
          <Text style={ui.small}>Outstanding balance</Text>
          <Text style={[ui.title, { fontSize: 22 }]}>{formatMoneyTotals(billing.outstanding, formatMoney(0, "INR"))}</Text>
          <Text style={[ui.small, billing.overdueCount ? { color: colors.danger } : null]}>
            {billing.overdueCount
              ? `${formatMoneyTotals(billing.overdue)} overdue across ${billing.overdueCount} ${billing.overdueCount === 1 ? "invoice" : "invoices"}`
              : billing.outstandingCount
                ? `${billing.outstandingCount} open ${billing.outstandingCount === 1 ? "invoice" : "invoices"}, none overdue`
                : "No invoices awaiting payment"}
          </Text>
        </Card>
      )}

      <Card title="Engagements">
        {data.engagements.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="No active engagements">
            Engagements the Largis team runs for you, and their milestones, will appear here.
          </EmptyState>
        ) : (
          data.engagements.map((e, i) => {
            const meta = engagementStatusMeta[e.status];
            const overdue = Boolean(e.next?.due_date && e.next.due_date < data.today);
            return (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <View style={{ padding: 16, gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={ui.rowTitle}>{e.name}</Text>
                      <Text style={ui.small}>
                        {[serviceLineLabel[e.service_line], formatPeriod(e.start_date, e.end_date)].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Badge tone={meta.tone} label={meta.label} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Progress value={e.total ? e.done / e.total : 0} />
                    <Text style={ui.small}>
                      {e.done} of {e.total} milestones
                    </Text>
                  </View>
                  <Text style={[ui.small, overdue && { color: colors.danger }]}>
                    {e.next
                      ? `Next: ${e.next.title}${e.next.due_date ? ` · ${overdue ? "overdue since" : "due"} ${formatDay(e.next.due_date)}` : ""}`
                      : e.total
                        ? "All milestones complete"
                        : "Milestones not yet scheduled"}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </Card>

      <Card title="Latest report" action={latestReport ? <LinkText title="All reports" onPress={() => router.push("/reports")} /> : undefined}>
        {latestReport ? (
          <Pressable
            onPress={() => router.push(`/reports/${latestReport.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => [{ padding: 16, gap: 4 }, pressed && ui.pressed]}
          >
            <Text style={ui.rowTitle}>{latestReport.title}</Text>
            <Text style={ui.small}>
              {[
                formatPeriod(latestReport.period_start, latestReport.period_end),
                latestReport.published_at ? `Published ${formatDate(latestReport.published_at)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {latestReport.summary && (
              <Text style={ui.muted} numberOfLines={3}>
                {latestReport.summary}
              </Text>
            )}
          </Pressable>
        ) : (
          <EmptyState icon="document-text-outline" title="No reports yet">
            Reports from the Largis team will appear here once published.
          </EmptyState>
        )}
      </Card>

      <Card title="Recent activity">
        {data.activity.length === 0 ? (
          <EmptyState icon="pulse-outline" title="No activity yet" />
        ) : (
          data.activity.map((a, i) => (
            <View key={a.id}>
              {i > 0 && <Divider />}
              <Row
                title={`${a.actor_id ? displayName(data.profiles.get(a.actor_id), "Largis team") : "Largis"} ${describeActivity(a)}`}
                subtitle={formatDate(a.created_at)}
              />
            </View>
          ))
        )}
      </Card>

      <Text style={ui.small}>
        {data.memberCount.toLocaleString("en-US")} {data.memberCount === 1 ? "person has" : "people have"} access to {org.name}.
      </Text>
    </Screen>
  );
}
