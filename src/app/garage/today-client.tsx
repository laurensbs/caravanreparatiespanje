"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useTransition, useRef, useOptimistic } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { getSelectableGarageUsers } from "@/lib/garage-workers";
import { hapticTap, hapticSuccess, hapticNotify } from "@/lib/haptic";
import { toggleMyWorker, updateTaskStatus, garageMarkPartReceived } from "@/actions/garage";
import { startTimer, stopTimer } from "@/actions/time-entries";
import {
  canStartGarageTimerOnRepair,
  garageTimerBlockedReason,
  GARAGE_TIMER_NOT_ALLOWED,
} from "@/lib/garage-timer-policy";
import { useGarageMe, initials } from "@/lib/garage-me";
import { GarageMeSheet } from "@/components/garage/me-sheet";
import {
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Wrench,
  Clock,
  Package,
  Search,
  Timer,
  Pause,
  X,
  MessageSquare,
  Sparkles,
  Check,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Constants ─── */
const RECENT_WORKERS_KEY = "garage_recent_workers";
const RECENT_WORKERS_LIMIT = 8;

/* ─── Types ─── */

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
  allUsers: { id: string; name: string | null; role: string | null }[];
}

/* ─── Status categories ─── */

type StatusCategory = "todo" | "in_progress" | "waiting" | "check" | "done";

function categorize(r: RepairItem): StatusCategory {
  if ((r.status === "completed" && r.finalCheckStatus !== "pending") || r.status === "invoiced") return "done";
  if (r.status === "ready_for_check") return "check";
  if (r.status === "completed" && r.finalCheckStatus === "pending") return "check";
  if (["waiting_customer", "waiting_parts", "blocked"].includes(r.status)) return "waiting";
  if (r.status === "in_progress") return "in_progress";
  return "todo";
}

/* ─── Greeting ─── */

function greetingFor(d: Date, t: (en: string, es: string, nl: string) => string): string {
  const h = d.getHours();
  if (h < 5) return t("Good night", "Buenas noches", "Goedenacht");
  if (h < 12) return t("Good morning", "Buenos días", "Goedemorgen");
  if (h < 18) return t("Good afternoon", "Buenas tardes", "Goedemiddag");
  return t("Good evening", "Buenas noches", "Goedenavond");
}

/* ─── Main ─── */

