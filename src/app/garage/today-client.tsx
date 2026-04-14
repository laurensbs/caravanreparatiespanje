"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { WeatherWidget } from "@/components/garage/weather-widget";
import { signOut } from "next-auth/react";
import { RefreshCw, ClipboardCheck, ChevronRight, AlertTriangle, Wrench, Search as SearchIcon, CircleCheck } from "lucide-react";
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

interface Props {
  repairs: RepairItem[];
  userName: string;
}

// ─── Job type badge config ───
const JOB_TYPE_CONFIG: Record<string, { label: [string, string, string]; cls: string }> = {
  repair: { label: ["Repair", "Reparación", "Reparatie"], cls: "bg-slate-100 text-slate-700" },
  wax: { label: ["Wax", "Cera", "Wax"], cls: "bg-amber-50 text-amber-700" },
  maintenance: { label: ["Maintenance", "Mantenimiento", "Onderhoud"], cls: "bg-sky-50 text-sky-700" },
  inspection: { label: ["Inspection", "Inspección", "Inspectie"], cls: "bg-emerald-50 text-emerald-700" },
};

// ─── Status category definitions ───
type StatusCategory = "todo" | "in_progress" | "waiting" | "check" | "done";

function categorize(r: RepairItem): StatusCategory {
  if ((r.status === "completed" && r.finalCheckStatus !== "pending") || r.status === "invoiced") return "done";
  if (r.status === "completed" && r.finalCheckStatus === "pending") return "check";
  if (["waiting_customer", "waiting_parts", "blocked"].includes(r.status)) return "waiting";
  if (r.status === "in_progress") return "in_progress";
  return "todo";
}

