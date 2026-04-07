"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { bulkUpdateRepairJobs } from "@/actions/repairs";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";
import { X, Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

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

  const valueOptions = action === "status"
    ? Object.entries(STATUS_LABELS)
    : action === "priority"
      ? Object.entries(PRIORITY_LABELS)
      : action === "archive"
        ? [["true", "Archive"], ["false", "Unarchive"]]
        : [];

  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>

      <Select value={action} onValueChange={(val) => { setAction(val); setValue(""); }}>
        <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-44">
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
        <Button size="sm" onClick={handleApply} disabled={loading}>
          {loading ? <Spinner className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
          Apply
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
