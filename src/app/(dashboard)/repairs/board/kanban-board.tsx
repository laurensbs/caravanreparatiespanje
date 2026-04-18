"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undo-toast";
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

type OptimisticAction = { jobId: string; nextStatus: RepairStatus };

export function KanbanBoard({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<RepairStatus | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRaf = useRef<number | null>(null);

  // Optimistic — applied instantly so the card jumps before the server
  // round-trip resolves. Reducer just patches the matching job.
  const [optimisticJobs, applyOptimistic] = useOptimistic<Job[], OptimisticAction>(
    jobs,
    (state, action) =>
      state.map((j) => (j.id === action.jobId ? { ...j, status: action.nextStatus } : j)),
  );

  const jobsByStatus = BOARD_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = optimisticJobs.filter((j) => j.status === status);
      return acc;
    },
    {} as Record<RepairStatus, Job[]>,
  );

  const handleDragStart = useCallback((e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(jobId);
  }, []);

  // Auto-scroll the column container while dragging at the horizontal edges.
  // Uses requestAnimationFrame so it stays smooth even on slow Chrome.
  const stopAutoScroll = useCallback(() => {
    if (autoScrollRaf.current != null) {
      cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    }
  }, []);

  const maybeAutoScroll = useCallback((clientX: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const EDGE = 80;
    const MAX_SPEED = 18;
    let dx = 0;
    if (clientX < rect.left + EDGE) {
      dx = -((rect.left + EDGE - clientX) / EDGE) * MAX_SPEED;
    } else if (clientX > rect.right - EDGE) {
      dx = ((clientX - (rect.right - EDGE)) / EDGE) * MAX_SPEED;
    }
    if (dx === 0) {
      stopAutoScroll();
      return;
    }
    if (autoScrollRaf.current != null) return;
    const tick = () => {
      el.scrollLeft += dx;
      autoScrollRaf.current = requestAnimationFrame(tick);
    };
    autoScrollRaf.current = requestAnimationFrame(tick);
  }, [stopAutoScroll]);

  const handleDragOver = useCallback((e: React.DragEvent, status: RepairStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
    maybeAutoScroll(e.clientX);
  }, [maybeAutoScroll]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, newStatus: RepairStatus) => {
      e.preventDefault();
      stopAutoScroll();
      const jobId = e.dataTransfer.getData("text/plain");
      setDraggingId(null);
      setDropTarget(null);

      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.status === newStatus) return;
      const previousStatus = job.status;

      startTransition(async () => {
        applyOptimistic({ jobId, nextStatus: newStatus });
        const res = await updateRepairJob(jobId, { status: newStatus });
        if (!res.ok) {
          toast.error(res.message);
          // Optimistic snaps back automatically because router.refresh below
          // (or absence of confirmation) re-pulls server state.
          router.refresh();
          return;
        }
        toastWithUndo(
          "Status updated",
          async () => {
            const undoRes = await updateRepairJob(jobId, { status: previousStatus });
            if (!undoRes.ok) throw new Error(undoRes.message);
            router.refresh();
          },
          { description: `${job.publicCode ?? job.title ?? "Job"} → ${STATUS_LABELS[newStatus]}` },
        );
        router.refresh();
      });
    },
    [jobs, router, applyOptimistic, stopAutoScroll],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  const PRIORITY_DOT: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-500",
    normal: "bg-foreground/40",
    low: "bg-muted-foreground/40",
  };

  return (
    <div
      ref={scrollContainerRef}
      className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden"
    >
      {BOARD_COLUMNS.map((status) => (
        <div
          key={status}
          className={`flex min-w-[min(260px,calc(100vw-2.5rem))] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl border border-border/60 bg-muted/30 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            dropTarget === status
              ? "border-foreground/40 bg-muted/70 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.20)] scale-[1.01]"
              : ""
          }`}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, status)}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
            <Badge
              variant="secondary"
              className={`${STATUS_COLORS[status]} h-5 rounded-md px-2 text-[11px]`}
            >
              {STATUS_LABELS[status]}
            </Badge>
            <span className="tabular-nums text-[11px] font-medium text-muted-foreground">
              {jobsByStatus[status]?.length ?? 0}
            </span>
          </div>
          <div className="flex-1 space-y-2 p-2">
            {/* Drop indicator line — visible at the top of the target column */}
            {dropTarget === status && draggingId && (
              <div
                aria-hidden
                className="h-0.5 w-full rounded-full bg-foreground/60 shadow-[0_0_8px_0_rgba(0,0,0,0.20)] animate-pulse"
              />
            )}
            {(jobsByStatus[status] ?? []).map((job, idx) => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleDragStart(e, job.id)}
                onDragEnd={handleDragEnd}
                style={{ animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                className={`group relative min-h-[4.5rem] cursor-grab touch-manipulation rounded-xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] opacity-0 animate-[fadeUp_320ms_ease-out_forwards] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-foreground/15 hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.18)] active:cursor-grabbing ${
                  draggingId === job.id ? "opacity-40 scale-95 rotate-1" : ""
                }`}
                onClick={() => router.push(`/repairs/${job.id}`)}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${PRIORITY_DOT[job.priority] ?? "bg-muted-foreground/40"}`}
                  />
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {job.publicCode}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm font-medium leading-tight tracking-[-0.005em]">
                  {job.title}
                </p>
                {(job.customerName || job.locationName) && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {[job.customerName, job.locationName].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
            ))}
            {(jobsByStatus[status] ?? []).length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground/60">
                No jobs
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
