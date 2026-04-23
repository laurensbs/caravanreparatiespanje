"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Send, X, ArrowUpRight } from "lucide-react";
import {
  adminReplyToGarage,
  listRepairMessages,
  markGarageRepliesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import { VoicePlayer } from "@/components/voice-player";

/**
 * Popup chat-drawer that opens on top of whatever admin page the user
 * is on when they click a garage-message notification. We don't
 * navigate them away — they keep their context (e.g. a repair-detail
 * they were editing) and can reply inline.
 */
export function QuickChatModal({
  repairJobId,
  repairLabel,
  onClose,
}: {
  repairJobId: string;
  repairLabel: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const failRef = useRef(0);

  const refresh = useCallback(
    async ({ markRead = true }: { markRead?: boolean } = {}) => {
      try {
        const list = await listRepairMessages(repairJobId);
        failRef.current = 0;
        setMessages(list);
        if (markRead) await markGarageRepliesRead(repairJobId).catch(() => {});
      } catch {
        failRef.current += 1;
      }
    },
    [repairJobId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Polling — 5s while the modal is open. Cheap: one query, one job.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const base = 5000;
      const ms = failRef.current === 0 ? base : Math.min(60_000, base * Math.pow(2, failRef.current));
      timer = setTimeout(async () => {
        if (typeof document !== "undefined" && document.hidden) {
          tick();
          return;
        }
        await refresh({ markRead: true });
        tick();
      }, ms);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  // Auto-scroll bottom as new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ESC closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grouped = useMemo(() => {
    const map = new Map<string, RepairMessage[]>();
    for (const m of messages) {
      const key = new Date(m.createdAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.values()).map((list) => ({
      day: new Date(list[0].createdAt),
      list,
    }));
  }, [messages]);

  function dayLabel(d: Date): string {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    startSending(async () => {
      try {
        await adminReplyToGarage(repairJobId, body);
        setDraft("");
        await refresh({ markRead: false });
      } catch {
        toast.error("Could not send");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[180] flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <div className="relative z-10 flex h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border/60 bg-card shadow-2xl dark:border-border sm:h-[80vh] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-border">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Garage</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{repairLabel}</p>
          </div>
          <Link
            href={`/messages?repair=${repairJobId}`}
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/60 dark:hover:bg-foreground/[0.04]"
            title="Open in Messages"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Open
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 dark:hover:bg-foreground/[0.04]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : messages.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
              {grouped.map((g, gi) => (
                <div key={gi} className="flex flex-col gap-1.5">
                  <div className="my-2 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/60" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {dayLabel(g.day)}
                    </span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  {g.list.map((m) => {
                    const mine = m.direction === "admin_to_garage";
                    const author = mine ? "You" : m.authorName ?? "Garage";
                    const time = new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`flex max-w-[85%] flex-col gap-2 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? "bg-emerald-500 text-white"
                              : "bg-muted text-foreground dark:bg-foreground/[0.08]"
                          }`}
                        >
                          {(!m.voice || m.body !== "🎙 Voice message") && (
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          )}
                          {m.voice ? (
                            <VoicePlayer
                              url={m.voice.url}
                              durationSeconds={m.voice.durationSeconds}
                              size="sm"
                              label="voice"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-muted-foreground">
                          <span>{author}</span>
                          <span>·</span>
                          <span>{time}</span>
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
        <div className="border-t border-border/60 bg-card/95 p-3 dark:border-border">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Reply to garage…"
              className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              type="button"
              disabled={!draft.trim() || sending}
              onClick={handleSend}
              className="inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white active:scale-[0.97] disabled:opacity-40"
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mx-auto mt-1 max-w-2xl text-[10px] text-muted-foreground/70">
            ⌘/Ctrl + Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}
