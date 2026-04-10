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
  assignedUserName: string | null;
  tasks: { total: number; done: number; problem: number };
  parts: { total: number; received: number; pending: number };
  workers: string[];
  finalCheckStatus: string | null;
}

const PRIORITY_BORDER: Record<Priority, string> = {
  low: "border-l-slate-300",
  normal: "border-l-blue-400",
  high: "border-l-orange-400",
  urgent: "border-l-red-500",
};

export function RepairCard({ repair }: { repair: RepairCardProps }) {
  const { t } = useLanguage();
  const progress = repair.tasks.total > 0
    ? Math.round((repair.tasks.done / repair.tasks.total) * 100)
    : 0;

  return (
    <Link href={`/garage/repairs/${repair.id}`}>
      <div className={`rounded-2xl border border-l-4 ${PRIORITY_BORDER[repair.priority]} bg-card p-4 shadow-sm active:scale-[0.99] transition-all`}>
        {/* Top row: code + badges */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-muted-foreground tracking-wide">{repair.publicCode}</span>
          <div className="flex items-center gap-1.5">
            {repair.tasks.problem > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                ⚠ {repair.tasks.problem}
              </span>
            )}
            {repair.finalCheckStatus === "pending" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-semibold">
                🔍 {t("Check", "Control", "Natest")}
              </span>
            )}
            {repair.priority === "urgent" && (
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-semibold">
                🔴 {t("Urgent", "Urgente", "Spoed")}
              </span>
            )}
            {repair.priority === "high" && (
              <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-xs font-semibold">
                {t("High", "Alto", "Hoog")}
              </span>
            )}
          </div>
        </div>

        {/* Unit info */}
        <p className="font-semibold text-base truncate">
          {repair.unitRegistration && <span className="mr-2">{repair.unitRegistration}</span>}
          {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ") || repair.title}
        </p>

        {/* Customer + title */}
        {repair.customerName && (
          <p className="text-sm text-muted-foreground truncate">{repair.customerName}</p>
        )}
        {repair.title && (repair.unitBrand || repair.unitModel) && (
          <p className="text-xs text-muted-foreground/70 truncate mt-0.5 italic">{repair.title}</p>
        )}

        {/* Progress bar */}
        {repair.tasks.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {repair.tasks.done}/{repair.tasks.total} {t("tasks", "tareas", "taken")}
              </span>
              <span className={`text-xs font-bold tabular-nums ${progress === 100 ? "text-green-600" : ""}`}>{progress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress === 100
                    ? "bg-green-500"
                    : repair.tasks.problem > 0
                    ? "bg-gradient-to-r from-blue-500 to-orange-400"
                    : "bg-gradient-to-r from-blue-500 to-blue-400"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Assigned tech + Workers + Parts status */}
        {(repair.assignedUserName || repair.workers.length > 0 || repair.parts.total > 0) && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {repair.workers.length > 0 ? (
                <div className="flex items-center -space-x-1.5">
                  {repair.workers.slice(0, 4).map((name, i) => (
                    <span
                      key={i}
                      className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-[10px] font-bold text-white ring-2 ring-card"
                      title={name}
                    >
                      {name.charAt(0).toUpperCase()}
                    </span>
                  ))}
                  {repair.workers.length > 4 && (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-400 text-[10px] font-bold text-white ring-2 ring-card">
                      +{repair.workers.length - 4}
                    </span>
                  )}
                </div>
              ) : repair.assignedUserName ? (
                <p className="text-xs text-muted-foreground truncate">
                  👤 {repair.assignedUserName}
                </p>
              ) : null}
            </div>
            {repair.parts.total > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0 ${
                repair.parts.pending === 0
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                📦 {repair.parts.received}/{repair.parts.total}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
