import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Badge, Button, Card, Chips, Divider, EmptyState, ErrorView, Loading, Notice, Screen, useUi } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getProfiles, leadColumns, loadLeadValues, must, useLoader } from "@/lib/data";
import type { LeadStage } from "@/lib/database.types";
import { displayName, formatCents, formatDate } from "@/lib/format";
import { openStages, stageMeta, stageOrder } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";
import { stageDot, useTheme } from "@/lib/theme";

type StageFilter = "all" | "open" | LeadStage;

export default function SalesScreen() {
  const { org, perms } = useActiveOrg();
  const { user } = useAuth();
  const ui = useUi();
  const { colors, scheme } = useTheme();
  const params = useLocalSearchParams<{ stage?: string }>();
  const linkedStage: StageFilter = stageOrder.includes(params.stage as LeadStage) ? (params.stage as LeadStage) : "all";
  // A stage picked here holds until another link from Home arrives with a different stage.
  const [picked, setPicked] = useState<{ link: string | undefined; stage: StageFilter } | null>(null);
  const stage = picked && picked.link === params.stage ? picked.stage : linkedStage;
  const setStage = (value: StageFilter) => setPicked({ link: params.stage, stage: value });
  const [query, setQuery] = useState("");

  const { data, error, loading, refreshing, refresh } = useLoader(async () => {
    const [leads, memberships, values] = await Promise.all([
      supabase.from("leads").select(leadColumns).eq("organization_id", org.id).order("updated_at", { ascending: false }).limit(2000),
      supabase.from("memberships").select("user_id").eq("organization_id", org.id),
      perms.canViewValue ? loadLeadValues(org.id) : Promise.resolve(new Map<string, number>()),
    ]);
    const rows = must(leads, "Leads") ?? [];
    const profiles = await getProfiles([...(memberships.data ?? []).map((m) => m.user_id), ...rows.map((l) => l.owner_id)]);
    return {
      leads: rows.map((l) => ({
        ...l,
        value_cents: perms.canViewValue ? values.get(l.id) ?? 0 : null,
        ownerName: l.owner_id ? displayName(profiles.get(l.owner_id)) : null,
      })),
    };
  }, [org.id, perms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.leads ?? []).filter(
      (l) =>
        (stage === "all" || (stage === "open" ? openStages.includes(l.stage) : l.stage === stage)) &&
        (!q || [l.company ?? "", l.contact_name, l.contact_email ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [data, stage, query]);

  const total = visible.reduce((sum, l) => sum + (l.value_cents ?? 0), 0);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {perms.canEdit && <Button title="Add lead" icon="add" onPress={() => router.push("/lead/new")} />}
      {perms.ownOnly && <Notice>You can see and edit the leads assigned to you. Deal values are hidden for your role.</Notice>}
      {!perms.canEdit && <Notice tone="neutral">Your role has read-only access to the pipeline.</Notice>}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, contact, or email"
        placeholderTextColor={colors.inkSubtle}
        keyboardAppearance={scheme}
        style={ui.input}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel="Search leads"
      />
      <Chips<StageFilter>
        options={[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          ...stageOrder.map((s) => ({ value: s as StageFilter, label: stageMeta[s].label, color: stageDot[s] })),
        ]}
        value={stage}
        onChange={setStage}
      />

      {loading ? (
        <Loading />
      ) : !data ? (
        <ErrorView message={error ?? "Leads could not be loaded."} onRetry={refresh} />
      ) : (
        <Card
          title={`${visible.length} ${visible.length === 1 ? "lead" : "leads"}`}
          action={perms.canViewValue && visible.length ? <Text style={ui.muted}>{formatCents(total)}</Text> : undefined}
        >
          {visible.length === 0 ? (
            <EmptyState icon="trending-up-outline" title={data.leads.length ? "No leads match" : "No leads yet"}>
              {data.leads.length ? "Try a different stage or search." : perms.canEdit ? "Add your first lead to start tracking the pipeline." : undefined}
            </EmptyState>
          ) : (
            visible.map((l, i) => {
              const meta = stageMeta[l.stage];
              return (
                <View key={l.id}>
                  {i > 0 && <Divider />}
                  <Pressable
                    onPress={() => router.push(`/lead/${l.id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [{ padding: 16, gap: 5 }, pressed && ui.pressed]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[ui.rowTitle, { flex: 1 }]} numberOfLines={1}>
                        {l.company?.trim() || l.contact_name}
                      </Text>
                      {l.value_cents !== null && <Text style={ui.body}>{formatCents(l.value_cents)}</Text>}
                    </View>
                    <Text style={ui.small} numberOfLines={1}>
                      {[l.contact_name, l.contact_email].filter(Boolean).join(" · ")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge tone={meta.tone} label={meta.label} />
                      <Text style={ui.small}>
                        {[l.owner_id === user?.id ? "You" : l.ownerName ?? "Unassigned", l.source, `Updated ${formatDate(l.updated_at)}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
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
