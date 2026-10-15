import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AttachButton, AttachmentList, PendingAttachments, useAttachmentUploads } from "@/components/Attachments";
import { EmptyState, ErrorView, Loading, useUi } from "@/components/ui";
import { api } from "@/lib/api";
import { parseAttachments, type Attachment } from "@/lib/attachments";
import { useAuth } from "@/lib/auth";
import { loadPeopleNames } from "@/lib/data";
import type { Json, TicketAuthorKind } from "@/lib/database.types";
import { formatDay } from "@/lib/format";
import { useActiveOrg } from "@/lib/org";
import { supabase } from "@/lib/supabase";
import { CONTENT_MAX_WIDTH, makeStyles, useTheme } from "@/lib/theme";

const HISTORY = 200;
const MAX_LENGTH = 4000;

type Message = {
  id: string;
  authorId: string | null;
  authorKind: TicketAuthorKind;
  authorName: string;
  body: string;
  attachments: Attachment[];
  createdAt: string;
};

type Row = { id: string; author_id: string | null; author_kind: TicketAuthorKind; body: string; attachments: Json; created_at: string };

function authorName(names: Map<string, string>, id: string | null, kind: TicketAuthorKind) {
  return (id && names.get(id)) || (kind === "staff" ? "Largis team" : "Former member");
}

function toMessage(row: Row, names: Map<string, string>): Message {
  return {
    id: row.id,
    authorId: row.author_id,
    authorKind: row.author_kind,
    authorName: authorName(names, row.author_id, row.author_kind),
    body: row.body,
    attachments: parseAttachments(row.attachments),
    createdAt: row.created_at,
  };
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

type Thread = { ok: true; messages: Message[]; names: Map<string, string> } | { ok: false };

/** The newest messages first, as the inverted list expects. */
async function fetchThread(organizationId: string): Promise<Thread> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, author_id, author_kind, body, attachments, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY);
  if (error) return { ok: false };
  const rows = data ?? [];
  const names = await loadPeopleNames(rows.map((m) => m.author_id));
  return { ok: true, names, messages: rows.map((m) => toMessage(m, names)) };
}

export default function MessagesScreen() {
  const { org } = useActiveOrg();
  return <ChatThread key={org.id} organizationId={org.id} />;
}

function ChatThread({ organizationId }: { organizationId: string }) {
  const { refreshUnread } = useActiveOrg();
  const { user } = useAuth();
  const ui = useUi();
  const s = useStyles();
  const { colors, scheme } = useTheme();
  const headerHeight = useHeaderHeight();
  const uploads = useAttachmentUploads(organizationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const names = useRef(new Map<string, string>());
  const focused = useRef(false);

  const apply = useCallback((thread: Thread) => {
    if (thread.ok) {
      names.current = thread.names;
      setMessages(thread.messages);
      setStatus("ready");
    } else {
      setStatus((st) => (st === "ready" ? st : "error"));
    }
  }, []);

  const reload = useCallback(() => fetchThread(organizationId).then(apply), [organizationId, apply]);

  const markRead = useCallback(async () => {
    await supabase.rpc("chat_mark_read", { p_org: organizationId });
    refreshUnread();
  }, [organizationId, refreshUnread]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `organization_id=eq.${organizationId}` },
        async (payload) => {
          const row = payload.new as Row;
          if (row.author_id && !names.current.has(row.author_id)) {
            const more = await loadPeopleNames([row.author_id]);
            more.forEach((v, k) => names.current.set(k, v));
          }
          const message = toMessage(row, names.current);
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [message, ...prev]));
          if (focused.current) markRead();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, markRead]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      markRead();
      reload();
      return () => {
        focused.current = false;
      };
    }, [markRead, reload]),
  );

  const canSend = Boolean(draft.trim() || uploads.ready.length) && !sending && !uploads.busy;

  async function send() {
    const body = draft.trim();
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    const result = await api<{ message: Message }>("/api/mobile/chat", {
      body: { organizationId, body, attachments: uploads.ready.map(({ path, name }) => ({ path, name })) },
    });
    setSending(false);
    if (!result.ok) return setSendError(result.error);
    setDraft("");
    uploads.clear();
    const sent = { ...result.message, attachments: result.message.attachments ?? [] };
    setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [sent, ...prev]));
  }

  if (status === "loading") return <Loading />;
  if (status === "error") return <ErrorView message="Messages could not be loaded." onRetry={reload} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={{ transform: [{ scaleY: -1 }], flex: 1, justifyContent: "center" }}>
            <EmptyState icon="chatbubbles-outline" title="Message the Largis team">
              Ask a question, share an update, or send a screenshot. Your account team replies here and you’ll get a notification.
            </EmptyState>
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = item.authorId === user?.id;
          const older = messages[index + 1];
          const newDay = !older || formatDay(older.createdAt) !== formatDay(item.createdAt);
          return (
            <View>
              {newDay && <Text style={[ui.small, s.day]}>{formatDay(item.createdAt)}</Text>}
              <View style={[s.bubbleWrap, { alignItems: mine ? "flex-end" : "flex-start" }]}>
                {!mine && (
                  <Text style={[ui.small, { marginBottom: 2 }]}>
                    {item.authorName}
                    {item.authorKind === "staff" ? " · Largis" : ""}
                  </Text>
                )}
                {item.body ? (
                  <View style={[s.bubble, mine ? s.mine : item.authorKind === "staff" ? s.staff : s.theirs]}>
                    <Text selectable style={[s.text, mine && s.mineText]}>
                      {item.body}
                    </Text>
                  </View>
                ) : null}
                {item.attachments.length > 0 && (
                  <View style={{ marginTop: item.body ? 4 : 0, maxWidth: "85%" }}>
                    <AttachmentList items={item.attachments} />
                  </View>
                )}
                <Text style={[ui.small, { marginTop: 2, fontSize: 11 }]}>{timeFormatter.format(new Date(item.createdAt))}</Text>
              </View>
            </View>
          );
        }}
      />
      {sendError && <Text style={[ui.error, { paddingHorizontal: 16, paddingBottom: 6 }]}>{sendError}</Text>}
      <View style={s.composer}>
        <View style={s.composerInner}>
          <PendingAttachments uploads={uploads} />
          <View style={s.composerRow}>
            <AttachButton uploads={uploads} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the Largis team"
              placeholderTextColor={colors.inkSubtle}
              keyboardAppearance={scheme}
              multiline
              maxLength={MAX_LENGTH}
              style={s.input}
              accessibilityLabel="Message"
            />
            <Pressable
              onPress={send}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={[s.send, !canSend && { opacity: 0.4 }]}
            >
              <Ionicons name="arrow-up" size={20} color={colors.onBrand} />
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  list: { padding: 16, gap: 10, flexGrow: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  day: { textAlign: "center", marginVertical: 8 },
  bubbleWrap: { maxWidth: "100%" },
  bubble: { maxWidth: "85%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  mine: { backgroundColor: c.brand, borderBottomRightRadius: 4 },
  mineText: { color: c.onBrand },
  staff: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderBottomLeftRadius: 4 },
  theirs: { backgroundColor: c.paperSoft, borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 21, color: c.ink },
  composer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
    backgroundColor: c.surface,
  },
  composerInner: { gap: 8, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  input: {
    flex: 1,
    maxHeight: 140,
    minHeight: 40,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: c.ink,
    backgroundColor: c.paper,
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brand, alignItems: "center", justifyContent: "center", marginLeft: 4 },
}));
