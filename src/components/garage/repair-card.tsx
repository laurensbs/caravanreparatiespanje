"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
      <div className={`rounded-xl border border-l-4 ${PRIORITY_BORDER[repair.priority]} bg-card p-4 shadow-sm active:bg-muted/50 transition-colors`}>
        {/* Top row: code + priority */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-muted-foreground">{repair.publicCode}</span>
          <div className="flex items-center gap-2">
            {repair.tasks.problem > 0 && (
              <Badge variant="destructive" className="text-xs">
                {repair.tasks.problem} {t("problem", "problema", "probleem")}
              </Badge>
            )}
            {repair.finalCheckStatus === "pending" && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">
                {t("Final check", "Control final", "Natest")}
              </Badge>
            )}
            {repair.priority === "urgent" && (
              <Badge variant="destructive" className="text-xs">{t("Urgent", "Urgente", "Spoed")}</Badge>
            )}
            {repair.priority === "high" && (
              <Badge className="bg-orange-100 text-orange-700 text-xs">{t("High", "Alto", "Hoog")}</Badge>
            )}
          </div>
        </div>

        {/* Unit info */}
        <p className="font-semibold text-base truncate">
          {repair.unitRegistration && <span className="mr-2">{repair.unitRegistration}</span>}
          {[repair.unitBrand, repair.unitModel].filter(Boolean).join(" ") || repair.title}
        </p>

        {/* Customer */}
        {repair.customerName && (
          <p className="text-sm text-muted-foreground truncate">{repair.customerName}</p>
        )}

        {/* Progress bar */}
        {repair.tasks.total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                {repair.tasks.done}/{repair.tasks.total} {t("tasks", "tareas", "taken")}
              </span>
              <span className="text-xs font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Assigned tech */}
        {repair.assignedUserName && (
          <p className="text-xs text-muted-foreground mt-2">
            👤 {repair.assignedUserName}
          </p>
        )}
      </div>
    </Link>
  );
}
