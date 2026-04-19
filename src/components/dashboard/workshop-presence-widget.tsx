"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, RefreshCw, Loader2 } from "lucide-react";
import {
  listWorkshopPresence,
  type WorkshopPresenceRow,
} from "@/actions/workshop-presence";

/**
 * Live "in the garage right now" widget for the office dashboard.
 * Polls every 30s — frequent enough to feel current, light enough not
 * to hammer the DB. Each row shows the worker, the repair they're on,
 * and how long they've been at it. Clicking a row jumps to the repair.
 */

function elapsed(start: Date | string): string {
  const ts = typeof start === "string" ? new Date(start).getTime() : start.getTime();
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function WorkshopPresenceWidget({
  initialRows,
}: {
  initialRows: WorkshopPresenceRow[];
}) {
  const [rows, setRows] = useState<WorkshopPresenceRow[]>(initialRows);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);

  // Tick once a minute so the elapsed labels refresh without us
  // re-fetching server data.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const next = await listWorkshopPresence();
      setRows(next);
    } finally {
      setRefreshing(false);
    }
  }

  // Live polling; pause when the tab isn't visible to keep things calm.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Group by job so two technicians on the same repair show as one row
  // with both names — usually clearer than stacking duplicates.
  const grouped = (() => {
    const m = new Map<string, { row: WorkshopPresenceRow; names: string[]; oldestStart: Date }>();
    for (const r of rows) {
      const ex = m.get(r.repairJobId);
      const startDate = typeof r.startedAt === "string" ? new Date(r.startedAt) : r.startedAt;
      if (ex) {
        if (r.userName) ex.names.push(r.userName);
        if (startDate < ex.oldestStart) ex.oldestStart = startDate;
      } else {
        m.set(r.repairJobId, {
          row: r,
          names: r.userName ? [r.userName] : [],
          oldestStart: startDate,
        });
      }
    }
    return Array.from(m.values()).sort(
      (a, b) => a.oldestStart.getTime() - b.oldestStart.getTime(),
    );
  })();

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 dark:border-border dark:bg-card/[0.03]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {grouped.length > 0 ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            ) : null}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                grouped.length > 0 ? "bg-emerald-500" : "bg-muted-foreground/30"
              }`}
            />
          </span>
          <h3 className="text-sm font-semibold text-foreground">
            In the garage now
          </h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {grouped.length}
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Refresh"
          title="Refresh"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-6 text-center dark:border-border">
          <Wrench className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground/70">
            No active timers right now
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {grouped.map(({ row, names, oldestStart }) => {
            const label =
              row.registration ??
              row.publicCode ??
              row.title ??
              "Repair";
            return (
              <li key={row.repairJobId}>
                <Link
                  href={`/repairs/${row.repairJobId}`}
                  className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2 transition-colors hover:bg-muted dark:bg-foreground/[0.03] dark:hover:bg-foreground/[0.06]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-sm font-semibold text-foreground">
                        {label}
                      </span>
                      {row.customerName ? (
                        <span className="truncate text-[11px] text-muted-foreground">
                          · {row.customerName}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {names.length > 0 ? names.join(", ") : "Unknown"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/15 px-2 py-1 font-mono text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {elapsed(oldestStart)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
