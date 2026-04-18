"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRepairTask, deleteRepairTask, approveGarageTask, getRepairTasks } from "@/actions/garage";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { Plus, Trash2, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  repairJobId: string;
  initialTasks: RepairTask[];
  totalLoggedMinutes?: number;
}

const DEFAULT_TASKS = [
  { title: "Check everything", titleEs: "Revisar toda la caravana", titleNl: "Controle hele caravan" },
  { title: "Water test", titleEs: "Prueba de agua", titleNl: "Watertest" },
  { title: "Electric check", titleEs: "Revisión eléctrica", titleNl: "Elektra controle" },
  { title: "Gas check", titleEs: "Revisión de gas", titleNl: "Gas controle" },
  { title: "Roof inspection", titleEs: "Inspección del techo", titleNl: "Dak inspectie" },
] as const;

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function RepairTaskList({ repairJobId, initialTasks, totalLoggedMinutes = 0 }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const updated = await getRepairTasks(repairJobId);
      setTasks(updated);
    });
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    const match = DEFAULT_TASKS.find((d) => d.title === newTitle.trim());
    startTransition(async () => {
      await addRepairTask(repairJobId, {
        title: newTitle.trim(),
        titleEs: match?.titleEs,
        titleNl: match?.titleNl,
      });
      setNewTitle("");
      setShowAdd(false);
      refresh();
      toast.success("Task added");
    });
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      await deleteRepairTask(taskId);
      refresh();
      toast.success("Task removed");
    });
  }

  function handleApprove(taskId: string) {
    startTransition(async () => {
      await approveGarageTask(taskId);
      refresh();
      toast.success("Task approved");
    });
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <span>
            Tasks
            {tasks.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                doneCount === tasks.length
                  ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {doneCount}/{tasks.length}
              </span>
            )}
          </span>
          {totalLoggedMinutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 dark:text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatMinutes(totalLoggedMinutes)}
            </span>
          )}
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="space-y-2 mb-2">
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task name..."
              className="h-7 text-xs rounded-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
              }}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={isPending || !newTitle.trim()}>
            Add
          </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DEFAULT_TASKS.filter((d) => !tasks.some((t) => t.title === d.title)).map((d) => (
              <button
                key={d.title}
                onClick={() => {
                  startTransition(async () => {
                    await addRepairTask(repairJobId, { title: d.title, titleEs: d.titleEs, titleNl: d.titleNl });
                    refresh();
                    toast.success("Task added");
                  });
                }}
                disabled={isPending}
                className="text-xs px-2.5 py-1 rounded-lg border border-border dark:border-border text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted dark:hover:bg-foreground/[0.10] font-medium transition-colors"
              >
                + {d.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 ? (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div key={task.id}>
              <div
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs group ${
                  task.status === "problem" ? "bg-red-50/60 dark:bg-red-950/20" : "bg-card/60 dark:bg-card/5"
                } ${task.status === "done" ? "opacity-50" : ""} border border-border/40`}
              >
                <span className="text-[11px] shrink-0">
                  {task.status === "done" ? "✓" : task.status === "problem" ? "⚠" : task.status === "in_progress" ? "◐" : "○"}
                </span>
                <span className={`flex-1 truncate ${task.status === "done" ? "line-through" : ""}`}>
                  {task.title}
                </span>
                <Badge className={`text-[10px] shrink-0 ${TASK_STATUS_COLORS[task.status as RepairTaskStatus]}`}>
                  {TASK_STATUS_LABELS[task.status as RepairTaskStatus]}
                </Badge>
                {task.source === "garage" && !task.approvedAt && (
                  <button
                    className="h-5 px-1 text-green-700 hover:bg-green-100 rounded transition-colors"
                    onClick={() => handleApprove(task.id)}
                    title="Approve"
                  >
                    <CheckCircle className="h-3 w-3" />
                  </button>
                )}
                {task.problemCategory && (
                  <span className="text-[10px] text-red-600 shrink-0" title={task.problemNote ?? undefined}>
                    {task.problemCategory.replace("_", " ")}
                  </span>
                )}
                <button
                  className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all shrink-0"
                  onClick={() => handleDelete(task.id)}
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

            </div>
          ))}

        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tasks yet. Add tasks for the technicians.</p>
      )}
    </div>
  );
}