export function GarageTodayClient({ repairs, userName }: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [time, setTime] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusCategory | null>(null);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Live clock — update every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Manual refresh with animation
  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  // ─── Date formatting ───
  const dateLocale = lang === "es" ? "es-ES" : lang === "nl" ? "nl-NL" : "en-GB";
  const formattedDate = time.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

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
    const map: Record<StatusCategory, RepairItem[]> = { todo: [], in_progress: [], waiting: [], check: [], done: [] };
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

  // Filtered repairs for display
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

  const urgentCount = repairs.filter(r => r.priority === "urgent" || r.priority === "high").length;
  const problemCount = repairs.reduce((sum, r) => sum + r.tasks.problem, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* ─── HEADER ─── */}
      <header className="px-6 sm:px-8 pt-6 pb-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Image src="/favicon.png" alt="Logo" width={44} height={44} className="rounded-xl object-contain shrink-0" />
              <div>
                <p className="text-sm text-gray-500 font-medium">
                  {greeting}, {firstName}
                </p>
                <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mt-1 tracking-tight">
                  {displayDate}
                </h1>
                <p className="text-xl text-gray-400 font-medium tabular-nums mt-0.5">
                  {clock}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <LanguageToggle />
              <button
                onClick={handleRefresh}
                className="h-11 w-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-all duration-150"
                title={t("Refresh", "Actualizar", "Vernieuwen")}
              >
                <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="h-11 w-11 flex items-center justify-center rounded-2xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-all duration-150"
                title={t("Sign out", "Cerrar sesión", "Uitloggen")}
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
          />
        ) : (
          <EmptyState t={t} />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════

function EmptyState({ t }: { t: (en: string, es?: string | null, nl?: string | null) => string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-6">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-6">
        <ClipboardCheck className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 text-center">
        {t("No work today", "Sin trabajo hoy", "Geen werk vandaag")}
      </h2>
      <p className="text-lg text-gray-500 mt-3 text-center max-w-md">
        {t(
          "Nothing is planned for today.",
          "No hay nada planificado para hoy.",
          "Er staat niets gepland voor vandaag."
        )}
      </p>
      <div className="mt-10 space-y-3 max-w-sm w-full">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
          {t(
            "New jobs appear automatically",
            "Los trabajos nuevos aparecen automáticamente",
            "Nieuwe opdrachten verschijnen automatisch"
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
          {t(
            "Use refresh if the schedule just changed",
            "Usa actualizar si el horario acaba de cambiar",
            "Gebruik vernieuwen als de planning net is aangepast"
          )}
        </div>
      </div>
      <div className="mt-12 w-full max-w-sm">
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
}: {
  counts: Record<StatusCategory, number>;
  displayRepairs: RepairItem[];
  activeFilter: StatusCategory | null;
  setActiveFilter: (f: StatusCategory | null) => void;
  urgentCount: number;
  problemCount: number;
  t: (en: string, es?: string | null, nl?: string | null) => string;
}) {
  const summaryCards: { key: StatusCategory; label: string; count: number; color: string; activeColor: string; icon: React.ReactNode }[] = [
    {
      key: "todo",
      label: t("To Do", "Por hacer", "Te doen"),
      count: counts.todo,
      color: "text-gray-600",
      activeColor: "ring-2 ring-gray-300 bg-gray-50",
      icon: <ClipboardCheck className="h-5 w-5 text-gray-400" />,
    },
    {
      key: "in_progress",
      label: t("In Progress", "En progreso", "Bezig"),
      count: counts.in_progress,
      color: "text-sky-600",
      activeColor: "ring-2 ring-sky-300 bg-sky-50",
      icon: <Wrench className="h-5 w-5 text-sky-400" />,
    },
    {
      key: "waiting",
      label: t("Waiting", "Esperando", "Wachten"),
      count: counts.waiting,
      color: "text-amber-600",
      activeColor: "ring-2 ring-amber-300 bg-amber-50",
      icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    },
    {
      key: "check",
      label: t("Final Check", "Control final", "Nacontrole"),
      count: counts.check,
      color: "text-emerald-600",
      activeColor: "ring-2 ring-emerald-300 bg-emerald-50",
      icon: <SearchIcon className="h-5 w-5 text-emerald-400" />,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-8 pb-10 space-y-6">
      {/* Alert strip */}
      {(urgentCount > 0 || problemCount > 0) && (
        <div className="flex items-center gap-4 rounded-2xl bg-red-50 border border-red-100 px-5 py-3.5">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex gap-4 text-sm font-medium">
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
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setActiveFilter(activeFilter === card.key ? null : card.key)}
            className={`rounded-2xl bg-white border border-gray-100 shadow-sm px-4 py-4 text-left transition-all duration-150 active:scale-[0.97] ${
              activeFilter === card.key ? card.activeColor : "hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              {card.icon}
              {card.count > 0 && (
                <span className={`text-2xl font-bold tabular-nums ${card.color}`}>
                  {card.count}
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
          </button>
        ))}
      </div>

      {/* Done count — subtle inline */}
      {counts.done > 0 && (
        <button
          onClick={() => setActiveFilter(activeFilter === "done" ? null : "done")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
            activeFilter === "done"
              ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CircleCheck className="h-4 w-4" />
          {counts.done} {t("completed", "completados", "afgerond")}
        </button>
      )}

      {/* Filter label */}
      {activeFilter && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {activeFilter === "done"
              ? t("Completed", "Completados", "Afgerond")
              : summaryCards.find(c => c.key === activeFilter)?.label ?? ""}
          </p>
          <button
            onClick={() => setActiveFilter(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors font-medium"
          >
            {t("Show all", "Mostrar todo", "Alles tonen")}
          </button>
        </div>
      )}

      {/* Work cards */}
      <div className="space-y-3">
        {displayRepairs.map((repair) => (
          <WorkCard key={repair.id} repair={repair} t={t} />
        ))}
      </div>

      {/* Weather — bottom secondary */}
      <div className="pt-4">
        <WeatherWidget />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// WORK CARD
// ══════════════════════════════════════════════════

function WorkCard({
  repair,
  t,
}: {
  repair: RepairItem;
  t: (en: string, es?: string | null, nl?: string | null) => string;
}) {
  const category = categorize(repair);
  const progress = repair.tasks.total > 0
    ? Math.round((repair.tasks.done / repair.tasks.total) * 100)
    : 0;

  const statusConfig: Record<StatusCategory, { label: string; cls: string }> = {
    todo: { label: t("To Do", "Por hacer", "Te doen"), cls: "bg-gray-100 text-gray-600" },
    in_progress: { label: t("In Progress", "En progreso", "Bezig"), cls: "bg-sky-50 text-sky-700" },
    waiting: { label: t("Waiting", "Esperando", "Wachten"), cls: "bg-amber-50 text-amber-700" },
    check: { label: t("Final Check", "Control final", "Nacontrole"), cls: "bg-emerald-50 text-emerald-700" },
    done: { label: t("Done", "Completado", "Klaar"), cls: "bg-emerald-50 text-emerald-600" },
  };

  const status = statusConfig[category];
  const jobType = JOB_TYPE_CONFIG[repair.jobType];

  const unitLine = [repair.unitBrand, repair.unitModel].filter(Boolean).join(" ");
  const displayTitle = repair.title || unitLine || repair.publicCode || "—";

  return (
    <Link href={`/garage/repairs/${repair.id}`} className="block">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md active:scale-[0.99] transition-all duration-200 p-5 sm:p-6 cursor-pointer">
        {/* Title + chevron */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 leading-snug truncate">
              {displayTitle}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {[
                repair.unitRegistration,
                repair.customerName,
                repair.unitStorageLocation && `📍 ${repair.unitStorageLocation}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-300 shrink-0 mt-1" />
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${status.cls}`}>
            {status.label}
          </span>
          {jobType && (
            <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${jobType.cls}`}>
              {t(jobType.label[0], jobType.label[1], jobType.label[2])}
            </span>
          )}
          {repair.priority === "urgent" && (
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold bg-red-50 text-red-600">
              {t("Urgent", "Urgente", "Spoed")}
            </span>
          )}
          {repair.priority === "high" && (
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold bg-orange-50 text-orange-600">
              {t("High", "Alto", "Hoog")}
            </span>
          )}
          {repair.tasks.problem > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {repair.tasks.problem}
            </span>
          )}
          {repair.parts.pending > 0 && (
            <span className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-600">
              📦 {repair.parts.received}/{repair.parts.total}
            </span>
          )}
        </div>

        {/* Progress */}
        {repair.tasks.total > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-500">
                {repair.tasks.done}/{repair.tasks.total} {t("tasks", "tareas", "taken")}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${progress === 100 ? "text-emerald-600" : "text-gray-400"}`}>
                {progress}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  progress === 100 ? "bg-emerald-500" : "bg-sky-500"
                }`}
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
                className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500"
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
