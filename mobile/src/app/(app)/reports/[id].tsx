import { Stack, useLocalSearchParams } from "expo-router";
import { Share, Text, View } from "react-native";
import { Markdown } from "@/components/Markdown";
import { Button, Card, ErrorView, Loading, Screen, styles as ui } from "@/components/ui";
import { useLoader } from "@/lib/data";
import { formatDate, formatPeriod } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

export default function ReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    const { data: report, error: rError } = await supabase
      .from("reports")
      .select("id, organization_id, engagement_id, title, period_start, period_end, summary, body, published_at")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (rError) throw new Error("The report could not be loaded. Pull to refresh.");
    if (!report) throw new Error("This report is no longer available.");
    const [{ data: org }, { data: engagement }] = await Promise.all([
      supabase.from("organizations").select("name").eq("id", report.organization_id).maybeSingle(),
      report.engagement_id
        ? supabase.from("engagements").select("name").eq("id", report.engagement_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { report, orgName: org?.name ?? null, engagementName: engagement?.name ?? null };
  }, [id]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={error ?? "The report could not be loaded."} onRetry={refresh} />;

  const { report } = data;
  const meta = [
    formatPeriod(report.period_start, report.period_end),
    data.engagementName,
    report.published_at ? `Published ${formatDate(report.published_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: "Report" }} />
      <View style={{ gap: 6 }}>
        {data.orgName && <Text style={ui.eyebrow}>{data.orgName}</Text>}
        <Text style={[ui.title, { fontSize: 22 }]}>{report.title}</Text>
        {meta ? <Text style={ui.muted}>{meta}</Text> : null}
      </View>
      {report.summary && (
        <View style={{ borderLeftWidth: 2, borderLeftColor: colors.gold, backgroundColor: colors.paperSoft, padding: 12 }}>
          <Text style={[ui.body, { lineHeight: 23 }]}>{report.summary}</Text>
        </View>
      )}
      <Card padded>
        {report.body ? <Markdown source={report.body} /> : <Text style={ui.muted}>This report has no further detail.</Text>}
      </Card>
      <Text style={ui.small}>Prepared by Largis Venture for {data.orgName ?? "your organisation"}. Confidential.</Text>
      {report.summary && (
        <Button
          title="Share summary"
          variant="secondary"
          icon="share-outline"
          onPress={() => Share.share({ title: report.title, message: `${report.title}\n${meta}\n\n${report.summary}` })}
        />
      )}
    </Screen>
  );
}
