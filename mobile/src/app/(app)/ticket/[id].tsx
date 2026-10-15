import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AttachButton, AttachmentList, PendingAttachments, useAttachmentUploads } from "@/components/Attachments";
import { Badge, Button, Card, Divider, ErrorView, Field, Loading, Notice, Screen, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import { parseAttachments, type Attachment } from "@/lib/attachments";
import { loadPeopleNames, useLoader } from "@/lib/data";
import type { TicketAuthorKind } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { rolePermissions, ticketChannelLabel, ticketPriorityMeta, ticketStatusMeta } from "@/lib/meta";
import { useOrg } from "@/lib/org";
import { slaTone } from "@/lib/queries";
import { formatDuration, isClosedStatus, ticketSla, type SlaClock } from "@/lib/sla";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

function clockDetail(clock: SlaClock, doneVerb: string) {
  const due = formatDateTime(new Date(clock.dueAt).toISOString());
  switch (clock.state) {
    case "met":
      return `${doneVerb} in ${formatDuration(clock.minutes)}, within target`;
    case "missed":
      return `${doneVerb} in ${formatDuration(clock.minutes)}, after the target`;
    case "breached":
      return `Overdue by ${formatDuration(clock.minutes)} (due ${due})`;
    default:
      return `Due in ${formatDuration(clock.minutes)} (${due})`;
  }
}

type ThreadItem = {
  id: string;
  authorName: string;
  authorKind: TicketAuthorKind;
  body: string;
  attachments: Attachment[];
  createdAt: string;
  opening?: boolean;
};

async function loadTicket(id: string) {
  const [{ data: ticket, error: tError }, { data: messages }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(
        "id, organization_id, reference, subject, description, priority, status, channel, requester_name, requester_email, created_by, assigned_to, created_at, updated_at, first_response_at, resolved_at, sla_first_response_minutes, sla_resolution_minutes, attachments",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("id, author_id, author_kind, body, attachments, created_at")
      .eq("ticket_id", id)
      .eq("internal", false)
      .order("created_at", { ascending: true }),
  ]);
  if (tError) throw new Error("The ticket could not be loaded. Pull to refresh.");
  if (!ticket) throw new Error("This ticket no longer exists or you no longer have access to it.");
  const thread = messages ?? [];
  const names = await loadPeopleNames([ticket.created_by, ticket.assigned_to, ...thread.map((m) => m.author_id)]);
  const opener = (ticket.created_by && names.get(ticket.created_by)) || ticket.requester_name || ticket.requester_email || "Requester";
  const items: ThreadItem[] = [
    {
      id: "opening",
      authorName: opener,
      authorKind: "client",
      body: ticket.description,
      attachments: parseAttachments(ticket.attachments),
      createdAt: ticket.created_at,
      opening: true,
    },
    ...thread.map((m) => ({
      id: m.id,
      authorName: (m.author_id && names.get(m.author_id)) || (m.author_kind === "staff" ? "Largis team" : "Former member"),
      authorKind: m.author_kind,
      body: m.body,
      attachments: parseAttachments(m.attachments),
      createdAt: m.created_at,
    })),
  ];
  return {
    ticket,
    items,
    opener,
    assignee: ticket.assigned_to ? (names.get(ticket.assigned_to) ?? "Largis team") : "Not yet assigned",
    now: Date.now(),
  };
}

type Loaded = Awaited<ReturnType<typeof loadTicket>>;

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error: loadError, loading, refreshing, refresh, reload } = useLoader(() => loadTicket(id), [id]);

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `id=eq.${id}` }, () => reload())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${id}` }, () => reload())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, reload]);

  if (loading) return <Loading />;
  if (!data) return <ErrorView message={loadError ?? "The ticket could not be loaded."} onRetry={refresh} />;
  return <TicketView data={data} refreshing={refreshing} refresh={refresh} reload={reload} />;
}

function TicketView({ data, refreshing, refresh, reload }: { data: Loaded; refreshing: boolean; refresh: () => void; reload: () => void }) {
  const { orgs } = useOrg();
  const ui = useUi();
  const { colors, tones } = useTheme();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"reply" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { ticket } = data;
  const uploads = useAttachmentUploads(ticket.organization_id);
  const role = orgs.find((o) => o.id === ticket.organization_id)?.role;
  const canEdit = role ? rolePermissions[role].canEdit : false;
  const status = ticketStatusMeta[ticket.status];
  const priority = ticketPriorityMeta[ticket.priority];
  const closed = isClosedStatus(ticket.status);
  const sla = ticketSla(ticket, data.now);

  async function sendReply() {
    if (uploads.busy) return setError("Wait for your files to finish uploading.");
    if (!reply.trim() && !uploads.ready.length) return setError("Write a reply or attach a file first.");
    setBusy("reply");
    setError(null);
    const result = await api(`/api/mobile/tickets/${ticket.id}/replies`, {
      body: { body: reply, attachments: uploads.ready.map(({ path, name }) => ({ path, name })) },
    });
    setBusy(null);
    if (!result.ok) return setError(result.fieldErrors?.body ?? result.fieldErrors?.attachments ?? result.error);
    setReply("");
    uploads.clear();
    reload();
  }

  async function toggleStatus() {
    setBusy("status");
    setError(null);
    const result = await api(`/api/mobile/tickets/${ticket.id}/status`, { body: { status: closed ? "open" : "resolved" } });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    reload();
  }

  const details: [string, string][] = [
    ["Reference", ticket.reference],
    ["Status", status.clientLabel],
    ["Priority", priority.label],
    ["Opened by", data.opener],
    ["Assigned to", data.assignee],
    ["Opened", formatDateTime(ticket.created_at)],
    ["Last updated", formatDateTime(ticket.updated_at)],
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: ticket.reference }} />
      <View style={{ gap: 8 }}>
        <Text style={[ui.title, { fontSize: 21 }]}>{ticket.subject}</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={status.tone} label={status.clientLabel} />
          <Badge tone={priority.tone} label={`${priority.label} priority`} />
        </View>
      </View>

      <Card title="Conversation">
        {data.items.map((m, i) => {
          const staff = m.authorKind === "staff";
          return (
            <View key={m.id}>
              {i > 0 && <Divider />}
              <View style={{ padding: 16, gap: 6, backgroundColor: staff ? colors.paperSoft : undefined }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={[ui.label, { flex: 1 }]}>
                    {m.authorName}
                    {staff ? " · Largis" : ""}
                  </Text>
                  <Text style={ui.small}>{formatDateTime(m.createdAt)}</Text>
                </View>
                {m.opening && <Text style={ui.small}>Opened via {ticketChannelLabel[ticket.channel].toLowerCase()}</Text>}
                {m.body ? (
                  <Text selectable style={ui.body}>
                    {m.body}
                  </Text>
                ) : null}
                <AttachmentList items={m.attachments} />
              </View>
            </View>
          );
        })}
      </Card>

      {canEdit ? (
        <Card title="Reply" padded>
          {ticket.status === "pending_client" && <Notice tone="warning">The Largis team is waiting for your reply.</Notice>}
          <Field label="Your reply" value={reply} onChangeText={setReply} multiline maxLength={10000} placeholder="Write a reply…" />
          <PendingAttachments uploads={uploads} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <AttachButton uploads={uploads} />
            <Text style={[ui.small, { flex: 1 }]}>Images, PDFs, or Office files, up to 10 MB each.</Text>
          </View>
          {error && <Text style={ui.error}>{error}</Text>}
          <Button title="Send reply" onPress={sendReply} loading={busy === "reply"} disabled={busy !== null || uploads.busy} />
          <Button
            title={closed ? "Reopen ticket" : "Mark as resolved"}
            variant="secondary"
            onPress={toggleStatus}
            loading={busy === "status"}
            disabled={busy !== null}
          />
        </Card>
      ) : (
        <Notice tone="neutral">Your role can read tickets but not reply. Ask an owner or admin if you need to respond.</Notice>
      )}

      <Card title="Details">
        {details.map(([label, value], i) => (
          <View key={label}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 11, gap: 12 }}>
              <Text style={[ui.small, { width: 100, fontSize: 13 }]}>{label}</Text>
              <Text style={[ui.body, { flex: 1, fontSize: 14 }]}>{value}</Text>
            </View>
          </View>
        ))}
      </Card>

      <Card title="Service levels">
        {(
          [
            ["First response", sla.firstResponse, "Answered"],
            ["Resolution", sla.resolution, "Resolved"],
          ] as const
        ).map(([label, clock, verb], i) => (
          <View key={label}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: "row", padding: 16, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={ui.body}>{label}</Text>
                <Text style={ui.small}>Target {formatDuration(clock.targetMinutes)}</Text>
              </View>
              <Text style={[ui.small, { flex: 1, textAlign: "right", color: tones[slaTone[clock.state]].fg }]}>
                {clockDetail(clock, verb)}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
