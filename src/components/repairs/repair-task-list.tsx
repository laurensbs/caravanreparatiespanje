"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRepairTask, deleteRepairTask, approveGarageTask, getRepairTasks } from "@/actions/garage";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { Plus, Trash2, CheckCircle, Wrench } from "lucide-react";
import { toast } from "sonner";

interface Props {
  repairJobId: string;
  initialTasks: RepairTask[];
}

export function RepairTaskList({ repairJobId, initialTasks }: Props) {
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

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Wrench className="h-4 w-4 text-blue-500" />
            Garage Tasks
            {tasks.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-1">
                {doneCount}/{tasks.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Add form */}
        {showAdd && (
          <div className="flex gap-2 mb-3">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task name..."
              className="h-8 text-sm rounded-lg"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={isPending || !newTitle.trim()}>
              Add
            </Button>
          </div>
        )}

        {/* Task list */}
        {tasks.length > 0 ? (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  task.status === "problem" ? "border-red-200 bg-red-50/50" : ""
                } ${task.status === "done" ? "opacity-60" : ""}`}
              >
                <span className="text-xs">
                  {task.status === "done" ? "✓" : task.status === "problem" ? "⚠" : task.status === "in_progress" ? "◐" : "○"}
                </span>
                <span className={`flex-1 truncate ${task.status === "done" ? "line-through" : ""}`}>
                  {task.title}
                </span>
                <Badge className={`text-[10px] ${TASK_STATUS_COLORS[task.status as RepairTaskStatus]}`}>
                  {TASK_STATUS_LABELS[task.status as RepairTaskStatus]}
                </Badge>
                {task.source === "garage" && !task.approvedAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-green-700"
                    onClick={() => handleApprove(task.id)}
                    title="Approve"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
                {task.problemCategory && (
                  <span className="text-xs text-red-600" title={task.problemNote ?? undefined}>
                    {task.problemCategory.replace("_", " ")}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(task.id)}
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No garage tasks yet. Add tasks for the technicians to work on.</p>
        )}
      </CardContent>
    </Card>
  );
}
