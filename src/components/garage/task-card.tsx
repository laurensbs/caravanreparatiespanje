"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import type { RepairTask, RepairTaskStatus, ProblemCategory } from "@/types";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/types";

const STATUS_ICONS: Record<RepairTaskStatus, string> = {
  pending: "○",
  in_progress: "◐",
  done: "✓",
  problem: "⚠",
  review: "↻",
};

interface TaskCardProps {
  task: RepairTask;
  onUpdate: () => void;
  onProblem: (taskId: string) => void;
}

export function TaskCard({ task, onUpdate, onProblem }: TaskCardProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const title = t(task.title, task.titleEs, task.titleNl);

  function handleStatusChange(newStatus: RepairTaskStatus) {
    if (newStatus === "problem") {
      onProblem(task.id);
      return;
    }
    startTransition(async () => {
      await updateTaskStatus(task.id, newStatus);
      onUpdate();
    });
  }

  // Determine which action buttons to show
  const actions = getActions(task.status);

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${isPending ? "opacity-60" : ""} ${
      task.status === "problem" ? "border-red-300 bg-red-50/50" : ""
    } ${task.status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <span className="mt-0.5 text-2xl leading-none">
          {STATUS_ICONS[task.status as RepairTaskStatus]}
        </span>

        <div className="flex-1 min-w-0">
          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium text-base ${task.status === "done" ? "line-through" : ""}`}>
              {title}
            </span>
            <Badge className={`text-xs ${TASK_STATUS_COLORS[task.status as RepairTaskStatus]}`}>
              {TASK_STATUS_LABELS[task.status as RepairTaskStatus]}
            </Badge>
            {task.source === "garage" && !task.approvedAt && (
              <Badge variant="outline" className="text-xs border-amber-400 text-amber-700">
                {t("Pending approval", "Pendiente", "Wacht op goedkeuring")}
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
          )}

          {/* Problem info */}
          {task.status === "problem" && task.problemCategory && (
            <div className="mt-2 rounded-lg bg-red-100 p-2 text-sm text-red-800">
              <strong>{task.problemCategory.replace("_", " ")}</strong>
              {task.problemNote && <span>: {task.problemNote}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {actions.length > 0 && (
        <div className="flex gap-2 mt-3">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => handleStatusChange(action.status)}
              disabled={isPending}
              className={`flex-1 rounded-lg px-3 py-3 text-sm font-medium transition-colors active:scale-[0.98] ${action.className}`}
            >
              {t(action.labelEn, action.labelEs, action.labelNl)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getActions(status: string) {
  switch (status) {
    case "pending":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Start",
          labelEs: "▶ Iniciar",
          labelNl: "▶ Start",
          className: "bg-blue-500 text-white",
        },
      ];
    case "in_progress":
      return [
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ Done",
          labelEs: "✓ Listo",
          labelNl: "✓ Klaar",
          className: "bg-green-500 text-white",
        },
        {
          status: "problem" as RepairTaskStatus,
          labelEn: "⚠ Problem",
          labelEs: "⚠ Problema",
          labelNl: "⚠ Probleem",
          className: "bg-red-100 text-red-700 border border-red-300",
        },
      ];
    case "problem":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "↻ Retry",
          labelEs: "↻ Reintentar",
          labelNl: "↻ Opnieuw",
          className: "bg-blue-500 text-white",
        },
      ];
    case "review":
      return [
        {
          status: "in_progress" as RepairTaskStatus,
          labelEn: "▶ Rework",
          labelEs: "▶ Rehacer",
          labelNl: "▶ Herwerk",
          className: "bg-blue-500 text-white",
        },
        {
          status: "done" as RepairTaskStatus,
          labelEn: "✓ OK",
          labelEs: "✓ OK",
          labelNl: "✓ OK",
          className: "bg-green-500 text-white",
        },
      ];
    case "done":
      return [];
    default:
      return [];
  }
}
