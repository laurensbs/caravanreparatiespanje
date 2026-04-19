"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Wrench, Check, X, Loader2, RefreshCw } from "lucide-react";
import {
  listToolRequests,
  resolveToolRequest,
  cancelToolRequest,
  type ToolRequestRow,
} from "@/actions/tool-requests";
import { VoicePlayer } from "@/components/voice-player";

export { VoicePlayer };

/**
 * Live inbox widget for "garage needs a tool" requests. Shown on the
 * dashboard so the office sees them next to the existing garage attention
 * widget. Polls every 20s; that's frequent enough to feel real-time
 * without hammering the DB. Mark resolved with a single tap.
 */

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function ToolRequestsWidget({
  initialRows,
}: {
  initialRows: ToolRequestRow[];
}) {
  const [rows, setRows] = useState<ToolRequestRow[]>(initialRows);
  const [refreshing, setRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const next = await listToolRequests("open");
      setRows(next);
    } catch {
      // ignore — keep last known
    } finally {
      setRefreshing(false);
    }
  }

  // Poll every 20s — visible to anyone on the dashboard.
  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, 20_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleResolve(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await resolveToolRequest({ id });
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not resolve");
        refresh();
      }
    });
  }

  function handleCancel(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await cancelToolRequest(id);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not cancel");
        refresh();
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Wrench className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Workshop tool requests
          </h2>
          {rows.length > 0 ? (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {rows.length}
            </span>
          ) : null}
        </div>
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
      </header>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p>No open requests from the workshop.</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            They'll appear here the moment a worker taps the wrench button.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {r.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.requestedByName ? (
                      <span className="font-medium text-foreground/70">
                        {r.requestedByName}
                      </span>
                    ) : (
                      "Workshop"
                    )}
                    <span className="mx-1.5">·</span>
                    {timeAgo(r.createdAt)}
                    {r.repairJob ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <Link
                          href={`/repairs/${r.repairJob.id}`}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {r.repairJob.unitRegistration ||
                            r.repairJob.publicCode ||
                            "—"}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  {r.voiceNote ? (
                    <div className="mt-2">
                      <VoicePlayer
                        url={r.voiceNote.url}
                        durationSeconds={r.voiceNote.durationSeconds}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => handleResolve(r.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 active:scale-95 dark:text-emerald-300"
                    title="Mark as handled"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground active:scale-95"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

