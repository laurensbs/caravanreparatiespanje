"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listRepairMessages,
  adminReplyToGarage,
  markGarageRepliesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import { Send, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function timeLabel(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Bidirectional thread shown on the admin repair detail page. Mirrors the
 * garage portal thread; admin replies are persisted both as thread messages
 * and as the legacy banner via the actions layer.
 */
export function AdminRepairThread({
  repairJobId,
  onChange,
}: {
  repairJobId: string;
  /** Called after a successful reply so the parent can refresh state. */
  onChange?: () => void;
}) {
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPosting, startTransition] = useTransition();

  async function refresh() {
    try {
      const list = await listRepairMessages(repairJobId);
      setMessages(list);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listRepairMessages(repairJobId);
        if (!cancelled) setMessages(list);
        // Mark unread garage replies as seen.
        await markGarageRepliesRead(repairJobId).catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repairJobId]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isPosting) return;
    startTransition(async () => {
      try {
        await adminReplyToGarage(repairJobId, trimmed);
        setDraft("");
        await refresh();
        onChange?.();
        toast.success("Reply sent to garage");
      } catch {
        toast.error("Could not send reply");
      }
    });
  }

  const visible = expanded ? messages : messages.slice(-4);
  const hiddenCount = Math.max(0, messages.length - visible.length);

  return (
    <section className="rounded-xl bg-muted/40/80 dark:bg-card/[0.02] border border-border/60 dark:border-border p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground/70" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground font-semibold">
            Conversation with garage
          </p>
          {messages.length > 0 ? (
            <span className="rounded-full bg-muted dark:bg-card/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground/70">
              {messages.length}
            </span>
          ) : null}
        </div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground/70 dark:hover:bg-card/[0.05] dark:hover:text-gray-200"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> +{hiddenCount} earlier
              </>
            )}
          </button>
        ) : null}
      </header>

      {loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground/70 dark:text-muted-foreground">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground/70 dark:text-muted-foreground">
          No messages yet — send the garage a quick note below.
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {visible.map((msg, idx) => {
            const fromGarage = msg.direction === "garage_to_admin";
            const author = fromGarage
              ? msg.authorName || msg.userName || "Garage"
              : msg.userName || "Office";
            const showDay =
              idx === 0 ||
              new Date(visible[idx - 1].createdAt).toDateString() !==
                msg.createdAt.toDateString();
            return (
              <li key={msg.id}>
                {showDay ? (
                  <p className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">
                    {dayLabel(msg.createdAt)}
                  </p>
                ) : null}
                <div className={`flex ${fromGarage ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      fromGarage
                        ? "rounded-tl-sm bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-400/[0.08] dark:text-emerald-100 dark:ring-emerald-400/15"
                        : "rounded-tr-sm bg-muted/60 text-foreground ring-1 ring-border dark:bg-foreground/60/[0.08] dark:text-foreground dark:ring-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed">
                      {msg.body}
                    </p>
                    <p className="mt-1 text-[10px] opacity-70">
                      {author} · {timeLabel(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={2}
          placeholder="Reply to garage… (⌘/Ctrl + Enter to send)"
          className="flex-1 min-w-0 resize-none rounded-xl border border-border dark:border-border bg-card dark:bg-card/[0.04] px-3 py-2.5 text-sm text-foreground dark:text-foreground placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-300/70 dark:focus:ring-gray-600"
        />
        <button
          type="button"
          disabled={!draft.trim() || isPosting}
          onClick={() => void handleSend()}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border dark:border-gray-600 bg-card dark:bg-card/[0.04] px-4 py-2.5 text-sm font-medium text-foreground dark:text-foreground transition-colors hover:bg-muted dark:hover:bg-card/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5 opacity-70" />
          Send
        </button>
      </div>
    </section>
  );
}
