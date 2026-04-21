"use client";

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import {
  listRepairMessages,
  adminReplyToGarage,
  markGarageRepliesRead,
  type RepairMessage,
} from "@/actions/garage-sync";
import { Send, MessageSquare, ChevronDown, ChevronUp, Pin, X, Wrench } from "lucide-react";
import { toast } from "sonner";

function timeLabel(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(d: Date) {
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Compacte "23m"-weergave voor presence — bewust grof, want we polleren
 *  dit niet elke seconde. Boven het uur tonen we "1h 4m" zodat het
 *  signaal snel scant. */
/** Snelle structurele vergelijking zodat we bij elke poll alleen de
 *  state bijwerken als er echt iets nieuws is. Dit voorkomt dat de
 *  chat-lijst onnodig re-rendert (en zo bv. scrollposities of markeert-
 *  als-gelezen effecten opnieuw triggert). */
function sameMessageList(a: RepairMessage[], b: RepairMessage[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id) return false;
    if (x.body !== y.body) return false;
    if ((x.readAt?.getTime?.() ?? 0) !== (y.readAt?.getTime?.() ?? 0)) return false;
  }
  return true;
}

function elapsedShort(start: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export type ThreadActiveTimer = {
  userId: string | null;
  userName: string | null;
  startedAt: Date | string;
};

/**
 * Bidirectional thread shown on the admin repair detail page. Mirrors the
 * garage portal thread; admin replies are persisted as thread messages én
 * mirrored to the "pinned banner" field on the repair, which the garage
 * tablet shows at the top of the job for must-see visibility.
 *
 * Sturen via dit ene component vervangt het oude losse "Pin a single
 * banner message"-blok; daar bestond verwarring over of een bericht in de
 * thread terechtkwam (de banner-only invoer sloeg dat over). Nu is er één
 * input, één thread, en de meest recente eigen post fungeert als banner.
 *
 * Geef `pinnedMessage` mee om een kleine "pinned"-rij bovenaan te tonen
 * zodat je in één blik ziet wat er momenteel als banner op de tablet
 * staat — én 'm met één klik kunt opheffen via `onClearPin` zonder een
 * nieuw bericht te sturen.
 */
export function AdminRepairThread({
  repairJobId,
  onChange,
  pinnedMessage,
  pinnedAt,
  onClearPin,
  activeTimers = [],
  readOnly = false,
}: {
  repairJobId: string;
  /** Called after a successful reply so the parent can refresh state. */
  onChange?: () => void;
  pinnedMessage?: string | null;
  pinnedAt?: Date | string | null;
  onClearPin?: () => Promise<void> | void;
  /** Lopende timers op deze repair — gebruikt voor de presence-pill
   *  ("Jake is now in the garage · 23m"). Kost niets extra omdat de
   *  page deze data al ophaalt voor de Time Log. */
  activeTimers?: ThreadActiveTimer[];
  /** Render de thread als afgesloten archief: geen invoerveld, geen pin
   *  actions. Gebruikt op repair-detail zodra de klus completed/invoiced
   *  is — dan hoort het gesprek bij het historisch werkorder. */
  readOnly?: boolean;
}) {
  const [messages, setMessages] = useState<RepairMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isPosting, startTransition] = useTransition();

  // Inklapbare sectie — default dicht zodat de admin repair-pagina
  // niet een lange chat-scroll laat zien bij elke klus. Onthoud de
  // voorkeur per-admin via localStorage. Zodra er ongelezen replies
  // vanuit de garage binnenkomen klappen we 'm automatisch open
  // zodat die bericht niet over het hoofd wordt gezien.
  const COLLAPSE_KEY = "admin_thread_open";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      // ignore
    }
  }, []);
  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }
  const unreadGarage = messages.filter(
    (m) => m.direction === "garage_to_admin" && !m.readAt,
  ).length;
  // Bij een nieuw ongelezen bericht: auto-open.
  useEffect(() => {
    if (unreadGarage > 0) setOpen(true);
  }, [unreadGarage]);

  // Houd het laatst-gezien aantal garage-replies bij zodat we het verschil
  // tussen "initial load" en "een nieuw bericht is binnengekomen" kunnen
  // detecteren tijdens polling. Dit is een ref (geen state) want het mag
  // geen render triggeren.
  const lastGarageCountRef = useRef<number | null>(null);
  // Backoff voor polling: bij netwerkfouten lopen we van 8s → 16s → 30s
  // → 60s, zodat een uitgevallen tablet/server het admin-panel niet
  // platkookt. Reset naar 8s zodra een fetch weer slaagt.
  const failCountRef = useRef(0);

  // Stabiele ref naar de parent's onChange zodat we die callback niet in
  // de dependency van `refresh` hoeven te zetten. Eerder veroorzaakte
  // dit een loop: elke render van de parent maakte een nieuwe onChange
  // → nieuwe refresh → useEffect draaide opnieuw → setLoading(true) →
  // flikkerend "Loading…"-bericht tussen de berichten.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const refresh = useCallback(async () => {
    try {
      const list = await listRepairMessages(repairJobId);
      failCountRef.current = 0;
      setMessages((prev) => {
        const prevGarage = prev.filter((m) => m.direction === "garage_to_admin").length;
        const nextGarage = list.filter((m) => m.direction === "garage_to_admin").length;
        // Stille toast zodra er een nieuw bericht is binnengekomen ná de
        // initiële load. Bij eerste mount (lastGarageCountRef nog null)
        // niet toasten — anders krijg je hem bij elke pagina-open.
        if (lastGarageCountRef.current !== null && nextGarage > prevGarage) {
          toast.message("New reply from the garage", {
            description: list[list.length - 1]?.body?.slice(0, 80),
          });
          // Triggert ook een server-refresh zodat presence/timers
          // mee-verfrissen.
          onChangeRef.current?.();
        }
        lastGarageCountRef.current = nextGarage;
        // Als de lijst exact gelijk is aan wat we al hadden, retourneer
        // de vorige array — dat voorkomt onnodige re-renders in
        // downstream components én voorkomt dat React onze chat-scroll
        // halverwege onderbreekt.
        if (sameMessageList(prev, list)) return prev;
        return list;
      });
      // Markeer ongelezen garage-replies als gezien zodra we ze ophalen
      // (admin kijkt er actief naar).
      await markGarageRepliesRead(repairJobId).catch(() => {});
    } catch {
      failCountRef.current += 1;
    }
  }, [repairJobId]);

  // Initial load — `setLoading(true)` alléén hier, NOOIT in de polling
  // loop. Vroeger stond dit effect op `refresh` als dep, waardoor elke
  // rebuild van de refresh-callback een kort "Loading…"-flash gaf.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we alleen opnieuw laden als repairJobId wisselt
  }, [repairJobId]);

  // Lichte polling — laat de admin-thread automatisch nieuwe garage-
  // replies ophalen, in dezelfde geest als `useGaragePoll` aan de
  // werker-kant. We pauzeren als het tabblad onzichtbaar is (geen zin om
  // te pollen voor een ongeziene UI) en backen exponentieel af bij
  // fouten zodat een tijdelijk netwerkprobleem niet blijft tikken.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      const fails = failCountRef.current;
      const baseMs = 8000;
      const ms =
        fails === 0 ? baseMs : Math.min(60_000, baseMs * Math.pow(2, fails));
      timer = setTimeout(async () => {
        if (typeof document !== "undefined" && document.hidden) {
          schedule();
          return;
        }
        await refresh();
        schedule();
      }, ms);
    };
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

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

  const [clearingPin, setClearingPin] = useState(false);
  async function handleClearPin() {
    if (!onClearPin || clearingPin) return;
    setClearingPin(true);
    try {
      await onClearPin();
      toast.success("Banner cleared on the garage tablet");
    } catch {
      toast.error("Could not clear the banner");
    } finally {
      setClearingPin(false);
    }
  }

  const pinnedAtDate = pinnedAt
    ? typeof pinnedAt === "string"
      ? new Date(pinnedAt)
      : pinnedAt
    : null;

  // Tikker zodat de "23m" in de presence-pill elke minuut updatet zonder
  // dat we de hele page hoeven te refreshen. Geen state-explosie: alleen
  // een tick-counter zodat React re-rendert.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const livePresence = activeTimers
    .filter((t) => !!t.userName)
    .map((t) => ({
      name: t.userName as string,
      startedAt: typeof t.startedAt === "string" ? new Date(t.startedAt) : t.startedAt,
    }));

  return (
    <section className="rounded-xl bg-muted/50 dark:bg-card/[0.02] border border-border/60 dark:border-border p-4">
      <header className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex flex-1 items-center gap-2 rounded-md text-left transition-colors hover:opacity-80"
          aria-expanded={open}
          aria-controls="admin-thread-body"
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground/70" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground/70" />
          )}
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground/70" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground font-semibold">
            Conversation with garage
          </p>
          {livePresence.length > 0 ? (
            <span
              className="relative flex h-2 w-2"
              aria-label="Garage is online on this repair"
              title="Garage is on this repair right now"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          ) : null}
          {messages.length > 0 ? (
            <span className="rounded-full bg-muted dark:bg-card/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground/70">
              {messages.length}
            </span>
          ) : null}
          {unreadGarage > 0 ? (
            <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {unreadGarage} new
            </span>
          ) : null}
        </button>
        {open && hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-muted-foreground/70 dark:hover:bg-card/[0.05] dark:hover:text-foreground/90"
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

      {/* Collapsed: we tonen niks anders dan de header met badge +
          'X new'-pill. Dit voorkomt lange scrolls in admin-detail als
          deze chat veel berichten bevat. */}
      {open && (<div id="admin-thread-body" className="mt-3">

      {/* Live presence — wie heeft er nu een lopende timer op deze
          repair (= staat fysiek aan de bus)? Geeft de admin context bij
          het sturen: "Jake werkt er nú aan, snelle vraag kan even".
          Niets als er geen actieve timers zijn — geen lege ruimte. */}
      {livePresence.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Wrench className="h-3.5 w-3.5 shrink-0 text-emerald-700/80 dark:text-emerald-300/80" />
          <p className="text-[12px] text-emerald-900/90 dark:text-emerald-100/90">
            {livePresence.length === 1 ? (
              <>
                <span className="font-medium">{livePresence[0].name}</span>
                <span className="opacity-70"> is in the garage now</span>
                <span className="ml-1 tabular-nums opacity-60">
                  · {elapsedShort(livePresence[0].startedAt)}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">
                  {livePresence.map((p) => p.name).join(", ")}
                </span>
                <span className="opacity-70"> are in the garage now</span>
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Pinned banner — toont in één regel wat er nu bovenaan op de
          garage-tablet staat (de meest recente "must-see"-prikkel). De
          banner verdwijnt automatisch zodra de werker reageert; deze
          knop is voor de admin die 'm handmatig wil opheffen zonder
          eerst nog een bericht te sturen. */}
      {pinnedMessage ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/[0.06]">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700/80 dark:text-amber-300/80" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-300/80">
              Pinned on garage tablet
              {pinnedAtDate ? (
                <span className="ml-1.5 font-normal opacity-70">· {timeLabel(pinnedAtDate)}</span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] text-amber-900/90 dark:text-amber-100/90">
              {pinnedMessage}
            </p>
          </div>
          {onClearPin && !readOnly ? (
            <button
              type="button"
              onClick={() => void handleClearPin()}
              disabled={clearingPin}
              className="shrink-0 rounded-lg p-1 text-amber-700/70 transition-colors hover:bg-amber-100/70 hover:text-amber-800 disabled:opacity-50 dark:text-amber-300/70 dark:hover:bg-amber-500/10 dark:hover:text-amber-200"
              aria-label="Clear pinned banner"
              title="Clear pinned banner"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

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

      {readOnly ? (
        <p className="rounded-xl border border-dashed border-border/60 dark:border-border px-3 py-2 text-center text-xs italic text-muted-foreground">
          Closed conversation — archived when the job was completed.
        </p>
      ) : (
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
            className="flex-1 min-w-0 resize-none rounded-xl border border-border dark:border-border bg-card dark:bg-card/[0.04] px-3 py-2.5 text-sm text-foreground dark:text-foreground placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 dark:focus:ring-ring/40"
          />
          <button
            type="button"
            disabled={!draft.trim() || isPosting}
            onClick={() => void handleSend()}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border dark:border-border bg-card dark:bg-card/[0.04] px-4 py-2.5 text-sm font-medium text-foreground dark:text-foreground transition-colors hover:bg-muted dark:hover:bg-card/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5 opacity-70" />
            Send
          </button>
        </div>
      )}
      </div>)}
    </section>
  );
}
