"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { garageLock } from "@/actions/garage-auth";
import {
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  CircleCheck,
  Clock,
  Package,
  Lock,
  Search,
  Timer,
} from "lucide-react";
import Link from "next/link";

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

export function GarageTodayClient({ repairs, userName, stats, activeTimers = [] }: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [time, setTime] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusCategory | "all">("all");

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  function handleRefresh() {
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
    if (activeTab === "all") {
      return [...grouped.in_progress, ...grouped.todo, ...grouped.check, ...grouped.waiting, ...grouped.done];
    }
    return grouped[activeTab];
  }, [activeTab, grouped]);

  const tabs: { key: StatusCategory | "all"; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "all", label: t("All", "Todo", "Alles"), count: repairs.length, icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "in_progress", label: t("Active", "Activo", "Actief"), count: counts.in_progress, icon: <Wrench className="h-4 w-4" /> },
    { key: "waiting", label: t("Waiting", "Espera", "Wachten"), count: counts.waiting, icon: <AlertTriangle className="h-4 w-4" /> },
    { key: "check", label: t("Check", "Control", "Check"), count: counts.check, icon: <Search className="h-4 w-4" /> },
    { key: "done", label: t("Done", "Hecho", "Klaar"), count: counts.done, icon: <CircleCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100 safe-area-pt">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{formattedDate}</p>
              <p className="text-[11px] text-gray-400 tabular-nums">{clock}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={async () => { await garageLock(); router.refresh(); }}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 active:scale-95 transition-all"
            >
              <Lock className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Tab bar ─── */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                    active
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                      active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
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
            <p className="text-sm text-gray-400">{t("No jobs in this category", "Sin trabajos", "Geen klussen")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayRepairs.map((repair) => (
              <JobCard
                key={repair.id}
                repair={repair}
                t={t}
                activeTimers={activeTimers.filter((at) => at.repairJobId === repair.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ═════════════════════════════════════
   JOB CARD
   ═════════════════════════════════════ */

const STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-400",
  new: "bg-gray-400",
  scheduled: "bg-gray-400",
  in_progress: "bg-sky-500",
  in_inspection: "bg-sky-500",
  waiting_parts: "bg-amber-500",
  waiting_customer: "bg-amber-500",
  blocked: "bg-red-500",
  ready_for_check: "bg-violet-500",
  completed: "bg-emerald-500",
  invoiced: "bg-emerald-500",
};

function JobCard({
  repair,
  t,
  activeTimers,
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers: ActiveTimerItem[];
}) {
  const hasTimer = activeTimers.length > 0;
  const progress = repair.tasks.total > 0 ? (repair.tasks.done / repair.tasks.total) * 100 : 0;

  return (
    <Link
      href={`/garage/repairs/${repair.id}`}
      className={`group block bg-white rounded-2xl border transition-all active:scale-[0.98] ${
        hasTimer
          ? "border-sky-200 shadow-[0_0_0_1px_rgba(14,165,233,0.15)]"
          : "border-gray-100 shadow-sm hover:shadow-md"
      }`}
    >
      <div className="p-4">
        {/* Row 1: Registration + Priority + Timer */}
        <div className="flex items-center gap-3 mb-2">
          <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLOR[repair.status] || "bg-gray-400"}`} />
          <span className="text-base font-bold text-gray-900 tracking-tight font-mono">
            {repair.unitRegistration || repair.publicCode || "—"}
          </span>
          {repair.priority === "urgent" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              {t("Urgent", "Urgente", "Spoed")}
            </span>
          )}
          {repair.priority === "high" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              {t("High", "Alta", "Hoog")}
            </span>
          )}
          {hasTimer && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-sky-600">
              <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <Timer className="h-3 w-3" />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300 ml-auto shrink-0 group-hover:text-gray-500 transition-colors" />
        </div>

        {/* Row 2: Customer + Unit */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-500 truncate">
            {repair.customerName || t("No customer", "Sin cliente", "Geen klant")}
          </span>
          {repair.unitBrand && (
            <span className="text-xs text-gray-300">
              · {repair.unitBrand} {repair.unitModel}
            </span>
          )}
        </div>

        {/* Row 3: Progress + Indicators */}
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          {repair.tasks.total > 0 && (
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums font-medium shrink-0">
                {repair.tasks.done}/{repair.tasks.total}
              </span>
            </div>
          )}

          {/* Parts indicator */}
          {repair.parts.pending > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
              <Package className="h-3 w-3" />
              {repair.parts.pending}
            </span>
          )}

          {/* Problem indicator */}
          {repair.tasks.problem > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-500 font-medium">
              <AlertTriangle className="h-3 w-3" />
              {repair.tasks.problem}
            </span>
          )}

          {/* Workers */}
          {repair.workers.length > 0 && (
            <div className="flex -space-x-1.5">
              {repair.workers.slice(0, 3).map((w, i) => (
                <div
                  key={i}
                  className="h-6 w-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-gray-500"
                >
                  {w.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ═════════════════════════════════════
   EMPTY STATE
   ═════════════════════════════════════ */

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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Wrench className="h-7 w-7 text-gray-300" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        {t("No work scheduled", "Sin trabajos programados", "Geen werk gepland")}
      </h2>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
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
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gray-900 text-white text-sm font-medium active:scale-95 transition-all"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {t("Refresh", "Actualizar", "Vernieuwen")}
      </button>

      {/* Quick stats */}
      {(stats.waitingPartsCount > 0 || stats.urgentCount > 0) && (
        <div className="flex gap-4 mt-8">
          {stats.urgentCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              {stats.urgentCount} {t("urgent", "urgente", "spoed")}
            </div>
          )}
          {stats.waitingPartsCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-500">
              <Package className="h-3.5 w-3.5" />
              {stats.waitingPartsCount} {t("waiting parts", "esperando piezas", "wachten op onderdelen")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
