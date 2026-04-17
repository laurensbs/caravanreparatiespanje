"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { bulkUpdateRepairJobs, bulkDeleteRepairJobs, bulkRestoreRepairJobs } from "@/actions/repairs";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";
import { X, Check, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toastWithUndo } from "@/lib/undo-toast";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string>("");
  const [value, setValue] = useState<string>("");

  async function handleApply() {
    if (!action || !value) return;
    setLoading(true);

    try {
      const updateData: Record<string, unknown> = { ids: selectedIds };

      if (action === "status") updateData.status = value;
      else if (action === "priority") updateData.priority = value;
      else if (action === "archive") updateData.archivedAt = value === "true" ? new Date().toISOString() : null;

      await bulkUpdateRepairJobs(updateData);
      toast.success(`Updated ${selectedIds.length} job${selectedIds.length > 1 ? "s" : ""}`);
      onClear();
      router.refresh();
    } catch {
      toast.error("Failed to apply bulk update");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkDelete() {
    const n = selectedIds.length;
    const ok = await confirmDialog({
      title: `Move ${n} repair job${n > 1 ? "s" : ""} to the bin?`,
      description: "You can restore them from the bin later.",
      confirmLabel: "Move to bin",
      tone: "destructive",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const ids = [...selectedIds];
      await bulkDeleteRepairJobs(ids);
      toastWithUndo(
        `Moved ${ids.length} repair job${ids.length > 1 ? "s" : ""} to bin`,
        async () => {
          await bulkRestoreRepairJobs(ids);
          router.refresh();
        },
      );
      onClear();
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  const valueOptions = action === "status"
    ? Object.entries(STATUS_LABELS)
    : action === "priority"
      ? Object.entries(PRIORITY_LABELS)
      : action === "archive"
        ? [["true", "Archive"], ["false", "Unarchive"]]
        : [];

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>

      <Select value={action} onValueChange={(val) => { setAction(val); setValue(""); }}>
        <SelectTrigger className="h-10 w-full touch-manipulation sm:h-9 sm:w-40">
          <SelectValue placeholder="Action..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="status">Change status</SelectItem>
          <SelectItem value="priority">Change priority</SelectItem>
          <SelectItem value="archive">Archive / Unarchive</SelectItem>
        </SelectContent>
      </Select>

      {action && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-10 w-full touch-manipulation sm:h-9 sm:w-44">
            <SelectValue placeholder="Select value..." />
          </SelectTrigger>
          <SelectContent>
            {valueOptions.map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {action && value && (
        <Button size="sm" className="min-h-10 w-full touch-manipulation sm:min-h-9 sm:w-auto" onClick={handleApply} disabled={loading}>
          {loading ? <Spinner className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
          Apply
        </Button>
      )}

      <div className="flex items-center gap-2 sm:contents">
        <Button variant="ghost" size="sm" className="min-h-10 flex-1 touch-manipulation sm:min-h-9 sm:flex-initial" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="min-h-10 flex-1 touch-manipulation text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto sm:min-h-9 sm:flex-initial"
          onClick={handleBulkDelete}
          disabled={loading}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
