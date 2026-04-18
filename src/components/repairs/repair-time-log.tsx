"use client";

import { useState, useEffect, useTransition } from "react";
import { Clock, Play, Square, Trash2, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { getJobTimeEntries, getJobActiveTimers, createManualTimeEntry, deleteTimeEntry } from "@/actions/time-entries";
import { toast } from "sonner";

type TimeEntry = Awaited<ReturnType<typeof getJobTimeEntries>>[number];
type ActiveTimer = Awaited<ReturnType<typeof getJobActiveTimers>>[number];

interface RepairTimeLogProps {
  repairJobId: string;
  timeEntries: TimeEntry[];
  activeTimers: ActiveTimer[];
  activeUsers: { id: string; name: string; role: string }[];
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function RepairTimeLog({ repairJobId, timeEntries, activeTimers, activeUsers }: RepairTimeLogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addMinutes, setAddMinutes] = useState("");
  const [addNote, setAddNote] = useState("");

  // Totals
  const totalRounded = timeEntries.reduce((acc, e) => acc + (e.roundedMinutes ?? 0), 0);
  const totalRaw = timeEntries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);

  // Per-user breakdown
  const byUser = new Map<string, { name: string; rounded: number; raw: number; count: number }>();
  for (const e of timeEntries) {
    const key = e.userId;
    const existing = byUser.get(key) ?? { name: e.userName ?? "Unknown", rounded: 0, raw: 0, count: 0 };
    existing.rounded += e.roundedMinutes ?? 0;
    existing.raw += e.durationMinutes ?? 0;
    existing.count += 1;
    byUser.set(key, existing);
  }

  function handleAdd() {
    if (!addUserId || !addMinutes) return;
    const mins = parseInt(addMinutes, 10);
    if (isNaN(mins) || mins <= 0) return;
    startTransition(async () => {
      await createManualTimeEntry({
        repairJobId,
        userId: addUserId,
        minutes: mins,
        note: addNote || undefined,
      });
      setShowAdd(false);
      setAddUserId("");
      setAddMinutes("");
      setAddNote("");
      toast.success("Time entry added");
      router.refresh();
    });
  }

  function handleDelete(entryId: string) {
    startTransition(async () => {
      await deleteTimeEntry(entryId);
      toast.success("Time entry removed");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground uppercase tracking-wider font-semibold">Billable</p>
          <p className="text-lg font-bold text-foreground dark:text-foreground tabular-nums">
            {formatMinutes(totalRounded)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground uppercase tracking-wider font-semibold">Actual</p>
          <p className="text-lg font-bold text-muted-foreground dark:text-muted-foreground/70 tabular-nums">
            {formatMinutes(totalRaw)}
          </p>
        </div>
        {activeTimers.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {activeTimers.map((t) => t.userName).join(", ")} working
            </span>
          </div>
        )}
      </div>

      {/* Per-user breakdown */}
      {byUser.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(byUser.entries()).map(([userId, data]) => (
            <div
              key={userId}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted dark:bg-foreground/[0.08] px-3 py-1 text-xs font-medium text-foreground/90 dark:text-muted-foreground/50"
            >
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-foreground/[0.10] dark:bg-foreground/[0.10] text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/70">
                {data.name.charAt(0).toUpperCase()}
              </span>
              {data.name.split(" ")[0]} · {formatMinutes(data.rounded)}
            </div>
          ))}
        </div>
      )}

      {/* Entries list */}
      {timeEntries.length > 0 && (
        <div className="space-y-1">
          {timeEntries.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-center gap-3 text-sm py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted/40 dark:hover:bg-foreground/[0.10]/50 transition-colors"
            >
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted dark:bg-foreground/[0.08] text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/70 shrink-0">
                {(entry.userName ?? "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground/90 dark:text-muted-foreground/50">
                  {(entry.userName ?? "Unknown").split(" ")[0]}
                </span>
                <span className="text-muted-foreground/70 mx-1.5">·</span>
                <span className="text-muted-foreground dark:text-muted-foreground/70 tabular-nums">
                  {entry.endedAt
                    ? `${formatTime(entry.startedAt)}–${formatTime(entry.endedAt)}`
                    : `${formatTime(entry.startedAt)}–...`}
                </span>
                <span className="text-muted-foreground/70 mx-1.5">·</span>
                <span className="text-muted-foreground/70 text-xs">{formatDate(entry.startedAt)}</span>
                {entry.note && (
                  <span className="text-muted-foreground/70 text-xs ml-2 italic">{entry.note}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-muted-foreground dark:text-muted-foreground/50 tabular-nums min-w-[40px] text-right">
                {entry.roundedMinutes ? formatMinutes(entry.roundedMinutes) : "—"}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                entry.source === "manual"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-muted text-muted-foreground dark:bg-foreground/[0.08] dark:text-muted-foreground/70"
              }`}>
                {entry.source === "manual" ? "manual" : "timer"}
              </span>
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={isPending}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-red-500 dark:hover:text-red-400 transition-all"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add manual entry */}
      {showAdd ? (
        <div className="rounded-xl border border-border dark:border-border p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="col-span-1 rounded-lg border border-border dark:border-border bg-card dark:bg-card/5 px-2 py-1.5 text-sm"
            >
              <option value="">Technician...</option>
              {activeUsers
                .filter((u) => u.role === "technician")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <input
              type="number"
              value={addMinutes}
              onChange={(e) => setAddMinutes(e.target.value)}
              placeholder="Minutes"
              min="1"
              className="col-span-1 rounded-lg border border-border dark:border-border bg-card dark:bg-card/5 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              placeholder="Note (optional)"
              className="col-span-1 rounded-lg border border-border dark:border-border bg-card dark:bg-card/5 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 text-xs font-medium text-muted-foreground py-1.5 hover:text-foreground/90 dark:hover:text-muted-foreground/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!addUserId || !addMinutes || isPending}
              className="flex-1 text-xs font-medium text-white bg-foreground dark:bg-muted dark:text-foreground rounded-lg py-1.5 hover:bg-foreground/90 dark:hover:bg-foreground/[0.15] transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/50 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add manual entry
        </button>
      )}
    </div>
  );
}