export function GarageTodayClient({
  repairs: serverRepairs,
  userName,
  stats,
  activeTimers = [],
  allUsers,
}: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();

  // ── Optimistic layer ──
  // Task ticks and "part received" taps dispatch optimistic updates that
  // immediately clear the pill on the card. The server action runs in the
  // background; when it resolves we refresh, which replaces the optimistic
  // state with the authoritative server state.
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

  const [time, setTime] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusCategory | "all">("in_progress");
  const [search, setSearch] = useState("");
  const [workerPickerRepairId, setWorkerPickerRepairId] = useState<string | null>(null);
  const [recentWorkerIds, setRecentWorkerIds] = useState<string[]>([]);
  const [isStarting, startStartTransition] = useTransition();
  const [isPausing, startPauseTransition] = useTransition();
  const [isTicking, startTickTransition] = useTransition();
  const [tickedTaskId, setTickedTaskId] = useState<string | null>(null);
  const [isReceivingPart, startReceivePartTransition] = useTransition();
  const [receivedPartId, setReceivedPartId] = useState<string | null>(null);
  const [meSheetOpen, setMeSheetOpen] = useState(false);
  const prevRepairIdsRef = useRef<Set<string> | null>(null);
  const { me } = useGarageMe();

  useGaragePoll();

  // Detect new repairs and play notification sound.
  useEffect(() => {
    const currentIds = new Set(repairs.map((r) => r.id));
    if (prevRepairIdsRef.current !== null) {
      const newIds = [...currentIds].filter((id) => !prevRepairIdsRef.current!.has(id));
      if (newIds.length > 0) hapticNotify();
    }
    prevRepairIdsRef.current = currentIds;
  }, [repairs]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_WORKERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentWorkerIds(parsed.filter((v): v is string => typeof v === "string"));
      }
    } catch {
      // Ignore malformed local storage and continue with defaults.
    }
  }, []);

  function rememberWorker(workerId: string) {
    setRecentWorkerIds((prev) => {
      const next = [workerId, ...prev.filter((id) => id !== workerId)].slice(0, RECENT_WORKERS_LIMIT);
      try {
        window.localStorage.setItem(RECENT_WORKERS_KEY, JSON.stringify(next));
      } catch {
        // Ignore local storage write issues.
      }
      return next;
    });
  }

  function handleRefresh() {
    hapticTap();
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  const dateLocale = lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB";
  const formattedDate = time.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const clock = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const greeting = greetingFor(time, t);
  // Prefer the locally-chosen garage worker ("me") — on the shared iPad the
  // NextAuth `userName` is almost always "Garage" because everyone logs in
  // with the shared PIN, so it is not personal enough for a greeting.
  const identityName = me?.name ?? userName;
  const firstName = identityName.split(" ")[0] ?? identityName;

  const grouped = useMemo(() => {
    const map: Record<StatusCategory, RepairItem[]> = {
      todo: [],
      in_progress: [],
      waiting: [],
      check: [],
      done: [],
    };
    for (const r of repairs) map[categorize(r)].push(r);
    return map;
  }, [repairs]);

  const counts = {
    todo: grouped.todo.length,
    in_progress: grouped.in_progress.length,
    waiting: grouped.waiting.length,
    check: grouped.check.length,
    done: grouped.done.length,
  };

  const displayRepairs = useMemo(() => {
    let items =
      activeTab === "all"
        ? [
            ...grouped.in_progress,
            ...grouped.todo,
            ...grouped.check,
            ...grouped.waiting,
            ...grouped.done,
          ]
        : grouped[activeTab];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          (r.unitRegistration || "").toLowerCase().includes(q) ||
          (r.customerName || "").toLowerCase().includes(q) ||
          (r.publicCode || "").toLowerCase().includes(q) ||
          (r.title || "").toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeTab, grouped, search]);

  const tabs: { key: StatusCategory | "all"; label: string; count: number }[] = [
    { key: "in_progress", label: t("Active", "Activo", "Actief"), count: counts.in_progress },
    { key: "all", label: t("All", "Todos", "Alles"), count: repairs.length },
    { key: "waiting", label: t("Waiting", "Espera", "Wachten"), count: counts.waiting },
    { key: "check", label: t("Check", "Control", "Check"), count: counts.check },
    { key: "done", label: t("Done", "Hecho", "Klaar"), count: counts.done },
  ];

  // Office messages waiting for a read.
  const unreadMessages = repairs.filter(
    (r) => r.garageAdminMessage && !r.garageAdminMessageReadAt,
  ).length;

  // Every timer currently running for "me" across all jobs on this iPad.
  // Surfaced as a single "pause mine" chip so the worker can end their
  // shift in one tap instead of opening each repair.
  const myActiveTimers = useMemo(
    () => (me ? activeTimers.filter((at) => at.userId === me.id) : []),
    [activeTimers, me],
  );

  function handlePauseAllMine() {
    if (!me || myActiveTimers.length === 0) return;
    hapticTap();
    startPauseTransition(async () => {
      const results = await Promise.allSettled(
        myActiveTimers.map((at) => stopTimer(at.repairJobId, me.id)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const stopped = results.length - failed;
      if (stopped > 0) {
        toast.success(
          t(
            `Paused ${stopped} timer${stopped === 1 ? "" : "s"}`,
            `${stopped} temporizador${stopped === 1 ? "" : "es"} en pausa`,
            `${stopped} timer${stopped === 1 ? "" : "s"} gepauzeerd`,
          ),
        );
      }
      if (failed > 0) {
        toast.error(
          t(
            `${failed} timer${failed === 1 ? "" : "s"} couldn't be paused`,
            `No se pudieron pausar ${failed}`,
            `${failed} timer${failed === 1 ? "" : "s"} kon niet gepauzeerd worden`,
          ),
        );
      }
      router.refresh();
    });
  }

  const selectableUsers = useMemo(() => {
    const users = getSelectableGarageUsers(allUsers);
    const order = new Map(recentWorkerIds.map((id, idx) => [id, idx]));
    return [...users].sort((a, b) => {
      const ai = order.get(a.id);
      const bi = order.get(b.id);
      if (ai != null && bi != null) return ai - bi;
      if (ai != null) return -1;
      if (bi != null) return 1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [allUsers, recentWorkerIds]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-950 text-white">
      {/* Unified sticky shell — keeps top bar, search (mobile), stat strip and
          tab bar stacked together so they can't overlap when the browser
          chrome resizes or the stat row wraps on a phone. */}
      <div className="safe-area-pt sticky top-0 z-30 border-b border-white/[0.06] bg-gray-950/90 backdrop-blur-xl">
        <header className="mx-auto max-w-6xl">
          {/* Row 1: identity + search + refresh */}
          <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
            {/* "Me" identity chip */}
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setMeSheetOpen(true);
              }}
              className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-left transition-all active:scale-[0.98] hover:bg-white/[0.07]"
              aria-label={t("Your profile", "Tu perfil", "Jouw profiel")}
            >
              <span
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white ${
                  me
                    ? "bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_0_0_2px_rgba(20,184,166,0.25)]"
                    : "bg-gradient-to-br from-teal-500/30 to-teal-400/10 ring-1 ring-teal-400/20"
                }`}
              >
                {me ? initials(me.name) : <Wrench className="h-4 w-4 text-teal-200" />}
                {me ? (
                  <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-gray-950" />
                ) : null}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-white/90">
                  {me
                    ? `${greeting}, ${firstName}`
                    : t("Who's at the iPad?", "¿Quién está en el iPad?", "Wie is aan de iPad?")}
                </p>
                <p className="truncate text-[11px] text-white/35 capitalize">
                  {formattedDate} · <span className="tabular-nums">{clock}</span>
                </p>
              </div>
            </button>

            <div className="ml-auto flex items-center gap-1">
              {/* My running timers — one-tap pause-all for end of shift */}
              {myActiveTimers.length > 0 && me ? (
                <button
                  type="button"
                  disabled={isPausing}
                  onClick={handlePauseAllMine}
                  className="motion-safe:animate-pop-in flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/15 px-3 text-[12px] font-semibold text-red-200 transition-all active:scale-95 hover:bg-red-500/25 disabled:opacity-50"
                  aria-label={t(
                    "Pause all my timers",
                    "Pausar mis temporizadores",
                    "Mijn timers pauzeren",
                  )}
                >
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  <span className="hidden sm:inline">
                    {t("Pause mine", "Pausar", "Pauzeer mijne")}
                  </span>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/30 px-1 text-[10.5px] font-bold tabular-nums">
                    {myActiveTimers.length}
                  </span>
                </button>
              ) : null}
              <div className="hidden w-64 md:block lg:w-80">
                <SearchField search={search} setSearch={setSearch} t={t} />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white/40 transition-all hover:bg-white/[0.06] active:scale-95"
                aria-label={t("Refresh", "Actualizar", "Vernieuwen")}
              >
                <RefreshCw
                  className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Row 2 (mobile-only): search field */}
          <div className="px-3 pb-2 sm:px-4 md:hidden">
            <SearchField search={search} setSearch={setSearch} t={t} />
          </div>

          {/* Row 3: stat strip */}
          <div className="px-3 pb-2 sm:px-4 sm:pb-3">
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto sm:gap-2">
              <StatPill
                tone="emerald"
                icon={<Wrench className="h-3.5 w-3.5" />}
                label={t("Active now", "Activos ahora", "Nu actief")}
                value={counts.in_progress}
                onClick={() => {
                  hapticTap();
                  setActiveTab("in_progress");
                }}
              />
              {stats.urgentCount > 0 ? (
                <StatPill
                  tone="red"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label={t("Urgent", "Urgente", "Spoed")}
                  value={stats.urgentCount}
                />
              ) : null}
              {stats.waitingPartsCount > 0 ? (
                <StatPill
                  tone="amber"
                  icon={<Package className="h-3.5 w-3.5" />}
                  label={t("Need parts", "Faltan piezas", "Onderdelen")}
                  value={stats.waitingPartsCount}
                  onClick={() => {
                    hapticTap();
                    setActiveTab("waiting");
                  }}
                />
              ) : null}
              {counts.check > 0 ? (
                <StatPill
                  tone="violet"
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label={t("Final check", "Control final", "Eindcheck")}
                  value={counts.check}
                  onClick={() => {
                    hapticTap();
                    setActiveTab("check");
                  }}
                />
              ) : null}
              {unreadMessages > 0 ? (
                <StatPill
                  tone="sky"
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  label={t("Office", "Oficina", "Kantoor")}
                  value={unreadMessages}
                />
              ) : null}
              {stats.tomorrowCount > 0 ? (
                <StatPill
                  tone="muted"
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={t("Tomorrow", "Mañana", "Morgen")}
                  value={stats.tomorrowCount}
                />
              ) : null}
            </div>
          </div>

          {/* Row 4: pill tab bar */}
          <div className="px-3 pb-2.5 sm:px-4">
            <div className="no-scrollbar inline-flex w-full gap-1 overflow-x-auto rounded-2xl bg-white/[0.04] p-1">
              {tabs.map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    type="button"
                    key={tab.key}
                    onClick={() => {
                      hapticTap();
                      setActiveTab(tab.key);
                    }}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition-all ${
                      active
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 ? (
                      <span
                        className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                          active ? "bg-gray-900 text-white" : "bg-white/10 text-white/50"
                        }`}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </header>
      </div>

      {/* ─── Content ─── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-3 pb-12 sm:px-4 sm:py-4">
        {repairs.length === 0 ? (
          <EmptyState t={t} stats={stats} onRefresh={handleRefresh} refreshing={refreshing} />
        ) : displayRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-white/30">
              {t("No jobs in this category", "Sin trabajos", "Geen klussen")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayRepairs.map((repair, idx) => {
              const timerStartAllowed = canStartGarageTimerOnRepair(repair.status);
              const repairTimers = activeTimers.filter((at) => at.repairJobId === repair.id);
              return (
                <JobCard
                  key={repair.id}
                  repair={repair}
                  index={idx}
                  t={t}
                  activeTimers={repairTimers}
                  quickUsers={selectableUsers}
                  me={me}
                  timerStartAllowed={timerStartAllowed}
                  pauseDisabled={isPausing}
                  tickDisabled={isTicking}
                  tickedTaskId={tickedTaskId}
                  receivePartDisabled={isReceivingPart}
                  receivedPartId={receivedPartId}
                  onReceiveNextPart={(partRequestId) => {
                    if (!repair.nextPart || repair.nextPart.id !== partRequestId) return;
                    hapticSuccess();
                    setReceivedPartId(partRequestId);
                    startReceivePartTransition(async () => {
                      applyOptimistic({
                        type: "receivePart",
                        repairId: repair.id,
                        partId: partRequestId,
                      });
                      try {
                        await garageMarkPartReceived(partRequestId);
                        toast.success(
                          t("Part received", "Pieza recibida", "Onderdeel binnen"),
                        );
                      } catch {
                        setReceivedPartId(null);
                        toast.error(
                          t(
                            "Could not mark received",
                            "No se pudo marcar como recibido",
                            "Kon niet als binnen markeren",
                          ),
                        );
                      }
                      router.refresh();
                      setTimeout(() => setReceivedPartId(null), 800);
                    });
                  }}
                  onTickNextTask={(taskId) => {
                    if (!repair.nextTask || repair.nextTask.id !== taskId) return;
                    hapticSuccess();
                    setTickedTaskId(taskId);
                    startTickTransition(async () => {
                      applyOptimistic({
                        type: "tickTask",
                        repairId: repair.id,
                        taskId,
                      });
                      try {
                        await updateTaskStatus(taskId, "done");
                        toast.success(
                          t("Task done — nice work!", "Tarea hecha — ¡buen trabajo!", "Taak klaar — top!"),
                        );
                      } catch {
                        setTickedTaskId(null);
                        toast.error(
                          t("Could not mark done", "No se pudo marcar como hecho", "Kon niet als klaar markeren"),
                        );
                      }
                      router.refresh();
                      setTimeout(() => setTickedTaskId(null), 800);
                    });
                  }}
                  onMainTap={() => {
                    hapticTap();
                    // Already working on it → open the detail page.
                    if (repairTimers.length > 0) {
                      router.push(`/garage/repairs/${repair.id}`);
                      return;
                    }
                    // Not clockable yet (e.g. already completed, waiting parts):
                    // just open details instead of showing a dead-end picker.
                    if (!timerStartAllowed) {
                      router.push(`/garage/repairs/${repair.id}`);
                      return;
                    }
                    // If we know who is at the iPad, skip the picker and go
                    // straight into the job (detail page handles starting the
                    // timer there, with the worker pre-selected).
                    if (me) {
                      router.push(`/garage/repairs/${repair.id}`);
                      return;
                    }
                    setWorkerPickerRepairId(repair.id);
                  }}
                  onPauseUser={(userId) => {
                    hapticTap();
                    startPauseTransition(async () => {
                      await stopTimer(repair.id, userId);
                      toast.success(
                        t(
                          "Timer paused — time saved on this job",
                          "Temporizador en pausa — tiempo guardado",
                          "Timer gepauzeerd — tijd opgeslagen op deze klus",
                        ),
                      );
                      router.refresh();
                    });
                  }}
                  onQuickStart={(userId) => {
                    if (!timerStartAllowed) {
                      hapticTap();
                      toast.message(garageTimerBlockedReason(repair.status, t));
                      return;
                    }
                    hapticSuccess();
                    startStartTransition(async () => {
                      try {
                        const user = selectableUsers.find((u) => u.id === userId);
                        if (!user) return;
                        const alreadyAssigned = repair.workers?.includes(user.name ?? "");
                        if (!alreadyAssigned) {
                          await toggleMyWorker(repair.id, user.id);
                        }
                        await startTimer(repair.id, user.id);
                        rememberWorker(user.id);
                        toast.success(
                          `${t("Timer started for", "Temporizador iniciado para", "Timer gestart voor")} ${user.name}`,
                        );
                      } catch (e) {
                        if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
                          toast.message(garageTimerBlockedReason(repair.status, t));
                        } else {
                          toast.message(
                            t(
                              "Timer could not be started",
                              "No se pudo iniciar el temporizador",
                              "Timer kon niet gestart worden",
                            ),
                          );
                        }
                      }
                      router.refresh();
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Me sheet (worker switcher + language + lock) ─── */}
      <GarageMeSheet
        open={meSheetOpen}
        onClose={() => setMeSheetOpen(false)}
        users={selectableUsers}
      />

      {/* ─── Worker picker overlay ─── */}
      {workerPickerRepairId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setWorkerPickerRepairId(null)}
        >
          <div
            className="motion-safe:animate-pop-in mx-0 w-full max-w-md rounded-t-3xl border border-white/10 bg-gray-900 p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:mx-4 sm:rounded-2xl sm:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/10 sm:hidden" />
            <h3 className="text-base font-semibold text-white">
              {t("Who is working?", "¿Quién trabaja?", "Wie gaat werken?")}
            </h3>
            <p className="mb-4 mt-0.5 text-[12.5px] text-white/40">
              {t(
                "Tap a name to clock in and start the timer.",
                "Toca un nombre para fichar e iniciar el temporizador.",
                "Tik een naam om in te klokken en de timer te starten.",
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {selectableUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={isStarting}
                  onClick={() => {
                    hapticSuccess();
                    const repairId = workerPickerRepairId;
                    const pickedRepair = repairs.find((r) => r.id === repairId);
                    if (!pickedRepair || !canStartGarageTimerOnRepair(pickedRepair.status)) {
                      toast.message(garageTimerBlockedReason(pickedRepair?.status ?? "todo", t));
                      setWorkerPickerRepairId(null);
                      if (pickedRepair) router.push(`/garage/repairs/${pickedRepair.id}`);
                      return;
                    }
                    startStartTransition(async () => {
                      try {
                        const alreadyAssigned = pickedRepair.workers?.includes(user.name ?? "");
                        if (!alreadyAssigned) {
                          await toggleMyWorker(repairId, user.id);
                        }
                        await startTimer(repairId, user.id);
                        rememberWorker(user.id);
                        const workerName = user.name ?? t("Unknown", "Desconocido", "Onbekend");
                        toast.success(
                          `${t("Timer started for", "Temporizador iniciado para", "Timer gestart voor")} ${workerName}`,
                        );
                      } catch (e) {
                        const workerName = user.name ?? t("Unknown", "Desconocido", "Onbekend");
                        if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
                          toast.message(garageTimerBlockedReason(pickedRepair.status, t));
                        } else {
                          toast.message(
                            `${t("Timer already running for", "Temporizador ya activo para", "Timer loopt al voor")} ${workerName}`,
                          );
                        }
                      }
                      setWorkerPickerRepairId(null);
                      router.refresh();
                    });
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-4 text-white transition-all active:scale-[0.97] hover:bg-white/[0.08] disabled:opacity-50"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/40 to-teal-600/20 text-base font-bold text-white">
                    {(user.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-full truncate text-[13px] font-semibold">
                    {user.name?.split(" ")[0] ?? "?"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const repairId = workerPickerRepairId;
                setWorkerPickerRepairId(null);
                router.push(`/garage/repairs/${repairId}`);
              }}
              className="mt-4 w-full rounded-2xl bg-white/[0.04] py-3 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.07]"
            >
              {t("Open job details", "Abrir detalles", "Open klusdetails")}
            </button>
            <button
              type="button"
              onClick={() => setWorkerPickerRepairId(null)}
              className="mt-2 w-full rounded-2xl py-2.5 text-[12.5px] font-medium text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60"
            >
              {t("Close", "Cerrar", "Sluiten")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════ */
/* Reusable bits                          */
/* ═════════════════════════════════════ */

function SearchField({
  search,
  setSearch,
  t,
}: {
  search: string;
  setSearch: (v: string) => void;
  t: (en: string, es: string, nl: string) => string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("Search registration, customer…", "Buscar matrícula, cliente…", "Zoek kenteken, klant…")}
        className="h-10 w-full rounded-xl border border-white/[0.06] bg-white/[0.05] pl-9 pr-9 text-sm text-white placeholder:text-white/25 transition-all focus:border-white/15 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-white/10"
      />
      {search ? (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
          aria-label="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "emerald" | "red" | "amber" | "sky" | "violet" | "muted";
  onClick?: () => void;
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: "text-emerald-300 ring-emerald-400/20 bg-emerald-500/[0.07]",
    red: "text-red-300 ring-red-400/25 bg-red-500/[0.08]",
    amber: "text-amber-300 ring-amber-400/25 bg-amber-500/[0.07]",
    sky: "text-teal-300 ring-teal-400/25 bg-teal-500/[0.07]",
    violet: "text-violet-300 ring-violet-400/25 bg-violet-500/[0.07]",
    muted: "text-white/55 ring-white/10 bg-white/[0.04]",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition-all ${toneClass[tone]} ${
        onClick ? "active:scale-[0.97] hover:brightness-110" : ""
      }`}
    >
      {icon}
      <span className="opacity-80">{label}</span>
      <span className="tabular-nums">{value}</span>
    </Tag>
  );
}

/* ═════════════════════════════════════ */

const STATUS_DOT: Record<string, string> = {
  todo: "bg-white/25",
  new: "bg-white/25",
  scheduled: "bg-white/25",
  in_progress: "bg-teal-400",
  in_inspection: "bg-teal-400",
  waiting_parts: "bg-amber-400",
  waiting_customer: "bg-amber-400",
  blocked: "bg-red-400",
  ready_for_check: "bg-violet-400",
  completed: "bg-emerald-400",
  invoiced: "bg-emerald-400",
};

function JobCard({
  repair,
  index,
  t,
  activeTimers,
  quickUsers,
  me,
  timerStartAllowed,
  pauseDisabled,
  tickDisabled,
  tickedTaskId,
  receivePartDisabled,
  receivedPartId,
  onMainTap,
  onPauseUser,
  onQuickStart,
  onTickNextTask,
  onReceiveNextPart,
}: {
  repair: RepairItem;
  index: number;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers: ActiveTimerItem[];
  quickUsers: { id: string; name: string | null; role: string | null }[];
  me: { id: string; name: string } | null;
  timerStartAllowed: boolean;
  pauseDisabled: boolean;
  tickDisabled: boolean;
  tickedTaskId: string | null;
  receivePartDisabled: boolean;
  receivedPartId: string | null;
  onMainTap: () => void;
  onPauseUser: (userId: string) => void;
  onQuickStart: (userId: string) => void;
  onTickNextTask: (taskId: string) => void;
  onReceiveNextPart: (partRequestId: string) => void;
}) {
  const hasTimer = activeTimers.length > 0;
  // When we know who is at the iPad, skip the 2-column user grid and show a
  // single "Start timer — Felipe" button. Much faster on a shared tablet
  // because workers don't have to hunt for their name on every job card.
  const showStartAsMe = timerStartAllowed && !!me && !hasTimer;
  const showQuickStart = timerStartAllowed && !me && quickUsers.length > 0;
  const showNextTask =
    repair.status === "in_progress" &&
    !!repair.nextTask &&
    repair.tasks.total > 0;
  const showNextPart =
    repair.status === "waiting_parts" && !!repair.nextPart;
  const hasFooter =
    activeTimers.length > 0 || showQuickStart || showStartAsMe || showNextTask || showNextPart;
  const progress = repair.tasks.total > 0 ? (repair.tasks.done / repair.tasks.total) * 100 : 0;
  const hasUnreadMessage = !!(repair.garageAdminMessage && !repair.garageAdminMessageReadAt);
  const isThisTaskTicking = !!(repair.nextTask && tickedTaskId === repair.nextTask.id);
  const isThisPartReceiving = !!(repair.nextPart && receivedPartId === repair.nextPart.id);
  const nextTaskTitle = repair.nextTask
    ? t(repair.nextTask.title, repair.nextTask.titleEs, repair.nextTask.titleNl)
    : "";
  const nextPartStatusLabel = repair.nextPart
    ? repair.nextPart.status === "shipped"
      ? t("Shipped — confirm arrival", "Enviado — confirmar llegada", "Onderweg — bevestig binnenkomst")
      : repair.nextPart.status === "ordered"
        ? t("Ordered — mark received", "Pedido — marcar recibido", "Besteld — markeer binnen")
        : t("Requested — mark received", "Solicitado — marcar recibido", "Aangevraagd — markeer binnen")
    : "";

  return (
    <div
      // Cap the stagger at ~12 cards so a busy day doesn't look like a
      // waterfall. Anything past that just fades in instantly.
      style={{
        animationDelay: `${Math.min(index, 12) * 30}ms`,
        animationFillMode: "backwards",
      }}
      className={`motion-safe:animate-slide-up rounded-2xl border transition-all ${
        hasTimer
          ? "border-teal-400/25 bg-teal-400/[0.06] shadow-[0_0_0_1px_rgba(20,184,166,0.10)]"
          : hasUnreadMessage
            ? "border-teal-400/15 bg-white/[0.03]"
            : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.1] hover:bg-white/[0.04]"
      }`}
    >
      <button
        type="button"
        onClick={onMainTap}
        className={`group block w-full text-left transition-transform active:scale-[0.99] ${
          hasFooter ? "rounded-t-2xl" : "rounded-2xl"
        }`}
      >
        <div className="px-4 py-3.5">
          {/* Top row: registration / status / timer / message */}
          <div className="mb-2 flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[repair.status] || "bg-white/25"}`} />
            <span className="font-mono text-[17px] font-bold tracking-tight text-white">
              {repair.unitRegistration || repair.publicCode || "—"}
            </span>
            {repair.priority === "urgent" ? (
              <span className="rounded-md bg-red-400/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-red-300">
                {t("Urgent", "Urgente", "Spoed")}
              </span>
            ) : null}
            {repair.priority === "high" ? (
              <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-300">
                {t("High", "Alta", "Hoog")}
              </span>
            ) : null}

            <div className="ml-auto flex items-center gap-1.5">
              {hasTimer ? (
                <span className="flex items-center gap-1 rounded-full bg-teal-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-teal-300 ring-1 ring-teal-400/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
                  </span>
                  <Timer className="h-3 w-3" />
                </span>
              ) : null}
              {hasUnreadMessage ? (
                <span
                  className="flex items-center text-teal-300"
                  title={t("Office message", "Mensaje de oficina", "Bericht van kantoor")}
                >
                  <MessageSquare className="h-4 w-4" />
                </span>
              ) : null}
              <ChevronRight className="h-4.5 w-4.5 shrink-0 text-white/15 transition-colors group-hover:text-white/35" />
            </div>
          </div>

          {/* Customer + brand */}
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate text-[13px] text-white/55">
              {repair.customerName || t("No customer", "Sin cliente", "Geen klant")}
            </span>
            {repair.unitBrand ? (
              <span className="truncate text-[12px] text-white/25">
                · {repair.unitBrand} {repair.unitModel}
              </span>
            ) : null}
          </div>

          {/* Location — using an inline pill so it is scannable at a glance
              while on the workshop floor. Storage location is the bay/zone;
              current position is an override (e.g. "in the paint booth"). */}
          {repair.unitStorageLocation || repair.unitCurrentPosition ? (
            <div className="mb-2 inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[11.5px] font-medium text-white/50">
              <MapPin className="h-3 w-3 shrink-0 text-white/40" />
              <span className="truncate">
                {repair.unitStorageLocation ||
                  t("Unknown location", "Ubicación desconocida", "Onbekende locatie")}
                {repair.unitCurrentPosition
                  ? ` · ${repair.unitCurrentPosition}`
                  : ""}
              </span>
            </div>
          ) : null}

          {/* Title (1-line) */}
          {repair.title ? (
            <p className="mb-2.5 truncate text-[12.5px] text-white/30">{repair.title}</p>
          ) : (
            <div className="mb-1.5" />
          )}

          {/* Footer chips */}
          {/* (Next-task pill is rendered just below the main button so the tap
              target can stop click propagation without breaking card open.) */}
          <div className="flex flex-wrap items-center gap-3">
            {repair.tasks.total > 0 ? (
              <div className="flex min-w-[140px] flex-1 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      progress === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-teal-400 to-teal-500"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-white/35">
                  {repair.tasks.done}/{repair.tasks.total}
                </span>
              </div>
            ) : null}
            {repair.parts.pending > 0 ? (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-amber-300">
                <Package className="h-3.5 w-3.5" />
                {repair.parts.pending}
              </span>
            ) : null}
            {repair.tasks.problem > 0 ? (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-red-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                {repair.tasks.problem}
              </span>
            ) : null}
            {repair.workers.length > 0 ? (
              <div className="flex -space-x-1.5">
                {repair.workers.slice(0, 3).map((w, i) => (
                  <div
                    key={i}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-950 bg-gradient-to-br from-teal-500/40 to-teal-600/20 text-[10.5px] font-bold text-white"
                  >
                    {w.charAt(0).toUpperCase()}
                  </div>
                ))}
                {repair.workers.length > 3 ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gray-950 bg-white/[0.08] text-[10.5px] font-bold text-white/55">
                    +{repair.workers.length - 3}
                  </div>
                ) : null}
              </div>
            ) : null}
            {repair.totalMinutes > 0 ? (
              <span className="flex items-center gap-1 text-[12px] font-medium tabular-nums text-white/30">
                <Clock className="h-3.5 w-3.5" />
                {Math.floor(repair.totalMinutes / 60) > 0
                  ? `${Math.floor(repair.totalMinutes / 60)}h ${repair.totalMinutes % 60}m`
                  : `${repair.totalMinutes}m`}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      {showNextTask && repair.nextTask ? (
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={tickDisabled}
              onClick={() => onTickNextTask(repair.nextTask!.id)}
              aria-label={t("Mark task done", "Marcar tarea como hecha", "Markeer taak als klaar")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 disabled:cursor-progress ${
                isThisTaskTicking
                  ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200"
                  : "border-white/[0.12] bg-white/[0.04] text-white/60 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
              }`}
            >
              {isThisTaskTicking ? (
                <CheckCircle2 className="h-4.5 w-4.5 motion-safe:animate-pop-in" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-white/35">
                {repair.nextTask.status === "in_progress"
                  ? t("In progress", "En curso", "Bezig")
                  : t("Up next", "Siguiente", "Volgende")}
              </p>
              <p
                className={`truncate text-[13px] font-medium leading-tight ${
                  isThisTaskTicking ? "text-emerald-200 line-through opacity-70" : "text-white/85"
                }`}
              >
                {nextTaskTitle}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {showNextPart && repair.nextPart ? (
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={receivePartDisabled}
              onClick={() => onReceiveNextPart(repair.nextPart!.id)}
              aria-label={t("Mark part received", "Marcar pieza recibida", "Markeer onderdeel binnen")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 disabled:cursor-progress ${
                isThisPartReceiving
                  ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200"
                  : "border-amber-400/30 bg-amber-400/[0.08] text-amber-200 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200"
              }`}
            >
              {isThisPartReceiving ? (
                <CheckCircle2 className="h-4.5 w-4.5 motion-safe:animate-pop-in" />
              ) : (
                <Package className="h-4 w-4" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-bold uppercase tracking-wider text-amber-200/70">
                {nextPartStatusLabel}
              </p>
              <p
                className={`truncate text-[13px] font-medium leading-tight ${
                  isThisPartReceiving ? "text-emerald-200 line-through opacity-70" : "text-white/85"
                }`}
              >
                {repair.nextPart.name}
                {repair.parts.pending > 1 ? (
                  <span className="ml-1.5 text-white/35">
                    +{repair.parts.pending - 1}{" "}
                    {t("more", "más", "meer")}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTimers.length > 0 ? (
        <div className="flex flex-col gap-2 px-4 pb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-white/35">
            {t("Pause timer (saved on this repair)", "Pausar (guardado en esta reparación)", "Timer pauzeren (opgeslagen op klus)")}
          </span>
          <div className="flex flex-col gap-2 sm:flex-row">
            {activeTimers.map((at) => (
              <button
                key={at.id}
                type="button"
                disabled={pauseDisabled}
                onClick={() => onPauseUser(at.userId)}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-3 rounded-xl border border-red-500/25 bg-red-500/15 px-4 text-base font-semibold text-red-200 transition-all active:scale-[0.98] active:bg-red-500/25 disabled:opacity-50"
              >
                <Pause className="h-5 w-5 shrink-0" />
                <span className="truncate">{at.userName?.split(" ")[0] ?? "?"}</span>
                <OverviewTimerElapsed startedAt={at.startedAt} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showStartAsMe && me ? (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => onQuickStart(me.id)}
            className="group flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl border border-teal-400/25 bg-teal-500/[0.08] px-4 text-sm font-bold text-teal-200 transition-all active:scale-[0.98] hover:bg-teal-500/[0.15]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[13px] font-bold text-white">
              {me.name.charAt(0).toUpperCase()}
            </span>
            <span className="tracking-tight">
              {t("Start timer as", "Iniciar como", "Start timer als")}{" "}
              {me.name.split(" ")[0]}
            </span>
            <Timer className="h-4 w-4 opacity-60 transition-transform group-hover:rotate-12" />
          </button>
        </div>
      ) : null}

      {showQuickStart ? (
        <div className="flex flex-col gap-2 border-t border-white/[0.06] px-4 pb-4 pt-3">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-white/35">
            {t("Start timer", "Iniciar temporizador", "Timer starten")}
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quickUsers.slice(0, 6).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onQuickStart(user.id)}
                className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-teal-400/25 bg-teal-500/[0.08] px-3 text-base font-bold text-teal-200 transition-all active:scale-[0.97] hover:bg-teal-500/[0.15]"
                title={`${t("Start timer for", "Iniciar temporizador para", "Start timer voor")} ${user.name ?? ""}`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/40 to-teal-600/20 text-sm">
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[100px] truncate text-[13px] font-semibold">
                  {user.name?.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OverviewTimerElapsed({ startedAt }: { startedAt: Date | string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(
        h > 0
          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${m}:${String(s).padStart(2, "0")}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="font-mono text-base tabular-nums text-white/85">{label}</span>;
}

/* ═════════════════════════════════════ */

function EmptyState({
  t,
  stats,
  onRefresh,
  refreshing,
}: {
  t: (en: string, es?: string | null, nl?: string | null) => string;
  stats: QuickStats;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="motion-safe:animate-fade-in flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-gradient-to-br from-teal-500/15 to-teal-400/5">
        <Wrench className="h-7 w-7 text-teal-300/60" />
      </div>
      <h2 className="mb-1 text-lg font-semibold text-white/90">
        {t("No work scheduled", "Sin trabajos programados", "Geen werk gepland")}
      </h2>
      <p className="mb-6 max-w-xs text-sm text-white/30">
        {stats.tomorrowCount > 0
          ? t(
              `${stats.tomorrowCount} job${stats.tomorrowCount > 1 ? "s" : ""} scheduled for tomorrow`,
              `${stats.tomorrowCount} trabajo${stats.tomorrowCount > 1 ? "s" : ""} programado${stats.tomorrowCount > 1 ? "s" : ""} para mañana`,
              `${stats.tomorrowCount} klus${stats.tomorrowCount > 1 ? "sen" : ""} gepland voor morgen`,
            )
          : t("Check back later", "Vuelve más tarde", "Kom later terug")}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-medium text-white transition-all hover:bg-white/15 active:scale-95"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {t("Refresh", "Actualizar", "Vernieuwen")}
      </button>
      {stats.waitingPartsCount > 0 || stats.urgentCount > 0 ? (
        <div className="mt-8 flex gap-4">
          {stats.urgentCount > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.urgentCount} {t("urgent", "urgente", "spoed")}
            </div>
          ) : null}
          {stats.waitingPartsCount > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Package className="h-3.5 w-3.5" />
              {stats.waitingPartsCount} {t("waiting parts", "esperando piezas", "wachten op onderdelen")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
