"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useTransition, useRef } from "react";
import { useLanguage, LanguageToggle } from "@/components/garage/language-toggle";
import { useGaragePoll } from "@/lib/use-garage-poll";
import { getSelectableGarageUsers } from "@/lib/garage-workers";
import { hapticTap, hapticSuccess, hapticNotify } from "@/lib/haptic";
import { garageLock } from "@/actions/garage-auth";
import { toggleMyWorker } from "@/actions/garage";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { canStartGarageTimerOnRepair, garageTimerBlockedReason, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import {
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Wrench,
  Clock,
  Package,
  Lock,
  Search,
  Timer,
  Pause,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
const RECENT_WORKERS_KEY = "garage_recent_workers";
const RECENT_WORKERS_LIMIT = 8;

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

/* ─── Main ─── */

export function GarageTodayClient({ repairs, userName, stats, activeTimers = [], allUsers }: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [time, setTime] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [workerPickerRepairId, setWorkerPickerRepairId] = useState<string | null>(null);
  const [recentWorkerIds, setRecentWorkerIds] = useState<string[]>([]);
  const [isStarting, startStartTransition] = useTransition();
  const [isPausing, startPauseTransition] = useTransition();
  const prevRepairIdsRef = useRef<Set<string> | null>(null);

  useGaragePoll();

  // Detect new repairs and play notification sound
  useEffect(() => {
    const currentIds = new Set(repairs.map((r) => r.id));
    if (prevRepairIdsRef.current !== null) {
      const newIds = [...currentIds].filter((id) => !prevRepairIdsRef.current!.has(id));
      if (newIds.length > 0) {
        hapticNotify();
      }
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
  const formattedDate = time.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" });
  const clock = time.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const grouped = useMemo(() => {
    const map: Record<StatusCategory, RepairItem[]> = { todo: [], in_progress: [], waiting: [], check: [], done: [] };
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
    let items = activeTab === "all"
      ? [...grouped.in_progress, ...grouped.todo, ...grouped.check, ...grouped.waiting, ...grouped.done]
      : grouped[activeTab];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(r =>
        (r.unitRegistration || "").toLowerCase().includes(q) ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.publicCode || "").toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeTab, grouped, search]);

  const tabs: { key: StatusCategory | "all"; label: string; count: number }[] = [
    { key: "all", label: t("All", "Todo", "Alles"), count: repairs.length },
    { key: "in_progress", label: t("Active", "Activo", "Actief"), count: counts.in_progress },
    { key: "waiting", label: t("Waiting", "Espera", "Wachten"), count: counts.waiting },
    { key: "check", label: t("Check", "Control", "Check"), count: counts.check },
    { key: "done", label: t("Done", "Hecho", "Klaar"), count: counts.done },
  ];

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
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur-xl border-b border-white/[0.06] safe-area-pt">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white/80" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/90 leading-tight">{formattedDate}</p>
              <p className="text-[11px] text-white/30 tabular-nums">{clock}</p>
            </div>
          </div>
          <div className="flex-1 max-w-xs mx-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search...", "Buscar...", "Zoeken...")}
                className="w-full h-9 pl-8 pr-8 rounded-xl bg-white/[0.06] border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/10 focus:bg-white/[0.08] transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button onClick={handleRefresh} className="h-10 w-10 flex items-center justify-center rounded-xl text-white/40 hover:bg-white/[0.06] active:scale-95 transition-all">
              <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={async () => { hapticTap(); await garageLock(); router.refresh(); }} className="h-10 w-10 flex items-center justify-center rounded-xl text-white/40 hover:bg-white/[0.06] active:scale-95 transition-all">
              <Lock className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Tab bar ─── */}
      <div className="sticky top-14 z-20 bg-gray-950/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => { hapticTap(); setActiveTab(tab.key); }}
                  className={`flex items-center gap-2 min-h-12 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                    active ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/50"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                      active ? "bg-white text-gray-950" : "bg-white/10 text-white/40"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-4 pb-8">
        {repairs.length === 0 ? (
          <EmptyState t={t} stats={stats} onRefresh={handleRefresh} refreshing={refreshing} />
        ) : displayRepairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-white/30">{t("No jobs in this category", "Sin trabajos", "Geen klussen")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayRepairs.map((repair) => {
              const timerStartAllowed = canStartGarageTimerOnRepair(repair.status);
              const repairTimers = activeTimers.filter((at) => at.repairJobId === repair.id);
              return (
              <JobCard
                key={repair.id}
                repair={repair}
                t={t}
                activeTimers={repairTimers}
                quickUsers={selectableUsers}
                timerStartAllowed={timerStartAllowed}
                pauseDisabled={isPausing}
                onMainTap={() => {
                  hapticTap();
                  if (repairTimers.length > 0) {
                    router.push(`/garage/repairs/${repair.id}`);
                    return;
                  }
                  if (timerStartAllowed) setWorkerPickerRepairId(repair.id);
                  else router.push(`/garage/repairs/${repair.id}`);
                }}
                onPauseUser={(userId) => {
                  hapticTap();
                  startPauseTransition(async () => {
                    await stopTimer(repair.id, userId);
                    toast.success(
                      t("Timer paused — time saved on this job", "Temporizador en pausa — tiempo guardado", "Timer gepauzeerd — tijd opgeslagen op deze klus")
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
                        `${t("Timer started for", "Temporizador iniciado para", "Timer gestart voor")} ${user.name}`
                      );
                    } catch (e) {
                      if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
                        toast.message(garageTimerBlockedReason(repair.status, t));
                      } else {
                        toast.message(
                          t("Timer could not be started", "No se pudo iniciar el temporizador", "Timer kon niet gestart worden")
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

      {/* ─── Worker picker overlay ─── */}
      {workerPickerRepairId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setWorkerPickerRepairId(null)}>
          <div className="w-full max-w-sm mx-4 rounded-2xl bg-gray-900 border border-white/10 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">
              {t("Who is working?", "¿Quién trabaja?", "Wie gaat werken?")}
            </h3>
            <p className="text-sm text-white/40 mb-5">
              {t("Select a person to start", "Selecciona una persona", "Selecteer een persoon om te starten")}
            </p>
            <div className="flex flex-col gap-2">
              {selectableUsers.map((user) => (
                <button
                  key={user.id}
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
                          `${t("Timer started for", "Temporizador iniciado para", "Timer gestart voor")} ${workerName}`
                        );
                      } catch (e) {
                        const workerName = user.name ?? t("Unknown", "Desconocido", "Onbekend");
                        if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
                          toast.message(garageTimerBlockedReason(pickedRepair.status, t));
                        } else {
                          toast.message(
                            `${t("Timer already running for", "Temporizador ya activo para", "Timer loopt al voor")} ${workerName}`
                          );
                        }
                      }
                      setWorkerPickerRepairId(null);
                      router.refresh();
                    });
                  }}
                  className="flex items-center gap-3 h-14 px-4 rounded-xl bg-white/[0.06] border border-white/[0.06] hover:bg-white/[0.12] active:scale-[0.97] transition-all disabled:opacity-50"
                >
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/60">
                    {(user.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <span className="text-base font-medium text-white">{user.name ?? "Unknown"}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const repairId = workerPickerRepairId;
                setWorkerPickerRepairId(null);
                router.push(`/garage/repairs/${repairId}`);
              }}
              className="w-full mt-3 h-11 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              {t("Open job details", "Abrir detalles", "Open klusdetails")}
            </button>
            <button
              onClick={() => {
                setWorkerPickerRepairId(null);
              }}
              className="w-full mt-4 h-11 rounded-xl text-sm font-medium text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all"
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

const STATUS_COLOR: Record<string, string> = {
  todo: "bg-white/20",
  new: "bg-white/20",
  scheduled: "bg-white/20",
  in_progress: "bg-sky-400",
  in_inspection: "bg-sky-400",
  waiting_parts: "bg-amber-400",
  waiting_customer: "bg-amber-400",
  blocked: "bg-red-400",
  ready_for_check: "bg-violet-400",
  completed: "bg-emerald-400",
  invoiced: "bg-emerald-400",
};

function JobCard({
  repair,
  t,
  activeTimers,
  quickUsers,
  timerStartAllowed,
  pauseDisabled,
  onMainTap,
  onPauseUser,
  onQuickStart,
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers: ActiveTimerItem[];
  quickUsers: { id: string; name: string | null; role: string | null }[];
  timerStartAllowed: boolean;
  pauseDisabled: boolean;
  onMainTap: () => void;
  onPauseUser: (userId: string) => void;
  onQuickStart: (userId: string) => void;
}) {
  const hasTimer = activeTimers.length > 0;
  const hasFooter = activeTimers.length > 0 || quickUsers.length > 0;
  const progress = repair.tasks.total > 0 ? (repair.tasks.done / repair.tasks.total) * 100 : 0;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        hasTimer
          ? "bg-sky-400/[0.06] border-sky-400/20"
          : "bg-white/[0.03] border-white/[0.06]"
      }`}
    >
      <button
        type="button"
        onClick={onMainTap}
        className={`group block w-full text-left active:scale-[0.99] transition-transform ${
          hasFooter ? "rounded-t-2xl" : "rounded-2xl"
        }`}
      >
        <div className="p-4 pb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_COLOR[repair.status] || "bg-white/20"}`} />
            <span className="text-lg font-bold text-white tracking-tight font-mono">
              {repair.unitRegistration || repair.publicCode || "—"}
            </span>
            {repair.priority === "urgent" && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-2 py-0.5 rounded-md">
                {t("Urgent", "Urgente", "Spoed")}
              </span>
            )}
            {repair.priority === "high" && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                {t("High", "Alta", "Hoog")}
              </span>
            )}
            {hasTimer && (
              <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <Timer className="h-4 w-4" />
              </span>
            )}
            {repair.garageAdminMessage && !repair.garageAdminMessageReadAt && (
              <span className="flex items-center text-sky-400">
                <MessageSquare className="h-4 w-4" />
              </span>
            )}
            <ChevronRight className="h-5 w-5 text-white/15 ml-auto shrink-0 group-hover:text-white/30 transition-colors" />
          </div>

          {!timerStartAllowed && (
            <p className="text-xs text-amber-400/90 font-medium mb-2">
              {t("Open job to set active before starting a timer", "Abre el trabajo para activarlo antes del temporizador", "Open de klus om op Actief te zetten voor een timer")}
            </p>
          )}

          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm text-white/50 truncate">
              {repair.customerName || t("No customer", "Sin cliente", "Geen klant")}
            </span>
            {repair.unitBrand && (
              <span className="text-xs text-white/20">· {repair.unitBrand} {repair.unitModel}</span>
            )}
          </div>

          {(repair.unitStorageLocation || repair.unitCurrentPosition) && (
            <p className="text-sm text-white/35 truncate mb-2">
              📍 {repair.unitStorageLocation || t("Unknown location", "Ubicación desconocida", "Onbekende locatie")}
              {repair.unitCurrentPosition ? ` · ${repair.unitCurrentPosition}` : ""}
            </p>
          )}

          {repair.title && <p className="text-sm text-white/25 truncate mb-2.5">{repair.title}</p>}
          {!repair.title && <div className="mb-1.5" />}

          <div className="flex items-center gap-3 flex-wrap">
            {repair.tasks.total > 0 && (
              <div className="flex-1 min-w-[120px] flex items-center gap-2">
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-white/30 tabular-nums font-medium shrink-0">{repair.tasks.done}/{repair.tasks.total}</span>
              </div>
            )}
            {repair.parts.pending > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                <Package className="h-4 w-4" />{repair.parts.pending}
              </span>
            )}
            {repair.tasks.problem > 0 && (
              <span className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                <AlertTriangle className="h-4 w-4" />{repair.tasks.problem}
              </span>
            )}
            {repair.workers.length > 0 && (
              <div className="flex -space-x-2">
                {repair.workers.slice(0, 3).map((w, i) => (
                  <div key={i} className="h-8 w-8 rounded-full bg-white/10 border-2 border-gray-950 flex items-center justify-center text-xs font-bold text-white/50">
                    {w.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            {repair.totalMinutes > 0 && (
              <span className="flex items-center gap-1 text-xs text-white/30 font-semibold tabular-nums">
                <Clock className="h-4 w-4" />
                {Math.floor(repair.totalMinutes / 60) > 0
                  ? `${Math.floor(repair.totalMinutes / 60)}h ${repair.totalMinutes % 60}m`
                  : `${repair.totalMinutes}m`}
              </span>
            )}
          </div>
        </div>
      </button>

      {activeTimers.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-white/35 font-bold">
            {t("Pause timer (saved on this repair)", "Pausar (guardado en esta reparación)", "Timer pauzeren (opgeslagen op klus)")}
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            {activeTimers.map((at) => (
              <button
                key={at.id}
                type="button"
                disabled={pauseDisabled}
                onClick={() => onPauseUser(at.userId)}
                className="flex-1 min-h-[52px] flex items-center justify-center gap-3 rounded-xl bg-red-500/15 border border-red-500/25 px-4 text-base font-semibold text-red-300 active:bg-red-500/25 disabled:opacity-50"
              >
                <Pause className="h-5 w-5 shrink-0" />
                <span className="truncate">{at.userName?.split(" ")[0] ?? "?"}</span>
                <OverviewTimerElapsed startedAt={at.startedAt} />
              </button>
            ))}
          </div>
        </div>
      )}

      {quickUsers.length > 0 && (
        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
          <span className="text-[11px] uppercase tracking-wide text-white/35 font-bold">
            {t("Start timer", "Iniciar temporizador", "Timer starten")}
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {quickUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onQuickStart(user.id)}
                className={`w-full inline-flex items-center justify-center gap-2 min-h-[52px] px-3 rounded-xl border text-base font-bold transition-all active:scale-[0.97] ${
                  timerStartAllowed
                    ? "bg-sky-500/15 border-sky-400/30 text-sky-200 hover:bg-sky-500/25"
                    : "bg-white/[0.04] border-white/[0.08] text-white/25"
                }`}
                title={
                  timerStartAllowed
                    ? `${t("Start timer for", "Iniciar temporizador para", "Start timer voor")} ${user.name ?? ""}`
                    : garageTimerBlockedReason(repair.status, t)
                }
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm">
                  {(user.name ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[100px] truncate text-sm font-semibold">{user.name?.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
      setLabel(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <span className="tabular-nums font-mono text-white/80 text-base">{label}</span>;
}

/* ═════════════════════════════════════ */

function EmptyState({ t, stats, onRefresh, refreshing }: { t: (en: string, es?: string | null, nl?: string | null) => string; stats: QuickStats; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center mb-4">
        <Wrench className="h-7 w-7 text-white/20" />
      </div>
      <h2 className="text-lg font-semibold text-white/90 mb-1">
        {t("No work scheduled", "Sin trabajos programados", "Geen werk gepland")}
      </h2>
      <p className="text-sm text-white/30 mb-6 max-w-xs">
        {stats.tomorrowCount > 0
          ? t(
              `${stats.tomorrowCount} job${stats.tomorrowCount > 1 ? "s" : ""} scheduled for tomorrow`,
              `${stats.tomorrowCount} trabajo${stats.tomorrowCount > 1 ? "s" : ""} programado${stats.tomorrowCount > 1 ? "s" : ""} para mañana`,
              `${stats.tomorrowCount} klus${stats.tomorrowCount > 1 ? "sen" : ""} gepland voor morgen`
            )
          : t("Check back later", "Vuelve más tarde", "Kom later terug")}
      </p>
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium active:scale-95 transition-all"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {t("Refresh", "Actualizar", "Vernieuwen")}
      </button>
      {(stats.waitingPartsCount > 0 || stats.urgentCount > 0) && (
        <div className="flex gap-4 mt-8">
          {stats.urgentCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.urgentCount} {t("urgent", "urgente", "spoed")}
            </div>
          )}
          {stats.waitingPartsCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Package className="h-3.5 w-3.5" />
              {stats.waitingPartsCount} {t("waiting parts", "esperando piezas", "wachten op onderdelen")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
