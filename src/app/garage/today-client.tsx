"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { LanguageBar, useLanguage } from "@/components/garage/language-toggle";
import { garageLock } from "@/actions/garage-auth";
import {
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  Search as SearchIcon,
  CircleCheck,
  Zap,
  Clock,
  Package,
  Lock,
} from "lucide-react";
import Link from "next/link";

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

// ─── Status categories ───
type StatusCategory = "todo" | "in_progress" | "waiting" | "check" | "done";

function categorize(r: RepairItem): StatusCategory {
  if (
    (r.status === "completed" && r.finalCheckStatus !== "pending") ||
    r.status === "invoiced"
  )
    return "done";
  if (r.status === "ready_for_check") return "check";
  if (r.status === "completed" && r.finalCheckStatus === "pending")
    return "check";
  if (["waiting_customer", "waiting_parts", "blocked"].includes(r.status))
    return "waiting";
  if (r.status === "in_progress") return "in_progress";
  return "todo";
}

const STATUS_PILL: Record<StatusCategory, { cls: string }> = {
  todo: { cls: "bg-gray-100 text-gray-600" },
  in_progress: { cls: "bg-sky-50 text-sky-700" },
  waiting: { cls: "bg-amber-50 text-amber-700" },
  check: { cls: "bg-emerald-50 text-emerald-700" },
  done: { cls: "bg-emerald-50 text-emerald-600" },
};

// ─── Main component ───

