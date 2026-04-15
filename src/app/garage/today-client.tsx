"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { WeatherWidget } from "@/components/garage/weather-widget";
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
  CalendarDays,
  Truck,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

// ─── Job type badge config ───
const JOB_TYPE_CONFIG: Record<
  string,
  { label: [string, string, string]; cls: string }
> = {
  repair: {
    label: ["Repair", "Reparación", "Reparatie"],
    cls: "bg-slate-100 text-slate-700",
  },
  wax: {
    label: ["Wax", "Cera", "Wax"],
    cls: "bg-amber-50 text-amber-700",
  },
  maintenance: {
    label: ["Maintenance", "Mantenimiento", "Onderhoud"],
    cls: "bg-sky-50 text-sky-700",
  },
  inspection: {
    label: ["Inspection", "Inspección", "Inspectie"],
    cls: "bg-emerald-50 text-emerald-700",
  },
};

// ─── Status category definitions ───
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

  // Live clock — update every 30s
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

  // ─── Date formatting ───
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

  // ─── Greeting ───
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

  const hasRepairs = repairs.length > 0;

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

  const urgentCount = repairs.filter(
    (r) => r.priority === "urgent" || r.priority === "high"
  ).length;
  const problemCount = repairs.reduce((sum, r) => sum + r.tasks.problem, 0);

  // Top jobs for "quick start" section
  const topJobs = useMemo(() => {
    return [...grouped.in_progress, ...grouped.todo].slice(0, 3);
  }, [grouped]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* ─── HEADER ─── */}
      <header className="px-5 sm:px-8 pt-8 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0">
                <Truck className="h-6 w-6 text-[#0CC0DF]" />
              </div>
              <div>
                <p className="text-[13px] text-gray-400 font-medium leading-snug">
                  {greeting}, {firstName}
                </p>
                <h1 className="text-[26px] sm:text-[32px] font-bold text-gray-900 tracking-tight leading-tight mt-0.5">
                  {displayDate}
                </h1>
                <p className="text-sm text-gray-300 font-semibold tabular-nums mt-1">
                  {clock}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <LanguageToggle />
              <button
                onClick={handleRefresh}
                className="h-11 w-11 flex items-center justify-center rounded-2xl text-gray-400 active:bg-gray-100 transition-all duration-150"
                title={t("Refresh", "Actualizar", "Vernieuwen")}
              >
                <RefreshCw
                  className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={async () => { await garageLock(); router.refresh(); }}
                className="h-11 w-11 flex items-center justify-center rounded-full text-sm font-bold bg-white text-gray-500 border border-gray-100 shadow-sm active:bg-gray-100 transition-all duration-150"
                title={t("Lock Garage", "Bloquear garaje", "Garage vergrendelen")}
              >
                {firstName.charAt(0).toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1">
        {hasRepairs ? (
          <WorkState
            counts={counts}
            displayRepairs={displayRepairs}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            urgentCount={urgentCount}
            problemCount={problemCount}
            t={t}
            activeTimers={activeTimers}
            topJobs={topJobs}
            lastRefresh={lastRefresh}
            handleRefresh={handleRefresh}
            refreshing={refreshing}
          />
        ) : (
          <EmptyState
            t={t}
            stats={stats}
            handleRefresh={handleRefresh}
            refreshing={refreshing}
            lastRefresh={lastRefresh}
          />
        )}
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
  lastRefresh,
}: {
  t: (en: string, es?: string | null, nl?: string | null) => string;
  stats: QuickStats;
  handleRefresh: () => void;
  refreshing: boolean;
  lastRefresh: Date;
}) {
  return (
    <div className="max-w-lg mx-auto px-5 pb-10 space-y-5 pt-2">
      {/* ── Urgency alert ── */}
      {stats.urgentCount > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200/60 px-5 py-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-amber-900">
                {t(
                  "Pending jobs need attention",
                  "Trabajos pendientes necesitan atención",
                  "Openstaande klussen vereisen aandacht"
                )}
              </p>
              <p className="text-sm text-amber-700/80 mt-0.5">
                {t(
                  `${stats.urgentCount} urgent — not scheduled for today`,
                  `${stats.urgentCount} urgente${stats.urgentCount > 1 ? "s" : ""} — no planificado para hoy`,
                  `${stats.urgentCount} spoed — niet ingepland voor vandaag`
                )}
              </p>
              <button
                onClick={handleRefresh}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800 active:bg-amber-200 active:scale-[0.97] transition-all"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                {t("View now", "Ver ahora", "Bekijk nu")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Calm empty state ── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CircleCheck className="h-7 w-7 text-emerald-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">
          {t(
            "No work scheduled today",
            "Sin trabajo planificado hoy",
            "Geen werk gepland vandaag"
          )}
        </h2>
        <p className="text-sm text-gray-400 mt-1.5 max-w-xs mx-auto">
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
      </div>

      {/* ── Primary action ── */}
      <button
        onClick={handleRefresh}
        className="flex items-center justify-center gap-3 w-full h-14 rounded-2xl bg-[#0CC0DF] text-white text-base font-bold shadow-sm active:scale-[0.98] transition-all duration-150"
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
        />
        {t(
          "Check for new tasks",
          "Buscar nuevas tareas",
          "Nieuwe taken ophalen"
        )}
      </button>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<Wrench className="h-5 w-5 text-gray-400" />}
          label={t("Today", "Hoy", "Vandaag")}
          value="0"
          sub={t("jobs", "trabajos", "klussen")}
          tint="bg-white"
        />
        <KpiCard
          icon={<CalendarDays className="h-5 w-5 text-sky-400" />}
          label={t("Tomorrow", "Mañana", "Morgen")}
          value={String(stats.tomorrowCount)}
          sub={t("planned", "planificados", "gepland")}
          tint="bg-sky-50/40"
        />
        <KpiCard
          icon={<Package className="h-5 w-5 text-purple-400" />}
          label={t("Waiting parts", "Esperando piezas", "Wacht op onderdelen")}
          value={String(stats.waitingPartsCount)}
          tint="bg-purple-50/40"
        />
        <KpiCard
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          label={t("Urgent", "Urgente", "Spoed")}
          value={String(stats.urgentCount)}
          tint={
            stats.urgentCount > 0
              ? "bg-amber-50/60 border-amber-200"
              : "bg-white"
          }
          highlight={stats.urgentCount > 0}
        />
      </div>

      {/* ── Last updated ── */}
      <LastUpdated t={t} lastRefresh={lastRefresh} />

      {/* ── Weather ── */}
      <div className="mx-auto max-w-sm pt-2">
        <WeatherWidget />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// WORK STATE
// ══════════════════════════════════════════════════

function WorkState({
  counts,
  displayRepairs,
  activeFilter,
  setActiveFilter,
  urgentCount,
  problemCount,
  t,
  activeTimers = [],
  topJobs,
  lastRefresh,
  handleRefresh,
  refreshing,
}: {
  counts: Record<StatusCategory, number>;
  displayRepairs: RepairItem[];
  activeFilter: StatusCategory | null;
  setActiveFilter: (f: StatusCategory | null) => void;
  urgentCount: number;
  problemCount: number;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers?: ActiveTimerItem[];
  topJobs: RepairItem[];
  lastRefresh: Date;
  handleRefresh: () => void;
  refreshing: boolean;
}) {
  const summaryCards: {
    key: StatusCategory;
    label: string;
    count: number;
    tint: string;
    activeTint: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "todo",
      label: t("To Do", "Por hacer", "Te doen"),
      count: counts.todo,
      tint: "bg-white",
      activeTint: "ring-2 ring-gray-300 bg-gray-50/80",
      icon: <ClipboardCheck className="h-5 w-5 text-gray-400" />,
    },
    {
      key: "in_progress",
      label: t("Working", "En progreso", "Bezig"),
      count: counts.in_progress,
      tint: "bg-sky-50/40",
      activeTint: "ring-2 ring-sky-300 bg-sky-50",
      icon: <Wrench className="h-5 w-5 text-sky-500" />,
    },
    {
      key: "waiting",
      label: t("Waiting", "Esperando", "Wachten"),
      count: counts.waiting,
      tint: "bg-amber-50/40",
      activeTint: "ring-2 ring-amber-300 bg-amber-50",
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    },
    {
      key: "check",
      label: t("Check", "Control", "Controle"),
      count: counts.check,
      tint: "bg-emerald-50/40",
      activeTint: "ring-2 ring-emerald-300 bg-emerald-50",
      icon: <SearchIcon className="h-5 w-5 text-emerald-500" />,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 pb-10 space-y-5">
      {/* ── Urgency alert ── */}
      {(urgentCount > 0 || problemCount > 0) && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex gap-4 text-sm font-bold">
                {urgentCount > 0 && (
                  <span className="text-red-700">
                    {urgentCount} {t("urgent", "urgente", "spoed")}
                  </span>
                )}
                {problemCount > 0 && (
                  <span className="text-orange-700">
                    {problemCount} {t("problems", "problemas", "problemen")}
                  </span>
                )}
              </div>
              <p className="text-xs text-red-600/60 mt-0.5">
                {t(
                  "Need immediate attention",
                  "Necesitan atención inmediata",
                  "Vereist directe aandacht"
                )}
              </p>
            </div>
            <button
              onClick={() =>
                setActiveFilter(activeFilter === "todo" ? null : "todo")
              }
              className="shrink-0 rounded-xl bg-red-100 px-3.5 py-2 text-xs font-bold text-red-700 active:bg-red-200 active:scale-[0.97] transition-all"
            >
              {t("View", "Ver", "Bekijk")}
            </button>
          </div>
        </div>
      )}

      {/* ── Quick start — top 3 jobs ── */}
      {!activeFilter && topJobs.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2.5">
            {t("Start today", "Empezar hoy", "Vandaag starten")}
          </p>
          <div className="space-y-2">
            {topJobs.map((job) => (
              <QuickStartCard key={job.id} repair={job} t={t} />
            ))}
          </div>
        </div>
      )}

      {/* ── KPI filter cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            onClick={() =>
              setActiveFilter(activeFilter === card.key ? null : card.key)
            }
            className={`rounded-2xl border border-gray-100 shadow-sm p-4 text-left transition-all duration-150 active:scale-[0.96] ${
              activeFilter === card.key
                ? card.activeTint
                : `${card.tint} hover:shadow-md`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              {card.icon}
              {card.count > 0 && (
                <span className="text-2xl font-bold tabular-nums text-gray-900 leading-none">
                  {card.count}
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              {card.label}
            </p>
          </button>
        ))}
      </div>

      {/* ── Done count ── */}
      {counts.done > 0 && (
        <button
          onClick={() =>
            setActiveFilter(activeFilter === "done" ? null : "done")
          }
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98] ${
            activeFilter === "done"
              ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-white"
          }`}
        >
          <CircleCheck className="h-4 w-4" />
          {counts.done} {t("completed", "completados", "afgerond")}
        </button>
      )}

      {/* ── Filter label ── */}
      {activeFilter && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {activeFilter === "done"
              ? t("Completed", "Completados", "Afgerond")
              : (summaryCards.find((c) => c.key === activeFilter)?.label ?? "")}
          </p>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-[#0CC0DF] font-semibold active:opacity-70 transition-opacity"
          >
            {t("Show all", "Mostrar todo", "Alles tonen")}
          </button>
        </div>
      )}

      {/* ── Job cards ── */}
      <div className="space-y-3">
        {displayRepairs.map((repair) => (
          <WorkCard
            key={repair.id}
            repair={repair}
            t={t}
            activeTimers={activeTimers.filter(
              (at) => at.repairJobId === repair.id
            )}
          />
        ))}
      </div>

      {/* ── Last updated ── */}
      <LastUpdated t={t} lastRefresh={lastRefresh} />

      {/* ── Weather ── */}
      <div className="pt-2">
        <WeatherWidget />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// QUICK START CARD — mini card for top jobs
// ══════════════════════════════════════════════════

function QuickStartCard({
  repair,
  t,
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
}) {
  const category = categorize(repair);
  const statusConfig: Record<StatusCategory, { label: string; cls: string }> = {
    todo: {
      label: t("To Do", "Por hacer", "Te doen"),
      cls: "bg-gray-100 text-gray-600",
    },
    in_progress: {
      label: t("Working", "En progreso", "Bezig"),
      cls: "bg-sky-50 text-sky-700",
    },
    waiting: {
      label: t("Waiting", "Esperando", "Wachten"),
      cls: "bg-amber-50 text-amber-700",
    },
    check: {
      label: t("Check", "Control", "Controle"),
      cls: "bg-emerald-50 text-emerald-700",
    },
    done: {
      label: t("Done", "Completado", "Klaar"),
      cls: "bg-emerald-50 text-emerald-600",
    },
  };

  const status = statusConfig[category];
  const unitLine = [repair.unitBrand, repair.unitModel].filter(Boolean).join(" ");
  const displayTitle = repair.title || unitLine || repair.publicCode || "—";

  return (
    <Link href={`/garage/repairs/${repair.id}`} className="block">
      <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 active:scale-[0.99] transition-all duration-200 cursor-pointer">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900 truncate">
            {displayTitle}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {[repair.unitRegistration, repair.customerName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-bold shrink-0 ${status.cls}`}
        >
          {status.label}
        </span>
        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════
// KPI CARD — reusable stat card
// ══════════════════════════════════════════════════

function KpiCard({
  icon,
  label,
  value,
  sub,
  tint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border shadow-sm px-5 py-4 ${tint} ${
        highlight ? "border-amber-200" : "border-gray-100"
      }`}
    >
      <div className="mb-2">{icon}</div>
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums mt-0.5 ${
          highlight ? "text-amber-600" : "text-gray-900"
        }`}
      >
        {value}
        {sub && (
          <span className="text-sm font-medium text-gray-400 ml-1.5">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════
// LAST UPDATED — subtle indicator
// ══════════════════════════════════════════════════

function LastUpdated({
  t,
  lastRefresh,
}: {
  t: (en: string, es?: string | null, nl?: string | null) => string;
  lastRefresh: Date;
}) {
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Clock className="h-3 w-3 text-gray-300" />
      <p className="text-xs text-gray-300 tabular-nums">
        {t("Last updated", "Última actualización", "Laatste update")}:{" "}
        {lastRefresh.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════
// WORK CARD — Premium job card
// ══════════════════════════════════════════════════

function WorkCard({
  repair,
  t,
  activeTimers = [],
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  activeTimers?: ActiveTimerItem[];
}) {
  const category = categorize(repair);
  const progress =
    repair.tasks.total > 0
      ? Math.round((repair.tasks.done / repair.tasks.total) * 100)
      : 0;

  const statusConfig: Record<
    StatusCategory,
    { label: string; cls: string; bar: string }
  > = {
    todo: {
      label: t("To Do", "Por hacer", "Te doen"),
      cls: "bg-gray-100 text-gray-600",
      bar: "bg-gray-400",
    },
    in_progress: {
      label: t("Working", "En progreso", "Bezig"),
      cls: "bg-sky-50 text-sky-700",
      bar: "bg-sky-500",
    },
    waiting: {
      label: t("Waiting", "Esperando", "Wachten"),
      cls: "bg-amber-50 text-amber-700",
      bar: "bg-amber-500",
    },
    check: {
      label: t("Check", "Control", "Controle"),
      cls: "bg-emerald-50 text-emerald-700",
      bar: "bg-emerald-500",
    },
    done: {
      label: t("Done", "Completado", "Klaar"),
      cls: "bg-emerald-50 text-emerald-600",
      bar: "bg-emerald-500",
    },
  };

  const status = statusConfig[category];
  const jobType = JOB_TYPE_CONFIG[repair.jobType];
  const unitLine = [repair.unitBrand, repair.unitModel]
    .filter(Boolean)
    .join(" ");
  const displayTitle = repair.title || unitLine || repair.publicCode || "—";

  const accentColor: Record<StatusCategory, string> = {
    todo: "border-l-gray-300",
    in_progress: "border-l-sky-500",
    waiting: "border-l-amber-400",
    check: "border-l-emerald-500",
    done: "border-l-emerald-300",
  };

  return (
    <Link href={`/garage/repairs/${repair.id}`} className="block">
      <div
        className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${accentColor[category]} shadow-sm active:scale-[0.99] transition-all duration-200 p-5 cursor-pointer`}
      >
        {/* Title + chevron */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold text-gray-900 leading-snug truncate">
              {displayTitle}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5 truncate">
              {[
                repair.unitRegistration,
                repair.customerName,
                repair.unitStorageLocation &&
                  `📍 ${repair.unitStorageLocation}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 shrink-0 mt-1" />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <span
            className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-bold ${status.cls}`}
          >
            {status.label}
          </span>
          {jobType && (
            <span
              className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium ${jobType.cls}`}
            >
              {t(jobType.label[0], jobType.label[1], jobType.label[2])}
            </span>
          )}
          {repair.priority === "urgent" && (
            <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 border border-red-100">
              ⚡ {t("Urgent", "Urgente", "Spoed")}
            </span>
          )}
          {repair.priority === "high" && (
            <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-bold bg-orange-50 text-orange-600">
              {t("High", "Alto", "Hoog")}
            </span>
          )}
          {repair.tasks.problem > 0 && (
            <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 border border-red-100">
              ⚠ {repair.tasks.problem}
            </span>
          )}
          {repair.parts.pending > 0 && (
            <span className="inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-600">
              📦 {repair.parts.received}/{repair.parts.total}
            </span>
          )}
          {activeTimers.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-600">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              ⏱{" "}
              {activeTimers
                .map((t) => (t.userName ?? "?").split(" ")[0])
                .join(", ")}
            </span>
          )}
        </div>

        {/* Progress */}
        {repair.tasks.total > 0 && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400">
                {repair.tasks.done}/{repair.tasks.total}{" "}
                {t("tasks", "tareas", "taken")}
              </span>
              <span
                className={`text-xs font-bold tabular-nums ${
                  progress === 100 ? "text-emerald-600" : "text-gray-400"
                }`}
              >
                {progress}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${status.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Workers */}
        {repair.workers.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-50">
            {repair.workers.slice(0, 4).map((name, i) => (
              <span
                key={i}
                className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-[11px] font-bold text-gray-500"
                title={name}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            ))}
            {repair.workers.length > 4 && (
              <span className="text-xs text-gray-400 font-medium ml-1">
                +{repair.workers.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
