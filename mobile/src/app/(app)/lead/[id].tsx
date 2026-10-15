import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button, Chips, ErrorView, Field, Loading, Notice, Screen, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getProfiles, leadColumns, loadLeadValues, useLoader } from "@/lib/data";
import type { LeadStage } from "@/lib/database.types";
import { displayName, formatDateTime } from "@/lib/format";
import { leadSources, stageMeta, stageOrder } from "@/lib/meta";
import { useActiveOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";
import { stageDot } from "@/lib/theme";

type Form = {
  company: string;
  contactName: string;
  contactEmail: string;
  stage: LeadStage;
  value: string;
  ownerId: string;
  source: string;
  notes: string;
};

const blank: Form = { company: "", contactName: "", contactEmail: "", stage: "new", value: "", ownerId: "", source: "", notes: "" };

type Loaded = {
  lead: { id: string; company: string; contact_name: string; contact_email: string | null; stage: LeadStage; owner_id: string | null; source: string | null; notes: string | null; updated_at: string } | null;
  members: { id: string; name: string }[];
  valueCents: number | undefined;
};

export default function LeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { org, perms } = useActiveOrg();

  const { data, error: loadError, loading, refresh } = useLoader<Loaded>(async () => {
    const [{ data: memberships }, lead, values] = await Promise.all([
      supabase.from("memberships").select("user_id").eq("organization_id", org.id),
      isNew
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("leads").select(leadColumns).eq("id", id).eq("organization_id", org.id).maybeSingle(),
      !isNew && perms.canViewValue ? loadLeadValues(org.id) : Promise.resolve(new Map<string, number>()),
    ]);
    if (lead.error) throw new Error("The lead could not be loaded.");
    if (!isNew && !lead.data) throw new Error("That lead no longer exists or isn't assigned to you.");
    const profiles = await getProfiles((memberships ?? []).map((m) => m.user_id));
    const members = (memberships ?? [])
      .map((m) => ({ id: m.user_id, name: displayName(profiles.get(m.user_id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const valueCents = lead.data ? values.get(lead.data.id) : undefined;
    return { lead: lead.data, members, valueCents };
  }, [id, org.id, perms]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={loadError ?? "The lead could not be loaded."} onRetry={refresh} />;
  return <LeadForm key={data.lead?.id ?? "new"} id={id} data={data} />;
}

function LeadForm({ id, data }: { id: string; data: Loaded }) {
  const isNew = id === "new";
  const { org, perms } = useActiveOrg();
  const { user } = useAuth();
  const ui = useUi();
  const lead = data.lead;
  const [form, setForm] = useState<Form>(() =>
    lead
      ? {
          company: lead.company,
          contactName: lead.contact_name,
          contactEmail: lead.contact_email ?? "",
          stage: lead.stage,
          value: data.valueCents ? String(data.valueCents / 100) : "",
          ownerId: lead.owner_id ?? "",
          source: lead.source ?? "",
          notes: lead.notes ?? "",
        }
      : { ...blank, ownerId: user?.id ?? "" },
  );
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const editable = perms.canEdit && (!perms.ownOnly || isNew || lead?.owner_id === user?.id);
  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy("save");
    setError(null);
    setFieldErrors({});
    const body = {
      organizationId: org.id,
      company: form.company,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      stage: form.stage,
      value: perms.canViewValue ? form.value : "",
      ownerId: perms.canAssign ? form.ownerId : undefined,
      source: form.source,
      notes: form.notes,
    };
    const result = isNew
      ? await api("/api/mobile/leads", { body })
      : await api(`/api/mobile/leads/${id}`, { method: "PATCH", body });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    router.back();
  }

  function remove() {
    Alert.alert("Delete lead?", `${lead?.company} will be removed for everyone in ${org.name}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          const result = await api(`/api/mobile/leads/${id}?organizationId=${encodeURIComponent(org.id)}`, { method: "DELETE" });
          setBusy(null);
          if (!result.ok) return setError(result.error);
          router.back();
        },
      },
    ]);
  }

  const sources = Array.from(new Set(["", ...leadSources, ...(form.source && !leadSources.includes(form.source as never) ? [form.source] : [])]));

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? "New lead" : lead?.company ?? "Lead" }} />
      {!editable && (
        <Notice tone="neutral">{perms.canEdit ? "This lead is assigned to someone else, so it's read-only for you." : "Your role has read-only access to leads."}</Notice>
      )}
      <Field label="Company" value={form.company} onChangeText={set("company")} editable={editable} maxLength={160} error={fieldErrors.company} />
      <Field
        label="Contact name"
        value={form.contactName}
        onChangeText={set("contactName")}
        editable={editable}
        maxLength={120}
        error={fieldErrors.contactName}
      />
      <Field
        label="Contact email"
        value={form.contactEmail}
        onChangeText={set("contactEmail")}
        editable={editable}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={fieldErrors.contactEmail}
      />
      <Chips
        label="Stage"
        options={stageOrder.map((s) => ({ value: s, label: stageMeta[s].label, color: stageDot[s] }))}
        value={form.stage}
        onChange={editable ? set("stage") : () => {}}
      />
      {perms.canViewValue && (
        <Field
          label="Deal value (USD)"
          value={form.value}
          onChangeText={set("value")}
          editable={editable}
          keyboardType="decimal-pad"
          placeholder="e.g. 25000"
          error={fieldErrors.value}
        />
      )}
      {perms.canAssign ? (
        <Chips
          label="Owner"
          options={[{ value: "", label: "Unassigned" }, ...data.members.map((m) => ({ value: m.id, label: m.id === user?.id ? "You" : m.name }))]}
          value={form.ownerId}
          onChange={editable ? set("ownerId") : () => {}}
        />
      ) : null}
      {fieldErrors.ownerId && <Text style={ui.error}>{fieldErrors.ownerId}</Text>}
      <Chips
        label="Source"
        options={sources.map((s) => ({ value: s, label: s || "None" }))}
        value={form.source}
        onChange={editable ? set("source") : () => {}}
      />
      <Field label="Notes" value={form.notes} onChangeText={set("notes")} editable={editable} multiline maxLength={5000} error={fieldErrors.notes} />
      {lead && <Text style={ui.small}>Last updated {formatDateTime(lead.updated_at)}</Text>}
      {error && <Notice tone="danger">{error}</Notice>}
      {editable && (
        <View style={{ gap: 10 }}>
          <Button title={isNew ? "Add lead" : "Save changes"} onPress={save} loading={busy === "save"} disabled={busy !== null} />
          {!isNew && perms.canDelete && (
            <Button title="Delete lead" variant="secondary" onPress={remove} loading={busy === "delete"} disabled={busy !== null} />
          )}
        </View>
      )}
    </Screen>
  );
}
