"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { toast } from "sonner";
import { updateRepairJob } from "@/actions/repairs";

interface Job {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: RepairStatus;
  priority: string;
  customerName?: string | null;
  locationName?: string | null;
}

const BOARD_COLUMNS: RepairStatus[] = [
  "new",
  "in_inspection",
  "no_damage",
  "quote_needed",
  "waiting_customer",
  "scheduled",
  "in_progress",
  "waiting_parts",
  "blocked",
  "completed",
  "invoiced",
  "rejected",
  "archived",
];

export function KanbanBoard({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<RepairStatus | null>(null);

  const jobsByStatus = BOARD_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = jobs.filter((j) => j.status === status);
      return acc;
    },
    {} as Record<RepairStatus, Job[]>
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, jobId: string) => {
      e.dataTransfer.setData("text/plain", jobId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingId(jobId);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, status: RepairStatus) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(status);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStatus: RepairStatus) => {
      e.preventDefault();
      const jobId = e.dataTransfer.getData("text/plain");
      setDraggingId(null);
      setDropTarget(null);

      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.status === newStatus) return;

      const res = await updateRepairJob(jobId, { status: newStatus });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      router.refresh();
    },
    [jobs, router]
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const PRIORITY_DOT: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    normal: "bg-blue-500",
    low: "bg-gray-400",
  };

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden">
      {BOARD_COLUMNS.map((status) => (
        <div
          key={status}
          className={`flex min-w-[min(260px,calc(100vw-2.5rem))] max-w-[300px] shrink-0 snap-start flex-col rounded-lg border bg-muted/30 transition-colors ${
            dropTarget === status ? "border-primary bg-primary/5" : ""
          }`}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="flex items-center gap-2 border-b p-3">
            <Badge
              variant="secondary"
              className={STATUS_COLORS[status]}
            >
              {STATUS_LABELS[status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {jobsByStatus[status]?.length ?? 0}
            </span>
          </div>
          <div className="flex-1 space-y-2 p-2">
            {(jobsByStatus[status] ?? []).map((job) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleDragStart(e, job.id)}
                onDragEnd={handleDragEnd}
                className={`min-h-[4.5rem] cursor-grab touch-manipulation rounded-lg border bg-background p-3 shadow-sm transition-opacity hover:shadow-md active:cursor-grabbing ${
                  draggingId === job.id ? "opacity-50" : ""
                }`}
                onClick={() => router.push(`/repairs/${job.id}`)}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${PRIORITY_DOT[job.priority] ?? "bg-gray-400"}`}
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {job.publicCode}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight line-clamp-2">
                  {job.title}
                </p>
                {(job.customerName || job.locationName) && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {[job.customerName, job.locationName]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
              </div>
            ))}
            {(jobsByStatus[status] ?? []).length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No jobs
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
