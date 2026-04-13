"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRepairTask, deleteRepairTask, approveGarageTask, getRepairTasks, updateRepairTaskPricing } from "@/actions/garage";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface Props {
  repairJobId: string;
  initialTasks: RepairTask[];
  defaultHourlyRate?: number;
}

export function RepairTaskList({ repairJobId, initialTasks, defaultHourlyRate = 42.50 }: Props) {
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
    startTransition(async () => {
      await addRepairTask(repairJobId, { title: newTitle.trim() });
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

  function handlePricingUpdate(taskId: string, field: string, value: number | boolean) {
    startTransition(async () => {
      await updateRepairTaskPricing(taskId, { [field]: value });
      refresh();
    });
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const billableTasks = tasks.filter((t) => t.billable);
  const totalEstimatedHours = billableTasks.reduce((sum, t) => sum + (t.estimatedHours ? parseFloat(t.estimatedHours) : 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium">
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
        <div className="flex gap-2 mb-2">
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
      )}

      {/* Task list */}
      {tasks.length > 0 ? (
        <div className="space-y-1">
          {tasks.map((task) => (
            <div key={task.id}>
              <div
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs group ${
                  task.status === "problem" ? "bg-red-50/60 dark:bg-red-950/20" : "bg-white/60 dark:bg-white/5"
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
              {/* Pricing row */}
              <div className="flex items-center gap-2 pl-5 py-0.5 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox
                    checked={task.billable ?? true}
                    onCheckedChange={(checked) => handlePricingUpdate(task.id, "billable", checked === true)}
                    className="h-3 w-3"
                  />
                  <span className="text-muted-foreground">Billable</span>
                </label>
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-muted-foreground">Hours:</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.25"
                    value={task.estimatedHours ?? ""}
                    onChange={(e) => handlePricingUpdate(task.id, "estimatedHours", parseFloat(e.target.value) || 0)}
                    className="h-5 w-14 text-[11px] text-right px-1 rounded"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-muted-foreground">€/hr:</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.50"
                    value={task.hourlyRate ?? defaultHourlyRate}
                    onChange={(e) => handlePricingUpdate(task.id, "hourlyRate", parseFloat(e.target.value) || 0)}
                    className="h-5 w-14 text-[11px] text-right px-1 rounded"
                  />
                </div>
                {task.billable && task.estimatedHours && parseFloat(task.estimatedHours) > 0 && (
                  <span className="ml-auto text-muted-foreground tabular-nums">
                    €{(parseFloat(task.estimatedHours) * parseFloat(task.hourlyRate ?? String(defaultHourlyRate))).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
          {billableTasks.length > 0 && totalEstimatedHours > 0 && (
            <div className="flex items-center justify-between pt-1.5 border-t border-border/30 text-[11px] text-muted-foreground">
              <span>{billableTasks.length} billable task{billableTasks.length !== 1 ? "s" : ""}</span>
              <span className="tabular-nums font-medium">{totalEstimatedHours}h estimated</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tasks yet. Add tasks for the technicians.</p>
      )}
    </div>
  );
}
