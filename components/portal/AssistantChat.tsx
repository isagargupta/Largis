"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  History,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Markdown } from "@/components/portal/Markdown";
import { PageHeader } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { parseSources, type AssistantSource } from "@/lib/knowledge";
import { deleteAssistantConversation, setAssistantFeedback } from "@/lib/portal/actions/knowledge";
import { formatDateTime } from "@/lib/portal/format";
import { portalHref } from "@/lib/portal/hosts";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: AssistantSource[];
  answered: boolean;
  feedback: -1 | 1 | null;
  /** Client-only: still streaming, or never saved (no id to rate). */
  pending?: boolean;
  unsaved?: boolean;
  error?: string;
};

type Conversation = { id: string; title: string; updated_at: string };

const MAX_QUESTION = 4000;

const STARTERS = [
  "A client wants to know what's included in our retainer. What should I tell them?",
  "What's our refund and cancellation policy?",
  "How long does a typical project take from kickoff to launch?",
  "Draft a polite reply to a client asking for a discount.",
];

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

/** Turns the model's [n] citations into links to the cited knowledge base entry. */
function withCitationLinks(content: string, sources: AssistantSource[]) {
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  return content.replace(/\[(\d{1,2})\](?!\()/g, (match, digits: string) => {
    const source = byNumber.get(Number(digits));
    if (!source) return match;
    const label = Array.from(digits, (d) => SUPERSCRIPT[Number(d)]).join("");
    return `[${label}](${portalHref(`/staff/knowledge/${source.documentId}`)})`;
  });
}

function plainText(content: string) {
  return content.replace(/\s?\[\d{1,2}\](?!\()/g, "");
}

function tempId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AssistantChat({
  conversationId,
  initialMessages,
  conversations,
  configured,
  readyCount,
  canManage,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  conversations: Conversation[];
  configured: boolean;
  readyCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const convoRef = useRef<string | null>(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const update = (id: string, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) =>
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m)));

  async function ask(question: string) {
    const text = question.trim();
    if (!text || streaming) return;
    setNotice(null);
    setInput("");
    stickToBottom.current = true;

    const userId = tempId();
    const answerId = tempId();
    setMessages((all) => [
      ...all,
      { id: userId, role: "user", content: text, sources: [], answered: true, feedback: null, unsaved: true },
      { id: answerId, role: "assistant", content: "", sources: [], answered: true, feedback: null, pending: true, unsaved: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    const startedNew = !convoRef.current;
    let finalId: string | null = null;

    try {
      const res = await fetch("/api/staff/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convoRef.current, message: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessages((all) => all.filter((m) => m.id !== userId && m.id !== answerId));
        setInput(text);
        setNotice(body?.error ?? "Largis AI couldn't answer just now. Try again in a moment.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        if (!line.trim()) return;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.type === "meta") {
          if (typeof event.conversationId === "string") convoRef.current = event.conversationId;
          update(answerId, { sources: parseSources(event.sources), answered: event.answered !== false });
        } else if (event.type === "delta" && typeof event.text === "string") {
          const piece = event.text;
          update(answerId, (m) => ({ content: m.content + piece }));
        } else if (event.type === "done") {
          finalId = typeof event.messageId === "string" ? event.messageId : null;
        } else if (event.type === "error") {
          update(answerId, { error: typeof event.error === "string" ? event.error : "Something went wrong." });
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer + decoder.decode());
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        update(answerId, (m) => (m.content ? {} : { error: "The connection dropped. Check your internet and try again." }));
      }
    } finally {
      const saved = finalId;
      update(answerId, (m) => ({ pending: false, ...(saved ? { id: saved, unsaved: false } : {}), ...(!m.content && !m.error ? { error: "Stopped." } : {}) }));
      abortRef.current = null;
      setStreaming(false);
      if (startedNew && convoRef.current) {
        router.replace(portalHref(`/staff/assistant/${convoRef.current}`), { scroll: false });
      } else {
        router.refresh();
      }
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(input);
    }
  }

  async function rate(message: ChatMessage, value: -1 | 1) {
    const next = message.feedback === value ? null : value;
    update(message.id, { feedback: next });
    const result = await setAssistantFeedback(message.id, next);
    if (!result.ok) {
      update(message.id, { feedback: message.feedback });
      setNotice("Your feedback couldn't be saved. Try again.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    const result = await deleteAssistantConversation(id);
    if (!result.ok) return setNotice("The conversation couldn't be deleted. Try again.");
    if (id === conversationId) router.push(portalHref("/staff/assistant"));
    else router.refresh();
  }

  const blocked = !configured ? "off" : readyCount === 0 ? "empty" : null;
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Largis AI"
        title="Ask Largis AI"
        description="Answers come only from the company knowledge base, with sources. Check anything important before you send it to a client."
        actions={
          <ButtonLink href={portalHref("/staff/knowledge")} variant="outline" size="sm">
            <BookOpen className="h-4 w-4" />
            Knowledge base
          </ButtonLink>
        }
      />

      <div className="grid h-[calc(100vh-15rem)] min-h-[520px] border border-line bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={cn("min-h-0 flex-col lg:flex lg:border-r lg:border-line", showHistory ? "flex" : "hidden")}>
          <div className="flex items-center gap-2 border-b border-line p-3">
            <Link
              href={portalHref("/staff/assistant")}
              onClick={() => setShowHistory(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 border border-line px-3 py-2 text-sm font-medium hover:bg-paper-soft"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </Link>
            <button type="button" onClick={() => setShowHistory(false)} className="px-2 py-2 text-sm text-ink-muted hover:text-ink lg:hidden">
              Close
            </button>
          </div>
          {conversations.length ? (
            <ul className="flex-1 overflow-y-auto py-1">
              {conversations.map((c) => {
                const active = c.id === conversationId;
                return (
                  <li key={c.id} className="group relative">
                    <Link
                      href={portalHref(`/staff/assistant/${c.id}`)}
                      onClick={() => setShowHistory(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block border-l-2 py-2.5 pl-4 pr-10 transition-colors",
                        active ? "border-brand-600 bg-brand-50" : "border-transparent hover:bg-paper-soft/70",
                      )}
                    >
                      <span className="block truncate text-sm">{c.title}</span>
                      <span className="block text-xs text-ink-subtle">{formatDateTime(c.updated_at)}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      aria-label={`Delete conversation: ${c.title}`}
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-ink-subtle opacity-0 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-ink-subtle">Your conversations are private to you and appear here.</p>
          )}
        </aside>

        <section className={cn("min-h-0 min-w-0 flex-col", showHistory ? "hidden lg:flex" : "flex")}>
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 lg:hidden">
            <button type="button" onClick={() => setShowHistory(true)} className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
              <History className="h-4 w-4" />
              Conversations
            </button>
            {conversationId && (
              <Link href={portalHref("/staff/assistant")} className="inline-flex items-center gap-1.5 text-sm text-brand-700">
                <MessageSquarePlus className="h-4 w-4" />
                New chat
              </Link>
            )}
          </div>

          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <Welcome blocked={blocked} canManage={canManage} readyCount={readyCount} onPick={(q) => void ask(q)} />
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((m) =>
                  m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap break-words bg-brand-50 px-4 py-3 text-[15px] text-ink">{m.content}</p>
                    </div>
                  ) : (
                    <AnswerBubble key={m.id} message={m} onRate={(v) => void rate(m, v)} />
                  ),
                )}
              </div>
            )}
          </div>

          <div className="border-t border-line p-3 sm:p-4">
            {notice && (
              <p role="alert" className="mx-auto mb-3 flex max-w-3xl items-start gap-2 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {notice}
              </p>
            )}
            <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">
                Ask Largis AI
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_QUESTION))}
                onKeyDown={onKeyDown}
                rows={Math.min(6, Math.max(1, input.split("\n").length))}
                disabled={blocked === "off"}
                placeholder={blocked === "off" ? "Largis AI isn't switched on yet" : "Ask about our services, pricing, policies, or how to reply to a client…"}
                className="min-h-[44px] flex-1 resize-none border border-line bg-white px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-brand-600 disabled:bg-paper-soft"
                autoFocus
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  aria-label="Stop answering"
                  className="grid h-11 w-11 shrink-0 place-items-center border border-line text-ink hover:bg-paper-soft"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || blocked === "off"}
                  aria-label="Send question"
                  className="grid h-11 w-11 shrink-0 place-items-center bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              )}
            </form>
            <p className="mx-auto mt-2 max-w-3xl text-xs text-ink-subtle">
              Enter to send, Shift + Enter for a new line. Don&apos;t paste client passwords or card details.
              {lastQuestion && !streaming && messages.at(-1)?.error && (
                <>
                  {" "}
                  <button type="button" onClick={() => void ask(lastQuestion)} className="font-medium text-brand-700 hover:underline">
                    Ask again
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Welcome({ blocked, canManage, readyCount, onPick }: { blocked: "off" | "empty" | null; canManage: boolean; readyCount: number; onPick: (q: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-6 text-center">
      <span className="grid h-12 w-12 place-items-center bg-brand-50 text-brand-700">
        <Sparkles className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.01em]">How can I help with a client today?</h2>
      {blocked === "off" ? (
        <p className="mt-2 text-sm text-ink-muted">
          Largis AI isn&apos;t switched on yet. An admin needs to add the OpenAI API key to the deployment.
        </p>
      ) : blocked === "empty" ? (
        <p className="mt-2 text-sm text-ink-muted">
          The knowledge base is empty, so there&apos;s nothing to answer from yet.{" "}
          {canManage ? (
            <Link href={portalHref("/staff/knowledge")} className="font-medium text-brand-700 hover:underline">
              Add company information
            </Link>
          ) : (
            "Ask an admin or manager to add company information."
          )}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-ink-muted">
            Ask anything a client has asked you. I answer from {readyCount} knowledge base {readyCount === 1 ? "entry" : "entries"} and show where each answer comes from. I can also draft a reply for you to review.
          </p>
          <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
            {STARTERS.map((q) => (
              <button key={q} type="button" onClick={() => onPick(q)} className="border border-line px-4 py-3 text-left text-sm text-ink-muted hover:border-brand-600 hover:text-ink">
                {q}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnswerBubble({ message, onRate }: { message: ChatMessage; onRate: (value: -1 | 1) => void }) {
  const [copied, setCopied] = useState(false);
  const cited = new Set(Array.from(message.content.matchAll(/\[(\d{1,2})\]/g), (m) => Number(m[1])));
  const sources = message.sources.filter((s) => cited.has(s.n));
  const shownSources = sources.length ? sources : message.pending ? [] : message.sources.slice(0, 3);

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center bg-night text-white">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        {!message.answered && !message.pending && (
          <Badge tone="warning" className="mb-2">
            Not in the knowledge base
          </Badge>
        )}
        {message.content ? (
          <Markdown source={withCitationLinks(message.content, message.sources)} className="text-[15px] text-ink" />
        ) : message.pending ? (
          <p className="flex items-center gap-2 text-sm text-ink-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching the knowledge base…
          </p>
        ) : null}
        {message.error && (
          <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {message.error}
          </p>
        )}

        {!message.pending && shownSources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {shownSources.map((s) => (
              <Link
                key={s.n}
                href={portalHref(`/staff/knowledge/${s.documentId}`)}
                className="inline-flex max-w-full items-center gap-1.5 border border-line px-2.5 py-1 text-xs text-ink-muted hover:border-brand-600 hover:text-ink"
                title={s.heading ? `${s.title} › ${s.heading}` : s.title}
              >
                <span className="font-semibold text-brand-700">{s.n}</span>
                <span className="truncate">
                  {s.title}
                  {s.heading ? ` › ${s.heading}` : ""}
                </span>
              </Link>
            ))}
          </div>
        )}

        {!message.pending && message.content && (
          <div className="mt-2 flex items-center gap-1 text-ink-subtle">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(plainText(message.content));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs hover:text-ink"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {!message.unsaved && (
              <>
                <button
                  type="button"
                  onClick={() => onRate(1)}
                  aria-label="Helpful"
                  aria-pressed={message.feedback === 1}
                  className={cn("grid h-7 w-7 place-items-center hover:text-ink", message.feedback === 1 && "text-emerald-700")}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", message.feedback === 1 && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={() => onRate(-1)}
                  aria-label="Not helpful"
                  aria-pressed={message.feedback === -1}
                  className={cn("grid h-7 w-7 place-items-center hover:text-ink", message.feedback === -1 && "text-red-700")}
                >
                  <ThumbsDown className={cn("h-3.5 w-3.5", message.feedback === -1 && "fill-current")} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
