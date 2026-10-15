import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Card, Chips, Divider, EmptyState, ErrorView, Loading, Screen, useUi } from "@/components/ui";
import { must, useLoader } from "@/lib/data";
import { formatDate, formatPeriod } from "@/lib/format";
import { useActiveOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";

function reportYear(r: { period_end: string | null; published_at: string | null }) {
  return (r.period_end ?? r.published_at ?? "").slice(0, 4);
}

export default function ReportsScreen() {
  const { org } = useActiveOrg();
  const ui = useUi();
  const [engagement, setEngagement] = useState("");
  const [year, setYear] = useState("");

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    const [reports, engagements] = await Promise.all([
      supabase
        .from("reports")
        .select("id, title, engagement_id, period_start, period_end, summary, published_at")
        .eq("organization_id", org.id)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(500),
      supabase.from("engagements").select("id, name").eq("organization_id", org.id).order("name"),
    ]);
    const all = must(reports, "Reports") ?? [];
    return {
      all,
      names: new Map((engagements.data ?? []).map((e) => [e.id, e.name])),
      linked: (engagements.data ?? []).filter((e) => all.some((r) => r.engagement_id === e.id)),
      years: Array.from(new Set(all.map(reportYear).filter(Boolean))).sort().reverse(),
    };
  }, [org.id]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={error ?? "Reports could not be loaded."} onRetry={refresh} />;

  const rows = data.all.filter((r) => (!engagement || r.engagement_id === engagement) && (!year || reportYear(r) === year));
  const filtered = Boolean(engagement || year);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Text style={ui.muted}>Performance and delivery reports the Largis team has published for {org.name}.</Text>
      {data.linked.length > 0 && (
        <Chips
          label="Engagement"
          options={[{ value: "", label: "All" }, ...data.linked.map((e) => ({ value: e.id, label: e.name }))]}
          value={engagement}
          onChange={setEngagement}
        />
      )}
      {data.years.length > 1 && (
        <Chips label="Period" options={[{ value: "", label: "All" }, ...data.years.map((y) => ({ value: y, label: y }))]} value={year} onChange={setYear} />
      )}
      <Card title={`${rows.length} ${rows.length === 1 ? "report" : "reports"}`}>
        {rows.length === 0 ? (
          <EmptyState icon="document-text-outline" title={filtered ? "No reports match" : "No reports yet"}>
            {filtered
              ? "Try a different engagement or period."
              : "Your Largis account team publishes reports here, typically monthly. You'll get a notification."}
          </EmptyState>
        ) : (
          rows.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={() => router.push(`/reports/${r.id}`)}
                accessibilityRole="button"
                style={({ pressed }) => [{ padding: 16, gap: 4 }, pressed && ui.pressed]}
              >
                <Text style={ui.rowTitle}>{r.title}</Text>
                <Text style={ui.small}>
                  {[
                    formatPeriod(r.period_start, r.period_end),
                    r.engagement_id ? data.names.get(r.engagement_id) : null,
                    r.published_at ? `Published ${formatDate(r.published_at)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {r.summary && (
                  <Text style={ui.muted} numberOfLines={2}>
                    {r.summary}
                  </Text>
                )}
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
