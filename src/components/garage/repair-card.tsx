"use client";

import Link from "next/link";
import { useLanguage } from "@/components/garage/language-toggle";
import type { Priority } from "@/types";

interface RepairCardProps {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: Priority;
  customerName: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  unitStorageLocation: string | null;
  unitCurrentPosition: string | null;
  assignedUserName: string | null;
  tasks: { total: number; done: number; problem: number };
  parts: { total: number; received: number; pending: number };
  workers: string[];
  finalCheckStatus: string | null;
  jobType: string;
}

const PRIORITY_ACCENT: Record<Priority, { border: string; dot: string }> = {
  low: { border: "border-l-slate-200 dark:border-l-slate-700", dot: "" },
  normal: { border: "border-l-blue-400", dot: "" },
  high: { border: "border-l-orange-400", dot: "bg-orange-400" },
  urgent: { border: "border-l-red-500", dot: "bg-red-500 animate-pulse" },
};

const WORKER_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-teal-500",
];

const JOB_TYPE_BADGE: Record<string, string> = {
  wax: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  maintenance: "bg-foreground/[0.06] text-foreground/80 dark:bg-foreground/[0.06]",
  inspection: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const JOB_TYPE_SHORT: Record<string, string> = {
  wax: "Wax",
  maintenance: "Maint.",
  inspection: "Insp.",
};

export function RepairCard({ repair }: { repair: RepairCardProps }) {
  const { t } = useLanguage();
  const progress = repair.tasks.total > 0
    ? Math.round((repair.tasks.done / repair.tasks.total) * 100)
    : 0;
  const accent = PRIORITY_ACCENT[repair.priority];

  return (
    <Link href={`/garage/repairs/${repair.id}`}>
      <div className={`rounded-2xl border-l-[5px] ${accent.border} bg-white dark:bg-card shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 overflow-hidden`}>
        <div className="p-4">
          {/* Top row: code + badges */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground/70 tracking-widest uppercase">{repair.publicCode}</span>
              {accent.dot && <span className={`h-2 w-2 rounded-full ${accent.dot}`} />}
              {repair.jobType && repair.jobType !== "repair" && JOB_TYPE_BADGE[repair.jobType] && (
                <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold ${JOB_TYPE_BADGE[repair.jobType]}`}>
                  {JOB_TYPE_SHORT[repair.jobType] ?? repair.jobType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {repair.tasks.problem > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-2 py-0.5 text-[11px] font-bold">
                  ⚠ {repair.tasks.problem}
                </span>
              )}
              {repair.finalCheckStatus === "pending" && (
                <span className="inline-flex items-center gap-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[11px] font-bold">
                  🔍
                </span>
              )}
              {repair.parts.total > 0 && (
                <span className={`inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                  repair.parts.pending === 0
                    ? "bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400"
                    : "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400"
                }`}>
                  📦 {repair.parts.received}/{repair.parts.total}
                </span>
              )}
            </div>
          </div>

          {/* Unit info — big & bold */}
          <p className="font-bold text-[15px] leading-tight truncate">
            {repair.unitRegistration && <span className="mr-1.5">{repair.unitRegistration}</span>}
            {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ") || repair.title}
          </p>

          {/* Customer + title + location */}
          {repair.customerName && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{repair.customerName}</p>
          )}
          {repair.unitStorageLocation && (
            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
              📍 {repair.unitStorageLocation}{repair.unitCurrentPosition ? ` · ${repair.unitCurrentPosition}` : ""}
            </p>
          )}
          {repair.title && (repair.unitBrand || repair.unitModel) && (
            <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{repair.title}</p>
          )}

          {/* Progress bar */}
          {repair.tasks.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {repair.tasks.done}/{repair.tasks.total} {t("tasks", "tareas", "taken")}
                </span>
                <span className={`text-[11px] font-extrabold tabular-nums ${progress === 100 ? "text-green-600" : "text-muted-foreground"}`}>
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    progress === 100
                      ? "bg-gradient-to-r from-green-400 to-emerald-500"
                      : repair.tasks.problem > 0
                      ? "bg-gradient-to-r from-blue-400 to-orange-400"
                      : "bg-gradient-to-r from-blue-400 to-blue-500"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Workers + meta row */}
          {(repair.workers.length > 0 || repair.assignedUserName) && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 min-w-0">
                {repair.workers.length > 0 ? (
                  <div className="flex items-center -space-x-1">
                    {repair.workers.slice(0, 5).map((name, i) => (
                      <span
                        key={i}
                        className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-card ${WORKER_COLORS[i % WORKER_COLORS.length]}`}
                        title={name}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    {repair.workers.length > 5 && (
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-foreground/30 dark:bg-foreground/[0.12] text-[10px] font-bold text-white ring-2 ring-white dark:ring-card">
                        +{repair.workers.length - 5}
                      </span>
                    )}
                  </div>
                ) : repair.assignedUserName ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-400 text-[10px] font-bold text-white">
                      {repair.assignedUserName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">{repair.assignedUserName}</span>
                  </div>
                ) : null}
              </div>
              {repair.priority === "urgent" && (
                <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">
                  {t("Urgent", "Urgente", "Spoed")}
                </span>
              )}
              {repair.priority === "high" && (
                <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">
                  {t("High", "Alto", "Hoog")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
