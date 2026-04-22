"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Package, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPartRequest } from "@/actions/parts";
import { addRepairTask } from "@/actions/garage";

type Mode = "part" | "task";

/**
 * "Extra work needed" dialog opened from a service row. Lets the user
 * either spawn a part request (flips the repair to waiting_parts via
 * existing createPartRequest logic) or a new repair task with a
 * prefilled title referencing the parent service.
 */
export function ServiceExtraWorkDialog({
  open,
  onClose,
  repairJobId,
  serviceName,
}: {
  open: boolean;
  onClose: () => void;
  repairJobId: string;
  serviceName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("part");
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [taskTitle, setTaskTitle] = useState(`Extra work from service: ${serviceName}`);
  const [taskDescription, setTaskDescription] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setMode("part");
    setPartName("");
    setPartQty(1);
    setTaskTitle(`Extra work from service: ${serviceName}`);
    setTaskDescription("");
  }

  async function handleSave() {
    if (mode === "part") {
      const trimmed = partName.trim();
      if (!trimmed) {
        toast.error("Part name is required");
        return;
      }
      start(async () => {
        try {
          await createPartRequest({
            repairJobId,
            partName: trimmed,
            quantity: Math.max(1, partQty),
            notes: `Added from service: ${serviceName}`,
            status: "requested",
            spawnedFromServiceName: serviceName,
          });
          toast.success("Part requested — repair flipped to waiting parts");
          reset();
          onClose();
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
        }
      });
    } else {
      const trimmed = taskTitle.trim();
      if (!trimmed) {
        toast.error("Task title is required");
        return;
      }
      start(async () => {
        try {
          await addRepairTask(repairJobId, {
            title: trimmed,
            description: taskDescription.trim() || `Spawned from service: ${serviceName}`,
            spawnedFromServiceName: serviceName,
          });
          toast.success("Task added");
          reset();
          onClose();
          router.refresh();
        } catch (e) {
          toast.error((e as Error).message);
        }
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extra work from "{serviceName}"</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("part")}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
              mode === "part"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
                : "border-border text-muted-foreground hover:bg-muted/60 dark:hover:bg-foreground/[0.04]",
            )}
          >
            <Package className="h-4 w-4" />
            Part needed
          </button>
          <button
            type="button"
            onClick={() => setMode("task")}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
              mode === "task"
                ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
                : "border-border text-muted-foreground hover:bg-muted/60 dark:hover:bg-foreground/[0.04]",
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Extra task
          </button>
        </div>

        {mode === "part" ? (
          <div className="space-y-3">
            <div>
              <Label>Part name</Label>
              <Input
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="e.g. refrigerant R134a refill"
                autoFocus
              />
            </div>
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={partQty}
                onChange={(e) => setPartQty(parseInt(e.target.value) || 1)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a part request and moves this repair to "waiting parts" until it's marked received.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Task title</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Adds a new repair task. Will show up in the Garage task list for the technicians.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
