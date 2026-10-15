"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, Loader2, MessagesSquare, SendHorizontal } from "lucide-react";
import { AttachButton, AttachmentList, PendingAttachments, useAttachmentUploads } from "@/components/portal/Attachments";
import { compactControl } from "@/components/portal/control-styles";
import { parseAttachments, type Attachment } from "@/lib/attachments";
import { markChatRead, sendChatMessage } from "@/lib/portal/actions/chat";
import type { ChatMessageView } from "@/lib/portal/chat";
import { portalHref } from "@/lib/portal/hosts";
import { createClient } from "@/lib/supabase/client";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import type { Json, TicketAuthorKind } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type Audience = "client" | "staff";
type Pending = { tempId: string; body: string; attachments: Attachment[]; error?: string };

const MAX_LENGTH = 4000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function mergeMessages(...lists: ChatMessageView[][]) {
  const byId = new Map<string, ChatMessageView>();
  for (const list of lists) for (const m of list) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Staff shortcut to open (or start) the conversation with any client. */
export function NewConversationPicker({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="block">
      <span className="sr-only">Message a client</span>
      <select
        defaultValue=""
        onChange={(e) => e.target.value && router.push(portalHref(`/staff/messages/${e.target.value}`))}
        className={cn(compactControl, "w-full")}
      >
        <option value="" disabled>
          Message a client…
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function useTimeZone() {
  // Server and first client render agree on UTC; local time takes over after hydration.
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return tz;
}

export function ChatRoom({
  organizationId,
  audience,
  viewerId,
  initialMessages,
  names,
  hadUnread,
  truncated,
  counterpartLabel,
  emptyText,
  className,
}: {
  organizationId: string;
  audience: Audience;
  viewerId: string;
  initialMessages: ChatMessageView[];
  names: Record<string, string>;
  hadUnread: boolean;
  truncated?: boolean;
  counterpartLabel: string;
  emptyText: string;
  className?: string;
}) {
  const router = useRouter();
  const tz = useTimeZone();
  const [live, setLive] = useState<ChatMessageView[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const uploads = useAttachmentUploads(organizationId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout>>();

  const messages = useMemo(() => mergeMessages(live, initialMessages), [live, initialMessages]);

  const markRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => void markChatRead(organizationId), 1500);
  }, [organizationId]);

  useEffect(() => {
    void markChatRead(organizationId).then(() => {
      if (hadUnread) router.refresh();
    });
    // Only on opening the conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(readTimer.current);
    };
  }, [markRead]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            author_id: string | null;
            author_kind: TicketAuthorKind;
            body: string;
            attachments: Json;
            created_at: string;
          };
          const known = row.author_id ? names[row.author_id] : undefined;
          setLive((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    authorId: row.author_id,
                    authorKind: row.author_kind,
                    authorName: known ?? (row.author_kind === "staff" ? "Largis team" : "Team member"),
                    body: row.body,
                    attachments: parseAttachments(row.attachments),
                    createdAt: row.created_at,
                  },
                ],
          );
          if (!known && row.author_id !== viewerId) router.refresh();
          if (row.author_id !== viewerId && document.visibilityState === "visible") markRead();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId, names, viewerId, router, markRead]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  async function deliver(body: string, attachments: Attachment[], tempId: string) {
    setSending(true);
    stickToBottom.current = true;
    const result = await sendChatMessage(
      organizationId,
      body,
      attachments.map(({ path, name }) => ({ path, name })),
    );
    setSending(false);
    if (result.ok) {
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      setLive((prev) => (prev.some((m) => m.id === result.message.id) ? prev : [...prev, result.message]));
    } else {
      setPending((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, error: result.error } : p)));
    }
  }

  const canSend = Boolean(draft.trim() || uploads.ready.length) && !sending && !uploads.busy;

  function submit() {
    const body = draft.trim();
    if (!canSend) return;
    const tempId = `pending-${Date.now()}`;
    const attachments = uploads.ready;
    setPending((prev) => [...prev, { tempId, body, attachments }]);
    setDraft("");
    uploads.clear();
    void deliver(body, attachments, tempId);
    inputRef.current?.focus();
  }

  function retry(p: Pending) {
    setPending((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, error: undefined } : x)));
    void deliver(p.body, p.attachments, p.tempId);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const dayFormat = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: tz }),
    [tz],
  );
  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }),
    [tz],
  );

  const ownSide: TicketAuthorKind = audience;

  return (
    <section className={cn("flex min-h-[420px] flex-col border border-line bg-white", className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        aria-live="polite"
        aria-label={`Conversation with ${counterpartLabel}`}
      >
        {truncated && (
          <p className="mb-4 text-center text-xs text-ink-subtle">Showing the most recent 200 messages.</p>
        )}
        {!messages.length && !pending.length ? (
          <div className="grid h-full place-items-center px-4 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-11 w-11 place-items-center border border-line text-ink-subtle">
                <MessagesSquare className="h-5 w-5" />
              </div>
              <p className="text-[15px] font-medium">No messages yet</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{emptyText}</p>
            </div>
          </div>
        ) : (
          <ol className="space-y-1">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const day = dayFormat.format(new Date(m.createdAt));
              const newDay = !prev || dayFormat.format(new Date(prev.createdAt)) !== day;
              const grouped =
                !newDay &&
                prev?.authorId === m.authorId &&
                prev?.authorKind === m.authorKind &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;
              const mine = m.authorId === viewerId;
              const sameSide = m.authorKind === ownSide;
              const label = mine
                ? "You"
                : m.authorKind === "staff" && audience === "client"
                  ? `${m.authorName} · Largis`
                  : m.authorName;

              return (
                <li key={m.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-xs text-ink-subtle" role="separator">
                      <span className="h-px flex-1 bg-line" />
                      <span>{day}</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <div className={cn("flex flex-col", sameSide ? "items-end" : "items-start", !grouped && "mt-3")}>
                    {!grouped && (
                      <p className="mb-1 px-1 text-xs text-ink-subtle">
                        <span className="font-medium text-ink-muted">{label}</span>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={m.createdAt}>{timeFormat.format(new Date(m.createdAt))}</time>
                      </p>
                    )}
                    {m.body && (
                      <p
                        className={cn(
                          "max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[70%]",
                          mine
                            ? "bg-brand-600 text-white"
                            : sameSide
                              ? "border border-brand-100 bg-brand-50 text-ink"
                              : "border border-line bg-paper text-ink",
                        )}
                        title={grouped ? timeFormat.format(new Date(m.createdAt)) : undefined}
                      >
                        {m.body}
                      </p>
                    )}
                    <AttachmentList items={m.attachments} className={cn("max-w-[85%] sm:max-w-[70%]", m.body && "mt-1.5")} />
                  </div>
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.tempId} className="mt-3 flex flex-col items-end">
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words px-3.5 py-2 text-[15px] leading-relaxed sm:max-w-[70%]",
                    p.error ? "border border-red-200 bg-red-50 text-ink" : "bg-brand-600/70 text-white",
                  )}
                >
                  {p.body ||
                    (p.attachments.length === 1 ? p.attachments[0].name : `${p.attachments.length} files`)}
                </p>
                {p.error ? (
                  <p className="mt-1 flex items-center gap-1.5 px-1 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {p.error}
                    <button type="button" onClick={() => retry(p)} className="font-medium underline underline-offset-2">
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => setPending((prev) => prev.filter((x) => x.tempId !== p.tempId))}
                      className="text-ink-subtle underline underline-offset-2"
                    >
                      Discard
                    </button>
                  </p>
                ) : (
                  <p className="mt-1 px-1 text-xs text-ink-subtle">Sending…</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-line p-3 sm:p-4"
      >
        <label htmlFor={`chat-input-${organizationId}`} className="sr-only">
          Message {counterpartLabel}
        </label>
        <PendingAttachments uploads={uploads} />
        <div className={cn("flex items-end gap-2", uploads.uploads.length > 0 && "mt-2")}>
          <AttachButton uploads={uploads} />
          <textarea
            id={`chat-input-${organizationId}`}
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault();
                uploads.add(e.clipboardData.files);
              }
            }}
            placeholder={`Message ${counterpartLabel}`}
            className={cn(compactControl, "min-h-[44px] flex-1 resize-none py-2.5 text-[15px] leading-snug")}
          />
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="grid h-11 w-11 shrink-0 place-items-center bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 hidden text-xs text-ink-subtle sm:block">
          Enter to send · Shift + Enter for a new line · Attach or paste images, PDFs, and Office files up to 10 MB
        </p>
      </form>
    </section>
  );
}
