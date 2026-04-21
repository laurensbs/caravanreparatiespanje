"use client";

import { useTransition } from "react";
import { useLanguage } from "@/components/garage/language-toggle";
import { updateTaskStatus } from "@/actions/garage";
import { startTimer, GARAGE_TIMER_NO_TASKS } from "@/actions/time-entries";
import { GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { garageTimerBlockedReason } from "@/lib/garage-timer-policy";
import { GaragePhotoUpload } from "@/components/garage/photo-upload";
import { TaskPartRow } from "@/components/garage/task-part-row";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import type { RepairTask, RepairTaskStatus } from "@/types";
import type { Language } from "@/components/garage/language-toggle";
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
  /** True als er minstens één timer loopt op deze reparatie. We
   *  blokkeren dan niet, maar zonder lopende timer mag een taak niet
   *  afgevinkt worden — dat voorkomt dat werkers vergeten te klokken
   *  en er achteraf gaten in de factuurtijd zitten. */
  hasActiveTimer?: boolean;
  /** Onderdelen gekoppeld aan deze taak (uit part_requests.repair_task_id). */
  taskLinkedParts?: { id: string; partName: string; quantity: number; status: string }[];
  partCategories?: {
    id: string;
    key: string;
    label: string;
    icon: string;
    color: string;
    sortOrder: number;
    active: boolean;
  }[];
  deviceLang?: Language;
}

export function TaskCard({
  task,
  repairJobId,
  repairJobStatus,
  onUpdate,
  onProblem,
  onBeforeStart,
  photos = [],
  hasActiveTimer = false,
  taskLinkedParts = [],
  partCategories,
  deviceLang = "en",
}: TaskCardProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();

  const title = t(task.title, task.titleEs, task.titleNl);
  const status = task.status as RepairTaskStatus;
  const isDone = status === "done";

  async function handleStatusChange(newStatus: RepairTaskStatus) {
    if (newStatus === "problem") {
      hapticTap();
      onProblem(task.id);
      return;
    }
    // "Done" (of "opnieuw openen" vanuit done) mag alleen als er een
    // timer loopt op deze reparatie — dat dwingt werkers om eerst te
    // klokken, anders raken we billable minuten kwijt. Start/Retry
    // mogen wel want die zetten juist een nieuwe timer op.
    if ((newStatus === "done" || (isDone && newStatus === "pending")) && !hasActiveTimer) {
      hapticTap();
      toast.error(
        t(
          "Start the timer first — then you can tick off the task.",
          "Primero inicia el temporizador y luego marca la tarea.",
          "Start eerst de timer — dan kun je de taak afvinken.",
        ),
      );
      return;
    }
    newStatus === "done" ? hapticSuccess() : hapticTap();

    // Open de worker-picker VOOR de transition. Als we dit binnen
    // startTransition doen, markeert React de setState van de picker
    // als low-priority en kan het modaal "blijven hangen" — de werker
    // ervaart dat als "er gebeurt niks" na ▶ Start.
    let pickedWorkerId: string | null = null;
    if (newStatus === "in_progress" && onBeforeStart) {
      const res = await onBeforeStart();
      if (!res) return;
      if (typeof res === "string") pickedWorkerId = res;
    }

    startTransition(async () => {
      try {
        await updateTaskStatus(task.id, newStatus);
        if (newStatus === "in_progress" && pickedWorkerId) {
          try {
            await startTimer(repairJobId, pickedWorkerId);
          } catch (e) {
            if (e instanceof Error && e.message === GARAGE_TIMER_NOT_ALLOWED) {
              toast.message(garageTimerBlockedReason(repairJobStatus, t));
            } else if (e instanceof Error && e.message === GARAGE_TIMER_NO_TASKS) {
              toast.error(
                t(
                  "No tasks on this job yet — add at least one task (office / work order) before starting the timer.",
                  "Aún no hay tareas — añade al menos una (oficina / orden) antes de iniciar el temporizador.",
                  "Nog geen taken op deze klus — voeg minstens één taak toe (kantoor / werkorder) voordat je de timer start.",
                ),
              );
            } else {
              throw e;
            }
          }
        }
        if (newStatus === "done") {
          toast.success(t("Task completed", "Tarea completada", "Taak afgerond"));
        }
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not update task");
      } finally {
        onUpdate();
      }
    });
  }

  function toggleDone() {
    if (isPending) return;
    handleStatusChange(isDone ? "pending" : "done");
  }

  // Zonder lopende timer disabelen we de afvink-knop + done-knop. Start
  // blijft altijd klikbaar (die zet zelf de timer op via onBeforeStart).
  const tickDisabled = !hasActiveTimer && (status === "pending" || status === "in_progress" || status === "done");

  const actions = getActions(task.status);

  return (
    <div className={`bg-white/[0.03] rounded-2xl border border-white/[0.06] transition-all duration-150 ${isPending ? "opacity-60" : ""} ${isDone ? "opacity-50" : ""}`}>
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={toggleDone}
            disabled={isPending}
            aria-label={isDone
              ? t("Mark as not done", "Marcar como no hecho", "Markeer als niet klaar")
              : t("Mark as done", "Marcar como hecho", "Afvinken")}
            title={tickDisabled
              ? t("Start the timer first", "Inicia el temporizador primero", "Start eerst de timer")
              : undefined}
            className={`flex items-center justify-center h-8 w-8 rounded-lg text-sm leading-none shrink-0 mt-0.5 transition-all active:scale-90 disabled:opacity-50 ${
              status === "done" ? "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20" :
              status === "in_progress" ? "bg-teal-400/10 text-teal-400 hover:bg-teal-400/20" :
              status === "problem" ? "bg-red-400/10 text-red-400 hover:bg-red-400/20" :
              status === "review" ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20" :
              "bg-white/[0.06] text-white/30 hover:bg-white/10 hover:text-white/60"
            } ${tickDisabled ? "cursor-not-allowed" : ""}`}
          >
            {STATUS_ICONS[status]}
          </button>

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

        <TaskPartRow
          repairJobId={repairJobId}
          taskId={task.id}
          t={t}
          deviceLang={deviceLang}
          onUpdate={onUpdate}
          partCategories={partCategories}
          linkedParts={taskLinkedParts}
        />
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
