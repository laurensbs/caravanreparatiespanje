"use client";

import { useTransition } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import { startTimer } from "@/actions/time-entries";
import { GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { garageTimerBlockedReason } from "@/lib/garage-timer-policy";
import { GaragePhotoUpload } from "@/components/garage/photo-upload";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { toast } from "sonner";

const STATUS_ICONS: Record<RepairTaskStatus, string> = {
  pending: "○",
  in_progress: "◐",
  done: "✓",
  problem: "⚠",
  review: "↻",
};

interface TaskCardProps {
  task: RepairTask;
  repairJobId: string;
  /** For user-facing messages when the server refuses to start a timer. */
  repairJobStatus: string;
  onUpdate: () => void;
  onProblem: (taskId: string) => void;
  /** Called before a task is moved to `in_progress`. May return a
   *  worker id (the picked technician); if it returns a string the
   *  card will also start a timer for that worker. Returning `null`
   *  cancels the status change. Returning `true` (legacy) promotes
   *  without starting a timer. */
  onBeforeStart?: () => Promise<string | boolean | null>;
  photos?: { id: string; url: string; caption: string | null }[];
}

export function TaskCard({ task, repairJobId, repairJobStatus, onUpdate, onProblem, onBeforeStart, photos = [] }: TaskCardProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const title = t(task.title, task.titleEs, task.titleNl);
  const status = task.status as RepairTaskStatus;
  const isDone = status === "done";

  function handleStatusChange(newStatus: RepairTaskStatus) {
    if (newStatus === "problem") {
      hapticTap();
      onProblem(task.id);
      return;
    }
    newStatus === "done" ? hapticSuccess() : hapticTap();
    startTransition(async () => {
      let pickedWorkerId: string | null = null;
      if (newStatus === "in_progress" && onBeforeStart) {
        const res = await onBeforeStart();
        if (!res) return;
        if (typeof res === "string") pickedWorkerId = res;
      }
      await updateTaskStatus(task.id, newStatus);
      // Start ook meteen de klok zodat "▶ Start" op een taak niet
      // stilletjes een status-update is maar de werkelijke timer
      // aantrapt. Dit is de bug waardoor het leek alsof "Start"
      // niets deed.
      if (newStatus === "in_progress" && pickedWorkerId) {
        try {
          await startTimer(repairJobId, pickedWorkerId);
        } catch (e) {
          if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
            toast.message(garageTimerBlockedReason(repairJobStatus, t));
          } else {
            throw e;
          }
        }
      }
      onUpdate();
    });
  }

  const actions = getActions(task.status);

  return (
    <div className={`bg-white/[0.03] rounded-2xl border border-white/[0.06] transition-all duration-150 ${isPending ? "opacity-60" : ""} ${isDone ? "opacity-50" : ""}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm leading-none shrink-0 mt-0.5 ${
            status === "done" ? "bg-emerald-400/10 text-emerald-400" :
            status === "in_progress" ? "bg-teal-400/10 text-teal-400" :
            status === "problem" ? "bg-red-400/10 text-red-400" :
            status === "review" ? "bg-amber-400/10 text-amber-400" :
            "bg-white/[0.06] text-white/30"
          }`}>
            {STATUS_ICONS[status]}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-medium leading-snug ${isDone ? "line-through text-white/30" : "text-white/90"}`}>
                {title}
              </span>
              {task.source === "garage" && !task.approvedAt && (
                <span className="inline-flex items-center rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 shrink-0">
                  {t("Pending", "Pendiente", "Wachtend")}
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-xs text-white/30 mt-0.5 leading-snug">{task.description}</p>
            )}

            {status === "problem" && task.problemCategory && (
              <div className="mt-1.5 rounded-lg bg-red-400/[0.06] border border-red-400/10 px-2.5 py-1.5 text-xs text-red-300">
                <strong>{task.problemCategory.replace("_", " ")}</strong>
                {task.problemNote && <span>: {task.problemNote}</span>}
              </div>
            )}
          </div>

          <GaragePhotoUpload
            repairJobId={repairJobId}
            repairTaskId={task.id}
            photos={photos}
            onUpdate={onUpdate}
            t={t}
            compact
          />
        </div>

        {actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                disabled={isPending}
                className={`flex-1 rounded-xl h-11 text-sm font-semibold transition-all active:scale-[0.97] ${action.className}`}
              >
                {t(action.labelEn, action.labelEs, action.labelNl)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getActions(status: string) {
  switch (status) {
    case "pending":
      return [{ status: "in_progress" as RepairTaskStatus, labelEn: "▶ Start", labelEs: "▶ Iniciar", labelNl: "▶ Start", className: "bg-white/10 text-white hover:bg-white/15" }];
    case "in_progress":
      return [
        { status: "done" as RepairTaskStatus, labelEn: "✓ Done", labelEs: "✓ Listo", labelNl: "✓ Klaar", className: "bg-emerald-500 text-white" },
        { status: "problem" as RepairTaskStatus, labelEn: "⚠ Problem", labelEs: "⚠ Problema", labelNl: "⚠ Probleem", className: "bg-red-400/10 text-red-400 border border-red-400/20" },
      ];
    case "problem":
      return [{ status: "in_progress" as RepairTaskStatus, labelEn: "↻ Retry", labelEs: "↻ Reintentar", labelNl: "↻ Opnieuw", className: "bg-white/10 text-white hover:bg-white/15" }];
    case "review":
      return [
        { status: "in_progress" as RepairTaskStatus, labelEn: "▶ Rework", labelEs: "▶ Rehacer", labelNl: "▶ Herwerk", className: "bg-white/10 text-white hover:bg-white/15" },
        { status: "done" as RepairTaskStatus, labelEn: "✓ OK", labelEs: "✓ OK", labelNl: "✓ OK", className: "bg-emerald-500 text-white" },
      ];
    case "done":
      return [];
    default:
      return [];
  }
}
