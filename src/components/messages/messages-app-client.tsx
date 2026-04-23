"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  listMessageThreads,
  listRepairMessages,
  adminReplyToGarage,
  deleteRepairMessage,
  markGarageRepliesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import {
  MessageSquare,
  ChevronLeft,
  ArrowUpRight,
  Send,
  Search,
  Wrench,
  Loader2,
  Trash2,
} from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VoiceRecorder, type VoiceClip } from "@/components/garage/voice-recorder";
import { VoicePlayer } from "@/components/voice-player";
import { uploadVoiceNote } from "@/lib/upload-voice-note";

type Thread = Awaited<ReturnType<typeof listMessageThreads>>[number];

interface Props {
  initialThreads: Thread[];
}

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fullTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

/**
 * Chat-style messages hub.
 *
 * Desktop / tablet (≥lg): twee kolommen — links de gesprekslijst, rechts
 * de actieve thread. Mobiel: één paneel — klik een gesprek om de thread
 * te openen, pijltje terug om weer naar de lijst.
 *
 * Polling volgt hetzelfde patroon als AdminRepairThread: om de 8s de
 * thread verversen, exponentiële backoff bij fouten, pauze als tab
 * onzichtbaar is.
 */
export function MessagesAppClient({ initialThreads }: Props) {
  const searchParams = useSearchParams();
  const deepLinkRepair = searchParams?.get("repair") ?? null;
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeId, setActiveId] = useState<string | null>(
    deepLinkRepair ?? initialThreads[0]?.repairJobId ?? null,
  );

  // If the deep-link target arrives later (e.g. after polling refresh),
  // still honour it the first time we see it in the thread list.
  useEffect(() => {
    if (!deepLinkRepair) return;
    setActiveId(deepLinkRepair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkRepair]);
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftVoice, setDraftVoice] = useState<VoiceClip | null>(null);
  // Dummy t() — VoiceRecorder heeft een i18n-callback uit de garage-
  // wereld. Op admin werken we altijd in Engels; we geven de Engelse
  // label terug en negeren de andere twee.
  const recorderT = useCallback((en: string, _es: string, _nl: string) => en, []);
  const [isSending, startSending] = useTransition();
  const [search, setSearch] = useState("");

  // Polling backoff
  const threadFailRef = useRef(0);
  const messageFailRef = useRef(0);

  const activeThread = threads.find((t) => t.repairJobId === activeId) ?? null;

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter((t) =>
      [
        t.customerName,
        t.publicCode,
        t.title,
        t.lastBody,
        t.lastAuthor,
      ]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q)),
    );
  }, [threads, search]);

  const refreshThreads = useCallback(async () => {
    try {
      const next = await listMessageThreads();
      threadFailRef.current = 0;
      setThreads(next);
    } catch {
      threadFailRef.current += 1;
    }
  }, []);

  const refreshMessages = useCallback(
    async (repairId: string, { markRead = true }: { markRead?: boolean } = {}) => {
      try {
        const next = await listRepairMessages(repairId);
        messageFailRef.current = 0;
        setMessages(next);
        if (markRead) {
          await markGarageRepliesRead(repairId).catch(() => {});
        }
      } catch {
        messageFailRef.current += 1;
      }
    },
    [],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      const ok = await confirmDialog({
        title: "Delete this message?",
        description: "The message disappears for both admins and the garage thread.",
        confirmLabel: "Delete",
        tone: "destructive",
      });
      if (!ok) return;
      // Optimistisch verwijderen zodat het direct voelt; rollback bij fout.
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      try {
        const res = await deleteRepairMessage(messageId);
        if (!res.success) {
          toast.error("Could not delete — refresh.");
          if (activeId) refreshMessages(activeId, { markRead: false });
        }
      } catch {
        toast.error("Could not delete");
        if (activeId) refreshMessages(activeId, { markRead: false });
      }
    },
    [activeId, refreshMessages],
  );

  // Eerste load + wisselen van gesprek
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    refreshMessages(activeId).finally(() => {
      if (!cancelled) setLoadingMessages(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, refreshMessages]);

  // Threads pollen
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const fails = threadFailRef.current;
      const base = 8000;
      const ms = fails === 0 ? base : Math.min(60_000, base * Math.pow(2, fails));
      timer = setTimeout(async () => {
        if (typeof document !== "undefined" && document.hidden) {
          tick();
          return;
        }
        await refreshThreads();
        tick();
      }, ms);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refreshThreads]);

  // Actieve thread pollen
  useEffect(() => {
    if (!activeId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const fails = messageFailRef.current;
      const base = 8000;
      const ms = fails === 0 ? base : Math.min(60_000, base * Math.pow(2, fails));
      timer = setTimeout(async () => {
        if (typeof document !== "undefined" && document.hidden) {
          tick();
          return;
        }
        await refreshMessages(activeId, { markRead: false });
        tick();
      }, ms);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeId, refreshMessages]);

  // Auto-scroll naar beneden zodra er nieuwe berichten komen
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll naar beneden — smooth als het dicht in de buurt was, direct
    // als we net een nieuw gesprek openen.
    el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  async function handleSend() {
    const body = draft.trim();
    const voice = draftVoice;
    if ((!body && !voice) || !activeId || isSending) return;
    startSending(async () => {
      try {
        const res = await adminReplyToGarage(activeId, body);
        // Voice na tekst-insert koppelen zodat we messageId hebben.
        if (voice && res?.messageId) {
          const ok = await uploadVoiceNote({
            clip: voice,
            ownerType: "repair_message",
            ownerId: res.messageId,
            repairJobId: activeId,
          });
          if (!ok) {
            toast.warning("Message sent without voice — upload failed");
          }
        }
        setDraft("");
        setDraftVoice(null);
        await refreshMessages(activeId, { markRead: false });
        await refreshThreads();
        toast.success("Sent");
      } catch {
        toast.error("Could not send");
      }
    });
  }

  return (
    <div
      // -m-3 md:-m-4 kanselleert de <main> padding zodat de chat tegen
      // de randen van de viewport zit zoals een echte messaging-app.
      // h-[calc(100dvh-...)] vult de hoogte tussen header en mobile-nav;
      // op lg+ is er geen bottom-nav dus dan 3.25rem voor alleen de header.
      className="-m-3 flex h-[calc(100dvh-3.25rem-5rem)] flex-col overflow-hidden bg-background md:-m-4 lg:h-[calc(100dvh-3.25rem)] lg:flex-row"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ── Thread list (links op lg+, full-screen op mobiel als er geen actief gesprek is) ── */}
      <aside
        className={cn(
          "flex min-h-0 flex-col border-r border-border/60 bg-card/40 dark:bg-card/[0.02] lg:w-[340px] lg:shrink-0",
          activeId ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="border-b border-border/60 px-4 py-3">
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            Messages
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Garage ↔ office
          </p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full rounded-lg border border-border/60 bg-background/80 pl-8 pr-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {threads.length === 0 ? "No conversations yet" : "No matches"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {threads.length === 0
                  ? "Messages from the garage tablet appear here."
                  : "Try a different search."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filteredThreads.map((t) => (
                <li key={t.repairJobId}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.repairJobId)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      t.repairJobId === activeId
                        ? "bg-muted/70 dark:bg-card/[0.08]"
                        : t.unreadCount > 0
                          ? "bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.08]"
                          : "hover:bg-muted/50 dark:hover:bg-card/[0.04]",
                    )}
                  >
                    <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground dark:bg-card/[0.08]">
                      <MessageSquare className="h-4 w-4" />
                      {t.unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                          {t.unreadCount > 9 ? "9+" : t.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {t.customerName ?? "Unknown customer"}
                        </p>
                        {t.lastAt ? (
                          <span className="shrink-0 text-[11px] text-muted-foreground/70">
                            {relativeTime(t.lastAt)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {t.publicCode ? (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground dark:bg-card/[0.06]">
                            {t.publicCode}
                          </span>
                        ) : null}
                        <span className="truncate text-[10.5px] uppercase tracking-wide text-muted-foreground/70">
                          {statusLabel(t.status)}
                        </span>
                      </div>
                      {t.lastBody ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          <span className="font-medium text-muted-foreground/80">
                            {t.lastDirection === "garage_to_admin"
                              ? (t.lastAuthor ?? "Garage")
                              : "You"}
                            :
                          </span>{" "}
                          {t.lastBody}
                        </p>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Thread view (rechts op lg+, full-screen op mobiel als gesprek open is) ── */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          activeId ? "flex" : "hidden lg:flex",
        )}
      >
        {activeThread ? (
          <ChatPanel
            thread={activeThread}
            messages={messages}
            loading={loadingMessages}
            draft={draft}
            setDraft={setDraft}
            draftVoice={draftVoice}
            setDraftVoice={setDraftVoice}
            recorderT={recorderT}
            onSend={handleSend}
            isSending={isSending}
            onBack={() => setActiveId(null)}
            scrollRef={scrollRef}
            onDeleteMessage={handleDeleteMessage}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium">Pick a conversation</p>
            <p className="text-xs opacity-70">
              Messages between office and garage tablets live here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function ChatPanel({
  thread,
  messages,
  loading,
  draft,
  setDraft,
  draftVoice,
  setDraftVoice,
  recorderT,
  onSend,
  isSending,
  onBack,
  scrollRef,
  onDeleteMessage,
}: {
  thread: Thread;
  messages: RepairMessage[];
  loading: boolean;
  draft: string;
  setDraft: (v: string) => void;
  draftVoice: VoiceClip | null;
  setDraftVoice: (v: VoiceClip | null) => void;
  recorderT: (en: string, es: string, nl: string) => string;
  onSend: () => void;
  isSending: boolean;
  onBack: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onDeleteMessage: (id: string) => void;
}) {
  // Groepeer per dag voor eenvoudige day-separators
  const grouped = useMemo(() => {
    const map = new Map<string, RepairMessage[]>();
    for (const m of messages) {
      const key = new Date(m.createdAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([_, list]) => ({
      day: new Date(list[0].createdAt),
      messages: list,
    }));
  }, [messages]);

  return (
    <>
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/60 bg-card/60 px-3 py-2.5 backdrop-blur dark:bg-card/[0.02] sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Back to conversations"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground dark:bg-card/[0.08]">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {thread.customerName ?? "Unknown customer"}
            </p>
            {thread.publicCode ? (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground dark:bg-card/[0.06]">
                {thread.publicCode}
              </span>
            ) : null}
          </div>
          {thread.title ? (
            <p className="truncate text-[11.5px] text-muted-foreground/70">
              {thread.title}
            </p>
          ) : null}
        </div>
        <Link
          href={`/repairs/${thread.repairJobId}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Open repair"
        >
          <Wrench className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Open repair</span>
          <ArrowUpRight className="h-3 w-3 opacity-60" />
        </Link>
      </header>

      {/* Messages scroll */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs opacity-70">
              Type below to start — the garage tablet will see it right away.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
            {grouped.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1.5">
                <div className="my-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {dayLabel(g.day)}
                  </span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                {g.messages.map((m) => {
                  const mine = m.direction === "admin_to_garage";
                  const author =
                    m.direction === "admin_to_garage"
                      ? "You"
                      : (m.authorName ?? "Garage");
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "group/msg flex flex-col gap-0.5",
                        mine ? "items-end" : "items-start",
                      )}
                    >
                      <div
                        className={cn(
                          "flex max-w-[85%] flex-col gap-2 rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                          mine
                            ? "bg-foreground text-background"
                            : "bg-muted text-foreground dark:bg-card/[0.08]",
                        )}
                      >
                        {/* Toon body alleen als het niet de voice-placeholder
                            is OF als er geen voice bij hoort. Voorkomt dat
                            "🎙 Voice message" naast een player staat. */}
                        {(!m.voice || m.body !== "🎙 Voice message") && (
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        )}
                        {m.voice ? (
                          <div className={mine ? "-mx-0.5" : "-mx-0.5"}>
                            <VoicePlayer
                              url={m.voice.url}
                              durationSeconds={m.voice.durationSeconds}
                              size="sm"
                              label="voice"
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-muted-foreground/70">
                        <span>{author}</span>
                        <span>·</span>
                        <span>{fullTime(new Date(m.createdAt))}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(m.id)}
                          title="Delete message"
                          aria-label="Delete message"
                          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover/msg:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-card/60 px-3 py-3 backdrop-blur dark:bg-card/[0.02] sm:px-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder="Message garage… (⌘/Ctrl + Enter)"
              className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              disabled={(!draft.trim() && !draftVoice) || isSending}
              onClick={onSend}
              className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-foreground text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <VoiceRecorder value={draftVoice} onChange={setDraftVoice} t={recorderT} />
        </div>
      </div>
    </>
  );
}
