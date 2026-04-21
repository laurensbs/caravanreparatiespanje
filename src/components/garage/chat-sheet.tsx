"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  listRepairMessages,
  garageReplyToAdmin,
  markAdminThreadMessagesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import { X, Send, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { hapticSuccess } from "@/lib/haptic";

type Lang = "en" | "es" | "nl";

function fullTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date, lang: Lang): string {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return lang === "es" ? "Hoy" : lang === "nl" ? "Vandaag" : "Today";
  }
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) {
    return lang === "es" ? "Ayer" : lang === "nl" ? "Gisteren" : "Yesterday";
  }
  return d.toLocaleDateString(
    lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

/**
 * Full-screen chat-sheet voor het garage-paneel. Toont de bidirectionele
 * thread met kantoor, composer onderaan. Afzender = de werker wiens
 * timer op deze repair loopt (doorgegeven als `authorName`). Zonder
 * timer kan dit sheet niet geopend worden — de caller blokkeert dat al.
 *
 * Patroon volgt de admin MessagesAppClient: polling om de 8s, pauze als
 * tab onzichtbaar, optimistisch composer-clear na send. Mobiel vult hij
 * het hele scherm (dvh), tablet/desktop krijgt hij een sheet-look.
 */
export function GarageChatSheet({
  repairJobId,
  repairTitle,
  repairCode,
  authorName,
  t,
  lang,
  onClose,
}: {
  repairJobId: string;
  repairTitle: string | null;
  repairCode: string | null;
  /** Naam van de werker wiens timer loopt. Ongeïnitialiseerd = geen chat. */
  authorName: string;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  lang: Lang;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isPosting, startPostTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const failRef = useRef(0);

  const refresh = useCallback(
    async ({ markRead = true }: { markRead?: boolean } = {}) => {
      try {
        const list = await listRepairMessages(repairJobId);
        failRef.current = 0;
        setMessages(list);
        if (markRead) await markAdminThreadMessagesRead(repairJobId).catch(() => {});
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

  // Polling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const base = 8000;
      const ms = failRef.current === 0 ? base : Math.min(60_000, base * Math.pow(2, failRef.current));
      timer = setTimeout(async () => {
        if (typeof document !== "undefined" && document.hidden) {
          tick();
          return;
        }
        await refresh({ markRead: false });
        tick();
      }, ms);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Body-scroll lock zolang sheet open is
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  async function handleSend() {
    const body = draft.trim();
    if (!body || isPosting) return;
    hapticSuccess();
    startPostTransition(async () => {
      try {
        await garageReplyToAdmin(repairJobId, body, authorName);
        setDraft("");
        await refresh({ markRead: false });
        toast.success(t("Sent", "Enviado", "Verstuurd"));
      } catch {
        toast.error(t("Could not send", "No se pudo enviar", "Versturen mislukt"));
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[160] flex flex-col bg-stone-950 text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/[0.08] bg-stone-950/90 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-white/80 hover:bg-white/[0.1] active:scale-[0.97]"
          aria-label={t("Close", "Cerrar", "Sluiten")}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
          <MessageSquare className="h-5 w-5 text-white/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {t("Office", "Oficina", "Kantoor")}
          </p>
          <p className="truncate text-[11.5px] text-white/55">
            {[repairCode, repairTitle].filter(Boolean).join(" · ")}
            {repairCode || repairTitle ? " · " : ""}
            {t("as", "como", "als")} <span className="font-medium text-white/70">{authorName}</span>
          </p>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
      >
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("Loading…", "Cargando…", "Laden…")}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-white/60">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">
              {t("No messages yet", "Aún sin mensajes", "Nog geen berichten")}
            </p>
            <p className="text-xs opacity-70">
              {t(
                "Type below to say hi — the office sees it right away.",
                "Escribe abajo — la oficina lo verá.",
                "Typ hieronder — kantoor ziet het direct.",
              )}
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
            {grouped.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1.5">
                <div className="my-2 flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/[0.08]" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {dayLabel(g.day, lang)}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.08]" />
                </div>
                {g.list.map((m) => {
                  const mine = m.direction === "garage_to_admin";
                  const author = mine ? (m.authorName ?? authorName) : t("Office", "Oficina", "Kantoor");
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          mine
                            ? "bg-emerald-500 text-white"
                            : "bg-white/[0.08] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                      <div className="flex items-center gap-1.5 px-1 text-[10.5px] text-white/45">
                        <span>{author}</span>
                        <span>·</span>
                        <span>{fullTime(new Date(m.createdAt))}</span>
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
      <div
        className="border-t border-white/[0.08] bg-stone-950/95 px-3 py-3 backdrop-blur sm:px-4"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder={t("Message office…", "Mensaje a oficina…", "Bericht aan kantoor…")}
            className="min-h-[48px] max-h-40 flex-1 resize-none rounded-2xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-base text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
          />
          <button
            type="button"
            disabled={!draft.trim() || isPosting}
            onClick={handleSend}
            className="inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white transition-opacity active:scale-[0.97] disabled:opacity-40"
            aria-label={t("Send", "Enviar", "Verzenden")}
          >
            {isPosting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
