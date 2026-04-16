"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useLanguage, LanguageToggle } from "@/components/garage/language-toggle";
import { useGaragePoll } from "@/lib/use-garage-poll";
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
  X,
  MessageSquare,
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
  const [search, setSearch] = useState("");

  useGaragePoll();

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
            <button onClick={async () => { await garageLock(); router.refresh(); }} className="h-10 w-10 flex items-center justify-center rounded-xl text-white/40 hover:bg-white/[0.06] active:scale-95 transition-all">
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
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
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
            {displayRepairs.map((repair) => (
              <JobCard key={repair.id} repair={repair} t={t} activeTimers={activeTimers.filter((at) => at.repairJobId === repair.id)} />
            ))}
          </div>
        )}
      </main>
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

function JobCard({ repair, t, activeTimers }: { repair: RepairItem; t: (en: string, es?: string | null, nl?: string | null) => string; activeTimers: ActiveTimerItem[] }) {
  const hasTimer = activeTimers.length > 0;
  const progress = repair.tasks.total > 0 ? (repair.tasks.done / repair.tasks.total) * 100 : 0;

  return (
    <Link
      href={`/garage/repairs/${repair.id}`}
      className={`group block rounded-2xl border transition-all active:scale-[0.98] ${
        hasTimer
          ? "bg-sky-400/[0.06] border-sky-400/20"
          : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
      }`}
    >
      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLOR[repair.status] || "bg-white/20"}`} />
          <span className="text-base font-bold text-white tracking-tight font-mono">
            {repair.unitRegistration || repair.publicCode || "—"}
          </span>
          {repair.priority === "urgent" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
              {t("Urgent", "Urgente", "Spoed")}
            </span>
          )}
          {repair.priority === "high" && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              {t("High", "Alta", "Hoog")}
            </span>
          )}
          {hasTimer && (
            <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              <Timer className="h-3 w-3" />
            </span>
          )}
          {repair.garageAdminMessage && !repair.garageAdminMessageReadAt && (
            <span className="flex items-center text-sky-400">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-white/10 ml-auto shrink-0 group-hover:text-white/25 transition-colors" />
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm text-white/50 truncate">
            {repair.customerName || t("No customer", "Sin cliente", "Geen klant")}
          </span>
          {repair.unitBrand && (
            <span className="text-xs text-white/20">· {repair.unitBrand} {repair.unitModel}</span>
          )}
        </div>

        {repair.title && <p className="text-[13px] text-white/25 truncate mb-2.5">{repair.title}</p>}
        {!repair.title && <div className="mb-1.5" />}

        <div className="flex items-center gap-3">
          {repair.tasks.total > 0 && (
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] text-white/30 tabular-nums font-medium shrink-0">{repair.tasks.done}/{repair.tasks.total}</span>
            </div>
          )}
          {repair.parts.pending > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
              <Package className="h-3 w-3" />{repair.parts.pending}
            </span>
          )}
          {repair.tasks.problem > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
              <AlertTriangle className="h-3 w-3" />{repair.tasks.problem}
            </span>
          )}
          {repair.workers.length > 0 && (
            <div className="flex -space-x-1.5">
              {repair.workers.slice(0, 3).map((w, i) => (
                <div key={i} className="h-6 w-6 rounded-full bg-white/10 border-2 border-gray-950 flex items-center justify-center text-[9px] font-bold text-white/50">
                  {w.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          )}
          {repair.totalMinutes > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-white/30 font-medium tabular-nums">
              <Clock className="h-3 w-3" />
              {Math.floor(repair.totalMinutes / 60) > 0
                ? `${Math.floor(repair.totalMinutes / 60)}h ${repair.totalMinutes % 60}m`
                : `${repair.totalMinutes}m`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
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
