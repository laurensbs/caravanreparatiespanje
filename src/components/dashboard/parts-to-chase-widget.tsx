"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  PhoneCall,
  Clock,
  Loader2,
  RefreshCw,
  Package,
  ExternalLink,
} from "lucide-react";
import {
  listPartsToChase,
  markPartRequestChased,
  type PartsToChaseRow,
} from "@/actions/parts";
import { cn } from "@/lib/utils";

/**
 * Live "Parts to chase" inbox for the admin dashboard. Mirrors the
 * tone of the existing tool-requests widget but with a different goal:
 * surface part_requests that have been sitting open too long (>=3d) or
 * are past their expected delivery, AND haven't been chased in 24h.
 *
 * Polls every 60s — slower than the workshop widget because parts move
 * on a much longer timescale (days, not minutes).
 */

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function PartsToChaseWidget({
  initialRows,
}: {
  initialRows: PartsToChaseRow[];
}) {
  const [rows, setRows] = useState<PartsToChaseRow[]>(initialRows);
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const next = await listPartsToChase();
      setRows(next);
    } catch {
      // ignore — keep last known
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChased(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await markPartRequestChased(id);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not save");
        refresh();
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Package className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Parts to chase
          </h2>
          {rows.length > 0 ? (
            <span
              className={cn(
                "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                rows.some(
                  (r) =>
                    r.expectedDelivery &&
                    new Date(r.expectedDelivery).getTime() < Date.now(),
                )
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
              )}
            >
              {rows.length}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/parts"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open Part requests"
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
            aria-label="Refresh"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p>All clear — no parts overdue or stale.</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Parts that have been waiting 3+ days, or are past their expected
            delivery, will appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => {
            const created = new Date(r.createdAt);
            const overdue =
              r.expectedDelivery &&
              new Date(r.expectedDelivery).getTime() < Date.now();
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {r.partName}
                        {r.quantity > 1 ? (
                          <span className="ml-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                            ×{r.quantity}
                          </span>
                        ) : null}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                          overdue
                            ? "bg-red-500/15 text-red-700 dark:text-red-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {overdue ? "overdue" : timeAgo(created)}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                        {r.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.repairJobId ? (
                        <Link
                          href={`/repairs/${r.repairJobId}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {r.unitRegistration || r.jobRef || "—"}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/70">
                          no repair link
                        </span>
                      )}
                      {r.customerName ? (
                        <>
                          <span className="mx-1.5">·</span>
                          <span>{r.customerName}</span>
                        </>
                      ) : null}
                      {r.supplierName ? (
                        <>
                          <span className="mx-1.5">·</span>
                          <span>via {r.supplierName}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handleChased(r.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 active:scale-95 dark:text-emerald-300"
                      title="I've chased the supplier — hide for 24h"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      Chased
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
