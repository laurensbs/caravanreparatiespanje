"use client";

import {
  useState,
  useEffect,
  useMemo,
  useTransition,
  useOptimistic,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Play,
  Pause,
  Check,
  Package,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  MapPin,
  X,
  Wrench,
} from "lucide-react";
import { useLanguage, LanguageToggle, type Language } from "@/components/garage/language-toggle";
import { GarageThemeToggle } from "@/components/garage/theme-provider";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { hapticTap, hapticSuccess, primeHaptics } from "@/lib/haptic";
import { usePullToRefresh } from "@/lib/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/garage/pull-to-refresh-indicator";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { GARAGE_TIMER_NO_TASKS } from "@/lib/garage-timer-errors";
import { updateTaskStatus, garageMarkPartReceived } from "@/actions/garage";
import { canStartGarageTimerOnRepair, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { WorkerPicker, type WorkerOption } from "@/components/garage/worker-picker";
import { ToolRequestSheet } from "@/components/garage/tool-request-sheet";

/* ─────────────────────────────────────────────────────────────────────────
   Today screen — shared garage iPad
   ─────────────────────────────────────────────────────────────────────────
   Goals (see chat with Laurens):
   - One filter row, four big tabs. No duplicate stat strip.
   - Cards show running timers inline with technician name + minutes.
   - Starting a timer always opens the worker tile-grid; the result is
     attributed to the chosen technician (no localStorage "me" anymore).
   - Anonymous quick actions (tick task, mark part received) keep their
     one-tap UX — Laurens explicitly accepted anonymous task ticking
     to keep the flow fast.
   - Default language is the iPad's deviceLang. After an action, the
     toast shows in the actor's preferred language so feedback feels
     personal without flipping the UI for the next person.
   ───────────────────────────────────────────────────────────────────── */

type RepairItem = {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: Date | string | null;
  customerName: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  unitStorageLocation: string | null;
  unitCurrentPosition: string | null;
  assignedUserName: string | null;
  finalCheckStatus: string | null;
  jobType: string;
  tasks: { total: number; done: number; problem: number };
  parts: { total: number; received: number; pending: number };
  workers: string[];
  totalMinutes: number;
  garageAdminMessage: string | null;
  garageAdminMessageAt: Date | string | null;
  garageAdminMessageReadAt: Date | string | null;
  nextTask: {
    id: string;
    title: string;
    titleEs: string | null;
    titleNl: string | null;
    status: "pending" | "in_progress";
  } | null;
  nextPart: {
    id: string;
    name: string;
    status: "requested" | "ordered" | "shipped";
    expectedDelivery: Date | string | null;
  } | null;
};

interface QuickStats {
  tomorrowCount: number;
  waitingPartsCount: number;
  urgentCount: number;
  unassignedCount: number;
}

type ActiveTimerItem = {
  id: string;
  repairJobId: string;
  userId: string;
  userName: string | null;
  startedAt: Date | string;
};

interface Props {
  repairs: RepairItem[];
  userName: string;
  stats: QuickStats;
  activeTimers?: ActiveTimerItem[];
  allUsers: { id: string; name: string | null; role: string | null; preferredLanguage?: Language | null }[];
}

type FilterTab = "active" | "waiting" | "check" | "done";

function classify(r: RepairItem): FilterTab {
  if ((r.status === "completed" && r.finalCheckStatus !== "pending") || r.status === "invoiced") return "done";
  if (r.status === "ready_for_check") return "check";
  if (r.status === "completed" && r.finalCheckStatus === "pending") return "check";
  if (["waiting_customer", "waiting_parts", "blocked"].includes(r.status)) return "waiting";
  return "active";
}

function fmtDuration(min: number, lang: Language): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h}u`.replace("u", lang === "es" ? "h" : lang === "nl" ? "u" : "h");
  const unit = lang === "nl" ? "u" : "h";
  return `${h}${unit} ${m}m`;
}

function elapsedMinutesSince(start: Date | string): number {
  const t = typeof start === "string" ? new Date(start).getTime() : start.getTime();
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

/**
 * Live HH:MM:SS string from a start timestamp. Used in the running-timer
 * strip so workers see seconds tick up — that's what makes a timer feel
 * "alive" on a shared iPad. Resolves once per second via the surrounding
 * `now` state.
 */
function fmtLiveClock(start: Date | string, now: Date): string {
  const startMs = typeof start === "string" ? new Date(start).getTime() : start.getTime();
  const totalSec = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
  return fmtClockSeconds(totalSec);
}

/** Format een aantal seconden als live-klok (H:MM:SS of M:SS). */
function fmtClockSeconds(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const STATUS_DOT: Record<string, string> = {
  in_progress: "bg-emerald-400",
  ready_for_check: "bg-amber-400",
  waiting_parts: "bg-orange-400",
  waiting_customer: "bg-orange-400",
  blocked: "bg-rose-400",
  completed: "bg-stone-500",
  invoiced: "bg-stone-500",
  todo: "bg-sky-400",
  new: "bg-sky-400",
};


export function GarageTodayClient({
  repairs: serverRepairs,
  stats,
  activeTimers: serverActiveTimers = [],
  allUsers,
}: Props) {
  const router = useRouter();
  const { t, deviceLang, tFor } = useLanguage();

  /* ── Optimistic state for tick-task / mark-part ──────────────────── */
  type OptimisticAction =
    | { type: "tickTask"; repairId: string; taskId: string }
    | { type: "receivePart"; repairId: string; partId: string };

  const [repairs, applyOptimistic] = useOptimistic(
    serverRepairs,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case "tickTask":
          return state.map((r) =>
            r.id === action.repairId && r.nextTask?.id === action.taskId
              ? { ...r, nextTask: null }
              : r,
          );
        case "receivePart":
          return state.map((r) =>
            r.id === action.repairId && r.nextPart?.id === action.partId
              ? { ...r, nextPart: null }
              : r,
          );
      }
    },
  );

  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterTab>("active");
  const [search, setSearch] = useState("");

  // Unlock the AudioContext on the first user gesture so haptic clicks are
  // audible right from tap one (iOS Safari requirement).
  useEffect(() => {
    const onFirst = () => {
      primeHaptics();
      window.removeEventListener("pointerdown", onFirst);
    };
    window.addEventListener("pointerdown", onFirst, { once: true });
    return () => window.removeEventListener("pointerdown", onFirst);
  }, []);

  // Subtle "elevation" of the sticky header once the user starts scrolling.
  // Mirrors iOS large-title → compact-title behaviour.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Wipe any leftover "My day" selection from older builds so a worker
  // doesn't get stuck on a phantom filter from a previous session. The
  // shared-iPad model means anyone can start anything; per-person filtering
  // turned out to be more confusing than helpful and was removed.
  useEffect(() => {
    try {
      window.localStorage.removeItem("garage:mine-user-id");
    } catch {}
  }, []);

  /* Worker picker — opened with a "purpose" callback so any action
     that needs an actor can route through one component. */
  const [pickerState, setPickerState] = useState<{
    purpose: "startTimer";
    repairId: string;
    repairTitle: string;
  } | null>(null);

  /* Tool request sheet — global "need a tool / part / supply" button. */
  const [toolSheetOpen, setToolSheetOpen] = useState(false);

  const [, startActionTransition] = useTransition();

  /* 1-second heartbeat for the live HH:MM:SS clocks on running timers.
     Cheap (one setState per second) and only triggers re-renders that
     read `now`. Date/greeting derivations only change on the minute, so
     they're stable across these ticks. */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Background polling — refresh server data when something changed. */
  useGaragePoll();

  /* ── Live active timers (poll independently every 15s so the cards
        keep ticking even between bigger router refreshes) ──────────── */
  const [liveTimers, setLiveTimers] = useState<ActiveTimerItem[]>(serverActiveTimers);
  useEffect(() => setLiveTimers(serverActiveTimers), [serverActiveTimers]);

  const timersByRepair = useMemo(() => {
    const m = new Map<string, ActiveTimerItem[]>();
    for (const tm of liveTimers) {
      const list = m.get(tm.repairJobId) ?? [];
      list.push(tm);
      m.set(tm.repairJobId, list);
    }
    return m;
  }, [liveTimers]);

  /* ── Tab counts ──────────────────────────────────────────────────── */
  const counts = useMemo(() => {
    const c = { active: 0, waiting: 0, check: 0, done: 0 };
    for (const r of repairs) c[classify(r)]++;
    return c;
  }, [repairs]);

  /* ── Visible repairs ─────────────────────────────────────────────── */
  const visibleRepairs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return repairs.filter((r) => {
      if (classify(r) !== tab) return false;
      if (!q) return true;
      const hay = [
        r.publicCode,
        r.title,
        r.customerName,
        r.unitRegistration,
        r.unitBrand,
        r.unitModel,
        r.unitStorageLocation,
        r.unitCurrentPosition,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [repairs, tab, search]);

  const totalActiveTimers = liveTimers.length;
  const unreadAdminMessages = repairs.filter(
    (r) => r.garageAdminMessage && !r.garageAdminMessageReadAt,
  ).length;

  /* ── Refresh ─────────────────────────────────────────────────────── */
  async function handleRefresh() {
    if (refreshing) return;
    hapticTap();
    setRefreshing(true);
    try {
      router.refresh();
      // Give Next a moment to flush new server data; the spinner is
      // mostly cosmetic but reassures workers that something happened.
      await new Promise((r) => setTimeout(r, 600));
    } finally {
      setRefreshing(false);
    }
  }

  // Native-feeling pull-to-refresh on touch devices. Reuses the same
  // refresh path as the header button so both feel identical.
  const ptr = usePullToRefresh(async () => {
    hapticSuccess();
    router.refresh();
    await new Promise((r) => setTimeout(r, 600));
  });

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function handleStartTimer(repair: RepairItem, worker: WorkerOption) {
    hapticTap();
    const actorLang = (worker.preferredLanguage ?? "en") as Language;

    // Did this worker already have an active timer on a *different*
    // repair? The backend auto-stops it, but we want the worker to know
    // that's what happened (otherwise they'd think two timers ran in
    // parallel for them, which can't happen — only across people).
    const previousElsewhere = liveTimers.find(
      (tm) => tm.userId === worker.id && tm.repairJobId !== repair.id,
    );

    startActionTransition(async () => {
      try {
        await startTimer(repair.id, worker.id);
        hapticSuccess();
        if (previousElsewhere) {
          toast.success(
            tFor(
              actorLang,
              `Switched to this repair — ${worker.name}`,
              `Cambiado a esta reparación — ${worker.name}`,
              `Overgestapt naar deze klus — ${worker.name}`,
            ),
            {
              description: tFor(
                actorLang,
                "Previous timer was paused automatically.",
                "El temporizador anterior se pausó automáticamente.",
                "Vorige timer is automatisch gepauzeerd.",
              ),
            },
          );
        } else {
          toast.success(
            tFor(
              actorLang,
              `Timer started — ${worker.name}`,
              `Temporizador iniciado — ${worker.name}`,
              `Timer gestart — ${worker.name}`,
            ),
          );
        }
        router.refresh();
      } catch (err) {
        const msg = (err as Error)?.message ?? "Could not start timer";
        if (msg === GARAGE_TIMER_NOT_ALLOWED) {
          toast.error(
            tFor(
              actorLang,
              "This repair is not active.",
              "Esta reparación no está activa.",
              "Deze reparatie is niet actief.",
            ),
          );
        } else if (msg === GARAGE_TIMER_NO_TASKS) {
          toast.error(
            tFor(
              actorLang,
              "No tasks on this job yet — add at least one task (office / work order) before starting the timer.",
              "Aún no hay tareas — añade al menos una (oficina / orden) antes de iniciar el temporizador.",
              "Nog geen taken op deze klus — voeg minstens één taak toe (kantoor / werkorder) voordat je de timer start.",
            ),
          );
        } else {
          toast.error(msg);
        }
      }
    });
  }

  async function handleStopTimer(timer: ActiveTimerItem) {
    hapticTap();
    const worker = allUsers.find((u) => u.id === timer.userId);
    const actorLang = (worker?.preferredLanguage ?? "en") as Language;
    startActionTransition(async () => {
      try {
        await stopTimer(timer.repairJobId, timer.userId);
        hapticSuccess();
        toast.success(
          tFor(
            actorLang,
            `Timer paused — ${timer.userName ?? "—"}`,
            `Pausado — ${timer.userName ?? "—"}`,
            `Gepauzeerd — ${timer.userName ?? "—"}`,
          ),
        );
        // Hide the timer immediately; router.refresh fills in authoritative state.
        setLiveTimers((prev) => prev.filter((tm) => tm.id !== timer.id));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not stop timer");
      }
    });
  }

  async function handleTickTask(repair: RepairItem) {
    if (!repair.nextTask) return;
    // Geen timer → niet afvinken. Zo blijft de factuurtijd kloppen en
    // raakt de werker er gewend om eerst te klokken.
    const hasTimerOnRepair = liveTimers.some((tm) => tm.repairJobId === repair.id);
    if (!hasTimerOnRepair) {
      hapticTap();
      toast.error(
        t(
          "Start the timer first — then you can tick off the task.",
          "Primero inicia el temporizador y luego marca la tarea.",
          "Start eerst de timer — dan kun je de taak afvinken.",
        ),
      );
      return;
    }
    const taskId = repair.nextTask.id;
    hapticTap();
    startActionTransition(async () => {
      applyOptimistic({ type: "tickTask", repairId: repair.id, taskId });
      try {
        await updateTaskStatus(taskId, "done");
        hapticSuccess();
        toast.success(t("Task completed", "Tarea completada", "Taak afgerond"));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not update task");
        router.refresh();
      }
    });
  }

  async function handleReceivePart(repair: RepairItem) {
    if (!repair.nextPart) return;
    const partId = repair.nextPart.id;
    hapticTap();
    startActionTransition(async () => {
      applyOptimistic({ type: "receivePart", repairId: repair.id, partId });
      try {
        await garageMarkPartReceived(partId);
        hapticSuccess();
        toast.success(t("Part received", "Pieza recibida", "Onderdeel ontvangen"));
        router.refresh();
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not mark received");
        router.refresh();
      }
    });
  }

  /* ── Greeting / clock ────────────────────────────────────────────── */
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 5) return t("Good night", "Buenas noches", "Goedenacht");
    if (h < 12) return t("Good morning", "Buenos días", "Goedemorgen");
    if (h < 18) return t("Good afternoon", "Buenas tardes", "Goedemiddag");
    return t("Good evening", "Buenas noches", "Goedenavond");
  }, [now, t]);

  const dateLabel = now.toLocaleDateString(
    deviceLang === "nl" ? "nl-NL" : deviceLang === "es" ? "es-ES" : "en-GB",
    { weekday: "long", day: "numeric", month: "long" },
  );

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-stone-950 text-white">
      <PullToRefreshIndicator
        pull={ptr.pull}
        armed={ptr.armed}
        refreshing={ptr.refreshing}
      />
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 border-b bg-stone-950/90 backdrop-blur transition-[box-shadow,background-color] duration-200 ${
          scrolled
            ? "border-white/[0.08] bg-stone-950/95 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
            : "border-white/[0.06]"
        }`}
        style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-3 px-4 pt-4 pb-2 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              {dateLabel}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {greeting}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticTap();
              setToolSheetOpen(true);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500/15 px-3 text-sm font-semibold text-amber-200 ring-1 ring-amber-400/25 hover:bg-amber-500/25 active:scale-[0.97]"
            aria-label={t(
              "Need a tool or part",
              "Necesito herramienta o pieza",
              "Gereedschap of onderdeel nodig",
            )}
          >
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">
              {t("Tool / part", "Herramienta / pieza", "Gereedschap / onderdeel")}
            </span>
          </button>

          <LanguageToggle />
          <GarageThemeToggle />

          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] active:bg-white/[0.15] disabled:opacity-40"
            disabled={refreshing}
            aria-label={t("Refresh", "Actualizar", "Vernieuwen")}
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search + summary chips on one row */}
        <div className="flex items-center gap-2 px-4 pb-3 sm:px-6">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/[0.04] focus-within:ring-white/20">
            <Search className="h-4 w-4 text-white/40" />
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={t(
                "Search registration, customer…",
                "Buscar matrícula, cliente…",
                "Zoek kenteken, klant…",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full w-full bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.08]"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
        </div>

        {/* Tab bar — sliding pill, like iOS segmented control */}
        {(() => {
          const tabs = [
            { id: "active" as const, label: t("Active", "Activos", "Actief"), count: counts.active },
            { id: "waiting" as const, label: t("Waiting", "Esperando", "Wachtend"), count: counts.waiting },
            { id: "check" as const, label: t("Check", "Revisión", "Check"), count: counts.check },
            { id: "done" as const, label: t("Done", "Hecho", "Klaar"), count: counts.done },
          ];
          const activeIdx = tabs.findIndex((it) => it.id === tab);
          return (
            <div className="px-2 pb-2 sm:px-4">
              <div className="relative flex items-stretch gap-1 rounded-xl bg-white/[0.04] p-1">
                <div
                  aria-hidden
                  className="absolute inset-y-1 rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-all duration-300 ease-[cubic-bezier(.32,.72,0,1)]"
                  style={{
                    width: `calc((100% - 0.5rem) / ${tabs.length})`,
                    transform: `translateX(calc(${activeIdx} * (100% + 0.25rem)))`,
                  }}
                />
                {tabs.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setTab(it.id);
                    }}
                    className={`relative z-[1] flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                      tab === it.id ? "text-stone-950" : "text-white/60 active:text-white/80"
                    }`}
                  >
                    <span>{it.label}</span>
                    <span
                      className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold transition-colors duration-200 ${
                        tab === it.id ? "bg-stone-950/15 text-stone-950" : "bg-white/[0.08] text-white/70"
                      }`}
                    >
                      {it.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Live ticker — admin-only signals (urgency, etc) intentionally
            stay on the office dashboard, not here. */}
        {(totalActiveTimers > 0 || unreadAdminMessages > 0) ? (
          <div className="flex items-center gap-2 overflow-x-auto border-t border-white/[0.04] px-4 py-2 text-xs text-white/60 sm:px-6">
            {totalActiveTimers > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {totalActiveTimers}{" "}
                {t(
                  totalActiveTimers === 1 ? "timer running" : "timers running",
                  totalActiveTimers === 1 ? "temporizador" : "temporizadores",
                  totalActiveTimers === 1 ? "timer loopt" : "timers lopen",
                )}
              </span>
            ) : null}
            {unreadAdminMessages > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-300">
                <MessageSquare className="h-3 w-3" />
                {unreadAdminMessages}{" "}
                {t("from office", "de oficina", "van kantoor")}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* ── Cards grid ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {visibleRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] py-20 text-center">
            {/* Logo as the empty-state mark — calmer than an emoji and
                consistent with the login screen branding. The dark
                container + invert keeps it legible on the stone-950 bg. */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <Image
                src="/favicon.png"
                alt="Reparatie Panel"
                width={40}
                height={40}
                className="h-9 w-9 object-contain opacity-80 invert"
                priority={false}
              />
            </div>
            <p className="mt-4 text-base text-white/50">
              {search
                ? t("No repairs match your search.", "Sin resultados.", "Geen resultaten.")
                : tab === "done"
                  ? t("Nothing finished yet today.", "Aún no hay terminados.", "Nog niets afgerond vandaag.")
                  : t("Nothing here right now.", "Nada aquí ahora.", "Hier staat nu niets.")}
            </p>
          </div>
        ) : (
          <div
            key={tab}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 animate-[fadeInUp_280ms_cubic-bezier(.32,.72,0,1)_both]"
          >
            {visibleRepairs.map((r) => (
              <JobCard
                key={r.id}
                repair={r}
                timers={timersByRepair.get(r.id) ?? []}
                now={now}
                onOpen={() => router.push(`/garage/repairs/${r.id}`)}
                onStartTimer={() =>
                  setPickerState({
                    purpose: "startTimer",
                    repairId: r.id,
                    repairTitle: r.title ?? r.publicCode ?? "Repair",
                  })
                }
                onStopTimer={handleStopTimer}
                onTickTask={() => handleTickTask(r)}
                onReceivePart={() => handleReceivePart(r)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Worker picker (used for timer start) ───────────────────── */}
      <WorkerPicker
        open={!!pickerState}
        onClose={() => setPickerState(null)}
        onPick={(worker) => {
          if (!pickerState) return;
          const repair = repairs.find((r) => r.id === pickerState.repairId);
          if (!repair) return;
          handleStartTimer(repair, worker);
        }}
        workers={allUsers}
        title={t("Who's starting?", "¿Quién empieza?", "Wie begint?")}
        subtitle={pickerState?.repairTitle}
      />

      {/* ── Tool request sheet (global) ───────────────────────────── */}
      <ToolRequestSheet
        open={toolSheetOpen}
        onClose={() => setToolSheetOpen(false)}
        onSent={() => router.refresh()}
        repairOptions={repairs.map((r) => ({
          id: r.id,
          label:
            r.unitRegistration ||
            r.publicCode ||
            r.title ||
            r.customerName ||
            "—",
          sublabel: r.title ?? r.customerName ?? null,
        }))}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   Job card
   ───────────────────────────────────────────────────────────────────── */

function JobCard({
  repair,
  timers,
  now,
  onOpen,
  onStartTimer,
  onStopTimer,
  onTickTask,
  onReceivePart,
}: {
  repair: RepairItem;
  timers: ActiveTimerItem[];
  now: Date;
  onOpen: () => void;
  onStartTimer: () => void;
  onStopTimer: (t: ActiveTimerItem) => void;
  onTickTask: () => void;
  onReceivePart: () => void;
}) {
  const { t, deviceLang } = useLanguage();
  // Zie detail-client: de server auto-promoot startable statussen naar
  // `in_progress`, dus we tonen de knop ook in new/todo/scheduled/
  // in_inspection.
  const canStartTimer =
    canStartGarageTimerOnRepair(repair.status) ||
    ["new", "todo", "scheduled", "in_inspection"].includes(repair.status);
  const someoneIsWorking = timers.length > 0;
  const totalProblems = repair.tasks.problem;
  const tasksProgress =
    repair.tasks.total > 0
      ? `${repair.tasks.done}/${repair.tasks.total}`
      : null;
  const partsPending = repair.parts.pending;

  /* Live total minutes for this repair = recorded (already-rounded
     finished entries) + sum of currently-running timers. This number is
     what workers actually want to see on the overview: "this repair has
     burned X minutes so far, and it's still ticking". */
  const liveOngoingMinutes = timers.reduce(
    (acc, tm) => acc + elapsedMinutesSince(tm.startedAt),
    0,
  );
  const liveTotalMinutes = repair.totalMinutes + liveOngoingMinutes;

  // Title for the next-task pill
  const nextTaskTitle = repair.nextTask
    ? deviceLang === "es" && repair.nextTask.titleEs
      ? repair.nextTask.titleEs
      : deviceLang === "nl" && repair.nextTask.titleNl
        ? repair.nextTask.titleNl
        : repair.nextTask.title
    : null;

  return (
    <article
      className="tap-press group flex flex-col gap-3 overflow-hidden rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06] hover:bg-white/[0.05]"
    >
      {/* ── Header row: status, code, chevron ─────────────────────── */}
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-2.5 text-left"
      >
        <span
          aria-hidden
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[repair.status] ?? "bg-stone-500"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wide text-white">
              {repair.unitRegistration ?? repair.publicCode ?? "—"}
            </span>
            {/* Priority badges intentionally hidden for the garage view —
                "urgent / high" is admin-only triage. Workers should treat
                the queue as one shared list and start whatever is next. */}
            {repair.garageAdminMessage && !repair.garageAdminMessageReadAt ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                <MessageSquare className="h-2.5 w-2.5" /> {t("Note", "Nota", "Bericht")}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-white/70 line-clamp-1">
            {repair.customerName ?? "—"}
            {repair.unitBrand ? ` · ${repair.unitBrand}` : ""}
          </p>
          {repair.unitStorageLocation || repair.unitCurrentPosition ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/40">
              <MapPin className="h-3 w-3" />
              {repair.unitCurrentPosition ?? repair.unitStorageLocation}
            </p>
          ) : null}
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/30 group-hover:text-white/60" />
      </button>

      {/* ── Job title ─────────────────────────────────────────────── */}
      {repair.title ? (
        <p className="line-clamp-2 text-base font-medium text-white/85">
          {repair.title}
        </p>
      ) : null}

      {/* ── Progress chips ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {tasksProgress ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-white/70">
            <Check className="h-3 w-3 text-emerald-400" /> {tasksProgress}
          </span>
        ) : null}
        {partsPending > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-1 text-orange-300">
            <Package className="h-3 w-3" /> {partsPending} {t("parts", "piezas", "onderdelen")}
          </span>
        ) : null}
        {totalProblems > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-1 text-rose-300">
            <AlertTriangle className="h-3 w-3" /> {totalProblems}
          </span>
        ) : null}
      </div>

      {/* ── Paused state — toon opgebouwde tijd zodat een werker
          nooit denkt "waar is m'n tijd gebleven?" als niemand nu
          aan het werk is. Hervat-knop vervangt "Start timer" op de
          Quick-actions rij hieronder. */}
      {!someoneIsWorking && liveTotalMinutes > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-white/30" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            {t("Paused", "En pausa", "Gepauzeerd")}
          </span>
          <span className="ml-auto font-mono text-sm font-bold tabular-nums text-white/80">
            {fmtDuration(liveTotalMinutes, deviceLang)}
          </span>
        </div>
      ) : null}

      {/* ── Running timers strip (if any) ─────────────────────────── */}
      {someoneIsWorking ? (
        <div className="flex flex-col gap-2 rounded-xl bg-emerald-500/[0.10] p-3 ring-1 ring-emerald-500/25">
          {/* Big live total — the number workers care about most. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                {timers.length === 1
                  ? t("Running", "En curso", "Loopt")
                  : `${timers.length} ${t("working", "trabajando", "bezig")}`}
              </span>
            </div>
            <span className="font-mono text-lg font-bold tabular-nums text-emerald-50">
              {/* Cumulatieve headline-klok = eerder opgebouwde
                  (afgeronde) tijd + lopende sessie van de langst-
                  lopende timer. Blijft daardoor monotoon groeien: bij
                  pauze+hervat springt de klok niet terug naar 0. */}
              {(() => {
                const earliestMs = timers.reduce((earliest, tm) => {
                  const tmMs =
                    typeof tm.startedAt === "string"
                      ? new Date(tm.startedAt).getTime()
                      : tm.startedAt.getTime();
                  return tmMs < earliest ? tmMs : earliest;
                }, Date.now());
                const ongoingSec = Math.max(0, Math.floor((now.getTime() - earliestMs) / 1000));
                return fmtClockSeconds(repair.totalMinutes * 60 + ongoingSec);
              })()}
            </span>
          </div>

          {/* Per-person breakdown with individual pause */}
          <div className="flex flex-col gap-1.5">
            {timers.map((tm) => (
              <div key={tm.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-emerald-100">
                  <span className="font-medium">{tm.userName ?? "—"}</span>
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-emerald-300/80">
                    {fmtLiveClock(tm.startedAt, now)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopTimer(tm);
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/15 active:bg-white/20"
                  aria-label={t(
                    `Pause ${tm.userName ?? "timer"}`,
                    `Pausar ${tm.userName ?? "temporizador"}`,
                    `Pauzeer ${tm.userName ?? "timer"}`,
                  )}
                >
                  <Pause className="h-3.5 w-3.5" />
                  {t("Pause", "Pausa", "Pauze")}
                </button>
              </div>
            ))}
          </div>

          {/* Geen "Totaal tot nu"-regel meer tijdens het werken — de
              grote live-klok boven is het enige dat telt voor de
              werker. Afronden/totalen zie je pas bij facturatie. */}
        </div>
      ) : null}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {canStartTimer && !someoneIsWorking ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartTimer();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-stone-950 shadow-sm hover:bg-white/95 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" />
            {liveTotalMinutes > 0
              ? t("Resume", "Seguir", "Hervatten")
              : t("Start timer", "Iniciar timer", "Start timer")}
          </button>
        ) : null}
        {nextTaskTitle ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTickTask();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-3 text-sm font-medium text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25 active:scale-[0.98]"
            title={nextTaskTitle}
          >
            <Check className="h-4 w-4" />
            <span className="line-clamp-1">{nextTaskTitle}</span>
          </button>
        ) : repair.nextPart ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReceivePart();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500/15 px-3 text-sm font-medium text-orange-200 ring-1 ring-orange-400/20 hover:bg-orange-500/25 active:scale-[0.98]"
            title={repair.nextPart.name}
          >
            <Package className="h-4 w-4" />
            <span className="line-clamp-1">
              {t("Got", "Recibido", "Ontvangen")}: {repair.nextPart.name}
            </span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
