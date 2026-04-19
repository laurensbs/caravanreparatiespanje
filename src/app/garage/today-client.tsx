"use client";

import {
  useState,
  useEffect,
  useMemo,
  useTransition,
  useOptimistic,
} from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { useLanguage, LanguageToggle, type Language } from "@/components/garage/language-toggle";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { updateTaskStatus, garageMarkPartReceived } from "@/actions/garage";
import { canStartGarageTimerOnRepair, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { WorkerPicker, type WorkerOption } from "@/components/garage/worker-picker";

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

const PRIORITY_RING: Record<string, string> = {
  urgent: "ring-rose-400/40",
  high: "ring-amber-400/30",
  normal: "ring-white/[0.06]",
  low: "ring-white/[0.04]",
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

  /* Worker picker — opened with a "purpose" callback so any action
     that needs an actor can route through one component. */
  const [pickerState, setPickerState] = useState<{
    purpose: "startTimer";
    repairId: string;
    repairTitle: string;
  } | null>(null);

  const [, startActionTransition] = useTransition();

  /* Tick a 1-minute heartbeat for elapsed-time badges. */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
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

  /* ── Actions ─────────────────────────────────────────────────────── */
  async function handleStartTimer(repair: RepairItem, worker: WorkerOption) {
    hapticTap();
    const actorLang = (worker.preferredLanguage ?? "en") as Language;
    startActionTransition(async () => {
      try {
        await startTimer(repair.id, worker.id);
        hapticSuccess();
        toast.success(
          tFor(
            actorLang,
            `Timer started — ${worker.name}`,
            `Temporizador iniciado — ${worker.name}`,
            `Timer gestart — ${worker.name}`,
          ),
        );
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
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-white/[0.06] bg-stone-950/90 backdrop-blur"
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

          <LanguageToggle />

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

        {/* Tab bar */}
        <div className="flex items-stretch gap-1 px-2 pb-2 sm:px-4">
          {(
            [
              { id: "active" as const, label: t("Active", "Activos", "Actief"), count: counts.active },
              { id: "waiting" as const, label: t("Waiting", "Esperando", "Wachtend"), count: counts.waiting },
              { id: "check" as const, label: t("Check", "Revisión", "Check"), count: counts.check },
              { id: "done" as const, label: t("Done", "Hecho", "Klaar"), count: counts.done },
            ]
          ).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => {
                hapticTap();
                setTab(it.id);
              }}
              className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all ${
                tab === it.id
                  ? "bg-white text-stone-950"
                  : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] active:bg-white/[0.12]"
              }`}
            >
              <span>{it.label}</span>
              <span
                className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  tab === it.id ? "bg-stone-950/15 text-stone-950" : "bg-white/[0.08] text-white/70"
                }`}
              >
                {it.count}
              </span>
            </button>
          ))}
        </div>

        {/* Live ticker */}
        {(totalActiveTimers > 0 || unreadAdminMessages > 0 || stats.urgentCount > 0) ? (
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
            {stats.urgentCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                {stats.urgentCount} {t("urgent", "urgente", "spoed")}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* ── Cards grid ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        {visibleRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] py-20 text-center">
            <div className="text-5xl">🪿</div>
            <p className="mt-3 text-base text-white/50">
              {search
                ? t("No repairs match your search.", "Sin resultados.", "Geen resultaten.")
                : tab === "done"
                  ? t("Nothing finished yet today.", "Aún no hay terminados.", "Nog niets afgerond vandaag.")
                  : t("Nothing here right now.", "Nada aquí ahora.", "Hier staat nu niets.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
  const canStartTimer = canStartGarageTimerOnRepair(repair.status);
  const someoneIsWorking = timers.length > 0;
  const totalProblems = repair.tasks.problem;
  const tasksProgress =
    repair.tasks.total > 0
      ? `${repair.tasks.done}/${repair.tasks.total}`
      : null;
  const partsPending = repair.parts.pending;

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
      className={`group flex flex-col gap-3 overflow-hidden rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset transition-all hover:bg-white/[0.05] ${PRIORITY_RING[repair.priority] ?? "ring-white/[0.06]"}`}
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
            {repair.priority === "urgent" ? (
              <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                {t("Urgent", "Urgente", "Spoed")}
              </span>
            ) : repair.priority === "high" ? (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                {t("High", "Alta", "Hoog")}
              </span>
            ) : null}
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
        {repair.totalMinutes > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 text-white/60">
            {fmtDuration(repair.totalMinutes, deviceLang)}
          </span>
        ) : null}
      </div>

      {/* ── Running timers strip (if any) ─────────────────────────── */}
      {someoneIsWorking ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-emerald-500/[0.08] p-2.5 ring-1 ring-emerald-500/20">
          {timers.map((tm) => {
            const min = elapsedMinutesSince(tm.startedAt);
            return (
              <div key={tm.id} className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-400">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400/60" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-emerald-100">
                  <span className="font-medium">{tm.userName ?? "—"}</span>
                  <span className="ml-1.5 text-emerald-300/70">
                    {fmtDuration(min, deviceLang)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopTimer(tm);
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/15 active:bg-white/20"
                >
                  <Pause className="h-3.5 w-3.5" />
                  {t("Pause", "Pausa", "Pauze")}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {canStartTimer ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartTimer();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-stone-950 shadow-sm hover:bg-white/95 active:scale-[0.98]"
          >
            <Play className="h-4 w-4 fill-current" />
            {someoneIsWorking
              ? t("Join in", "Unirme", "Aansluiten")
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