export function GarageTodayClient({
  repairs,
  userName,
  stats,
  activeTimers = [],
}: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [time, setTime] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [activeFilter, setActiveFilter] = useState<StatusCategory | null>(null);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
      setLastRefresh(new Date());
    }, 30000);
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
    setLastRefresh(new Date());
    setTimeout(() => setRefreshing(false), 800);
  }

  // ─── Date / time ───
  const dateLocale =
    lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB";
  const formattedDate = time.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const displayDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  const clock = time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const firstName = userName.split(" ")[0];
  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return t("Good morning", "Buenos días", "Goedemorgen");
    if (h < 18) return t("Good afternoon", "Buenas tardes", "Goedemiddag");
    return t("Good evening", "Buenas noches", "Goedenavond");
  })();

  // ─── Group repairs ───
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
    if (!activeFilter) {
      return [
        ...grouped.in_progress,
        ...grouped.todo,
        ...grouped.check,
        ...grouped.waiting,
        ...grouped.done,
      ];
    }
    return grouped[activeFilter];
  }, [activeFilter, grouped]);

  const hasRepairs = repairs.length > 0;

  // ─── Filter pills ───
  const filterPills: {
    key: StatusCategory;
    label: string;
    count: number;
    icon: React.ReactNode;
  }[] = [
    {
      key: "todo",
      label: t("To Do", "Pendiente", "Te doen"),
      count: counts.todo,
      icon: <ClipboardCheck className="h-3 w-3" />,
    },
    {
      key: "in_progress",
      label: t("Working", "En progreso", "Bezig"),
      count: counts.in_progress,
      icon: <Wrench className="h-3 w-3" />,
    },
    {
      key: "waiting",
      label: t("Waiting", "Esperando", "Wachten"),
      count: counts.waiting,
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    {
      key: "check",
      label: t("Check", "Revisión", "Controle"),
      count: counts.check,
      icon: <SearchIcon className="h-3 w-3" />,
    },
    {
      key: "done",
      label: t("Done", "Hecho", "Klaar"),
      count: counts.done,
      icon: <CircleCheck className="h-3 w-3" />,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          {/* Language bar */}
          <div className="pt-5 pb-3">
            <LanguageBar />
          </div>

          <div className="flex items-center justify-between pb-5">
            <div>
              <p className="text-xs text-gray-400 font-medium">
                {greeting}, {firstName}
              </p>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight mt-0.5">
                {displayDate}
              </h1>
              <p className="text-xs text-gray-300 font-medium tabular-nums mt-0.5">
                {clock}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleRefresh}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
                title={t("Refresh", "Actualizar", "Vernieuwen")}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={async () => { await garageLock(); router.refresh(); }}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all duration-150"
                title={t("Lock Garage", "Bloquear garaje", "Garage vergrendelen")}
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN ─── */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-5 sm:px-8 py-5">
        {hasRepairs ? (
          <div className="space-y-4">
            {/* Status filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {filterPills.map((pill) => {
                const isActive = activeFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    onClick={() => setActiveFilter(isActive ? null : pill.key)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {pill.icon}
                    {pill.label}
                    {pill.count > 0 && (
                      <span className={`text-[10px] font-bold tabular-nums ml-0.5 ${
                        isActive ? "text-white/70" : "text-gray-400"
                      }`}>
                        {pill.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active filter label */}
            {activeFilter && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {filterPills.find((p) => p.key === activeFilter)?.label}
                </p>
                <button
                  onClick={() => setActiveFilter(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  {t("Show all", "Mostrar todo", "Alles tonen")}
                </button>
              </div>
            )}

            {/* Job list */}
            {displayRepairs.length > 0 ? (
              <div className="space-y-2">
                {displayRepairs.map((repair) => (
                  <JobCard
                    key={repair.id}
                    repair={repair}
                    t={t}
                    activeTimers={activeTimers.filter(
                      (at) => at.repairJobId === repair.id
                    )}
                  />
                ))}
              </div>
            ) : activeFilter ? (
              <div className="bg-white rounded-2xl border border-gray-100 px-6 py-10 text-center">
                <p className="text-sm text-gray-400">
                  {t(
                    "No jobs in this category",
                    "No hay trabajos en esta categoría",
                    "Geen klussen in deze categorie"
                  )}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            t={t}
            stats={stats}
            handleRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}

        {/* Last updated */}
        <div className="flex items-center justify-center gap-1.5 pt-6 pb-2">
          <Clock className="h-3 w-3 text-gray-300" />
          <p className="text-[10px] text-gray-300 tabular-nums">
            {t("Last updated", "Última actualización", "Laatste update")}:{" "}
            {lastRefresh.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════

function EmptyState({
  t,
  stats,
  handleRefresh,
  refreshing,
}: {
  t: (en: string, es?: string | null, nl?: string | null) => string;
  stats: QuickStats;
  handleRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Urgency alert */}
      {stats.urgentCount > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200/60 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {t(
                  `${stats.urgentCount} urgent job${stats.urgentCount > 1 ? "s" : ""} pending`,
                  `${stats.urgentCount} trabajo${stats.urgentCount > 1 ? "s" : ""} urgente${stats.urgentCount > 1 ? "s" : ""}`,
                  `${stats.urgentCount} spoedklus${stats.urgentCount > 1 ? "sen" : ""} openstaand`
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <CircleCheck className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-base font-bold text-gray-900">
          {t(
            "No work scheduled today",
            "Sin trabajo planificado hoy",
            "Geen werk gepland vandaag"
          )}
        </h2>
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
          {stats.tomorrowCount > 0
            ? t(
                `Tomorrow has ${stats.tomorrowCount} job${stats.tomorrowCount > 1 ? "s" : ""} planned`,
                `Mañana hay ${stats.tomorrowCount} trabajo${stats.tomorrowCount > 1 ? "s" : ""}`,
                `Morgen ${stats.tomorrowCount} klus${stats.tomorrowCount > 1 ? "sen" : ""} gepland`
              )
            : t(
                "New tasks appear automatically",
                "Las nuevas tareas aparecen automáticamente",
                "Nieuwe taken verschijnen automatisch"
              )}
        </p>
        <button
          onClick={handleRefresh}
          className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gray-900 text-white text-sm font-medium active:scale-[0.97] transition-all duration-150"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {t("Check for new tasks", "Buscar nuevas tareas", "Nieuwe taken ophalen")}
        </button>
      </div>

      {/* Compact stats row */}
      <div className="flex gap-2">
        {[
          {
            icon: <Package className="h-3.5 w-3.5 text-purple-400" />,
            label: t("Waiting parts", "Esperando piezas", "Wacht op onderdelen"),
            value: stats.waitingPartsCount,
          },
          {
            icon: <Zap className="h-3.5 w-3.5 text-amber-500" />,
            label: t("Urgent", "Urgente", "Spoed"),
            value: stats.urgentCount,
            highlight: stats.urgentCount > 0,
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex-1 rounded-xl border px-3 py-3 ${
              item.highlight
                ? "bg-amber-50/50 border-amber-200"
                : "bg-white border-gray-100"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {item.icon}
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {item.label}
              </span>
            </div>
            <p className={`text-lg font-bold tabular-nums ${
              item.highlight ? "text-amber-600" : "text-gray-900"
            }`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// JOB CARD
// ══════════════════════════════════════════════════

function JobCard({
  repair,
  t,
  activeTimers = [],
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers?: ActiveTimerItem[];
}) {
  const category = categorize(repair);
  const status = STATUS_PILL[category];
  const unitLine = [repair.unitBrand, repair.unitModel].filter(Boolean).join(" ");
  const displayTitle = repair.title || unitLine || repair.publicCode || "—";
  const isUrgent = repair.priority === "urgent" || repair.priority === "high";
  const hasTasks = repair.tasks.total > 0;
  const progress = hasTasks
    ? Math.round((repair.tasks.done / repair.tasks.total) * 100)
    : 0;

  const statusLabel = (() => {
    const m: Record<StatusCategory, string> = {
      todo: t("To Do", "Pendiente", "Te doen"),
      in_progress: t("Working", "En progreso", "Bezig"),
      waiting: t("Waiting", "Esperando", "Wachten"),
      check: t("Check", "Revisión", "Controle"),
      done: t("Done", "Hecho", "Klaar"),
    };
    return m[category];
  })();

  return (
    <Link href={`/garage/repairs/${repair.id}`} className="block">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 hover:border-gray-200 active:scale-[0.99] transition-all duration-150">
        {/* Top: title + chevron */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {displayTitle}
              </p>
              {isUrgent && (
                <span className="inline-flex items-center gap-0.5 rounded-md bg-red-50 text-red-600 px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                  <Zap className="h-2.5 w-2.5" />
                  {repair.priority === "urgent"
                    ? t("Urgent", "Urgente", "Spoed")
                    : t("High", "Alta", "Hoog")}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {[repair.customerName, repair.unitRegistration].filter(Boolean).join(" · ")}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
        </div>

        {/* Bottom: pills row */}
        <div className="flex items-center gap-1.5 mt-2.5">
          {/* Status pill */}
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
            {statusLabel}
          </span>

          {/* Task progress */}
          {hasTasks && (
            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 text-gray-500 px-2 py-0.5 text-[10px] font-medium">
              <Wrench className="h-2.5 w-2.5" />
              {repair.tasks.done}/{repair.tasks.total}
            </span>
          )}

          {/* Parts pending */}
          {repair.parts.pending > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 text-purple-600 px-2 py-0.5 text-[10px] font-medium">
              <Package className="h-2.5 w-2.5" />
              {repair.parts.pending}
            </span>
          )}

          {/* Problems */}
          {repair.tasks.problem > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-medium">
              <AlertTriangle className="h-2.5 w-2.5" />
              {repair.tasks.problem}
            </span>
          )}

          {/* Active timer */}
          {activeTimers.length > 0 && (
            <span className="inline-flex items-center gap-1 ml-auto">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">
                {activeTimers
                  .map((at) => (at.userName ?? "?").split(" ")[0])
                  .join(", ")}
              </span>
            </span>
          )}
        </div>

        {/* Progress bar for in-progress with tasks */}
        {category === "in_progress" && hasTasks && (
          <div className="mt-2.5">
            <div className="h-1 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-400 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
