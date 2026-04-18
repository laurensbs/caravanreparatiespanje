"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listRepairMessages,
  garageReplyToAdmin,
  markAdminThreadMessagesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import { Send, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { toast } from "sonner";

const RECENT_AUTHOR_KEY = "garage_thread_author";

function timeLabel(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date, lang: "en" | "es" | "nl") {
  const today = new Date();
  const isSameDay = d.toDateString() === today.toDateString();
  if (isSameDay) {
    return lang === "es" ? "Hoy" : lang === "nl" ? "Vandaag" : "Today";
  }
  return d.toLocaleDateString(
    lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "short" },
  );
}

/**
 * Bidirectional message thread shown on the garage repair detail page.
 * Workers can reply to the office; messages land in the admin assistant inbox.
 */
export function GarageRepairThread({
  repairJobId,
  t,
  lang,
}: {
  repairJobId: string;
  t: (en: string, es?: string, nl?: string) => string;
  lang: "en" | "es" | "nl";
}) {
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPosting, startPostTransition] = useTransition();

  async function refresh() {
    try {
      const list = await listRepairMessages(repairJobId);
      setMessages(list);
    } catch {
      // ignore — keep last known
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await listRepairMessages(repairJobId);
        if (!cancelled) setMessages(list);
        // Best-effort: mark admin messages as read in the new thread.
        await markAdminThreadMessagesRead(repairJobId).catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [repairJobId]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_AUTHOR_KEY);
      if (stored) setAuthorName(stored);
    } catch {
      // ignore
    }
  }, []);

  function rememberAuthor(name: string) {
    try {
      window.localStorage.setItem(RECENT_AUTHOR_KEY, name);
    } catch {
      // ignore
    }
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isPosting) return;
    hapticSuccess();
    const cleanAuthor = authorName.trim();
    if (cleanAuthor) rememberAuthor(cleanAuthor);
    startPostTransition(async () => {
      try {
        await garageReplyToAdmin(repairJobId, trimmed, cleanAuthor || undefined);
        setDraft("");
        await refresh();
        toast.success(
          t("Sent to office", "Enviado a oficina", "Verstuurd naar kantoor"),
        );
      } catch {
        toast.error(
          t("Could not send", "No se pudo enviar", "Versturen mislukt"),
        );
      }
    });
  }

  // Show only the last 4 unless expanded.
  const visible = expanded ? messages : messages.slice(-4);
  const hiddenCount = Math.max(0, messages.length - visible.length);

  return (
    <section className="motion-safe:animate-slide-up mb-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-teal-300/80" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/55">
            {t("Office conversation", "Conversación oficina", "Gesprek met kantoor")}
          </h3>
          {messages.length > 0 ? (
            <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-white/45">
              {messages.length}
            </span>
          ) : null}
        </div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setExpanded((v) => !v);
            }}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/80"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                {t("Collapse", "Plegar", "Inklappen")}
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                +{hiddenCount} {t("earlier", "anteriores", "eerder")}
              </>
            )}
          </button>
        ) : null}
      </header>

      {loading ? (
        <p className="py-3 text-center text-[12px] text-white/30">
          {t("Loading…", "Cargando…", "Laden…")}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-3 text-center text-[12px] text-white/30">
          {t(
            "No messages yet — send the office a quick update below.",
            "Sin mensajes aún — envía una actualización a la oficina.",
            "Nog geen berichten — stuur kantoor hieronder een update.",
          )}
        </p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {visible.map((msg, idx) => {
            const fromGarage = msg.direction === "garage_to_admin";
            const author = fromGarage
              ? msg.authorName || msg.userName || t("Garage", "Taller", "Werkplaats")
              : msg.userName || t("Office", "Oficina", "Kantoor");
            const showDay =
              idx === 0 ||
              new Date(visible[idx - 1].createdAt).toDateString() !==
                msg.createdAt.toDateString();
            return (
              <li key={msg.id}>
                {showDay ? (
                  <p className="my-2 text-center text-[10.5px] uppercase tracking-wider text-white/25">
                    {dayLabel(msg.createdAt, lang)}
                  </p>
                ) : null}
                <div
                  className={`flex ${fromGarage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      fromGarage
                        ? "rounded-tr-sm bg-emerald-400/[0.08] text-white/90 ring-1 ring-emerald-400/15"
                        : "rounded-tl-sm bg-teal-400/[0.08] text-white/90 ring-1 ring-teal-400/15"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                      {msg.body}
                    </p>
                    <p className="mt-1 text-[10px] text-white/40">
                      {author} · {timeLabel(msg.createdAt)}
                      {fromGarage && !msg.readAt ? (
                        <span className="ml-1.5 text-emerald-300/80">
                          · {t("sent", "enviado", "verstuurd")}
                        </span>
                      ) : null}
                      {fromGarage && msg.readAt ? (
                        <span className="ml-1.5 text-white/35">
                          · {t("read", "leído", "gelezen")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2">
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder={t("Your name (optional)", "Tu nombre (opcional)", "Jouw naam (optioneel)")}
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12.5px] text-white placeholder:text-white/30 focus:border-white/15 focus:outline-none focus:ring-2 focus:ring-white/10"
        />
        <div className="flex gap-2">
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
            placeholder={t(
              "Reply to office… (⌘/Ctrl + Enter)",
              "Responder a oficina… (⌘/Ctrl + Enter)",
              "Antwoord naar kantoor… (⌘/Ctrl + Enter)",
            )}
            className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder:text-white/30 focus:border-white/15 focus:outline-none focus:ring-2 focus:ring-white/10"
          />
          <button
            type="button"
            disabled={!draft.trim() || isPosting}
            onClick={() => void handleSend()}
            className="flex h-auto shrink-0 items-center justify-center gap-1.5 self-stretch rounded-xl bg-teal-500/15 px-4 text-[13px] font-semibold text-teal-200 ring-1 ring-teal-400/30 transition-all active:scale-[0.97] hover:bg-teal-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("Send", "Enviar", "Versturen")}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
