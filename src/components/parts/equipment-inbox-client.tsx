"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Wrench, Check, X, RotateCcw, Inbox } from "lucide-react";
import {
  resolveToolRequest,
  cancelToolRequest,
  reopenToolRequest,
  type ToolRequestRow,
} from "@/actions/tool-requests";
import { VoicePlayer } from "@/components/voice-player";
import { cn } from "@/lib/utils";

/**
 * Admin inbox for the workshop's "I need this in the garage" requests.
 * This is the same data the dashboard widget shows, just with a segmented
 * Open / Resolved view and a bit more breathing room. The garage iPad
 * creates the rows; the office acts on them here.
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

type Tab = "open" | "resolved";

export function EquipmentInboxClient({
  initialRows,
}: {
  initialRows: ToolRequestRow[];
}) {
  const [rows, setRows] = useState<ToolRequestRow[]>(initialRows);
  const [tab, setTab] = useState<Tab>(() => {
    const hasOpen = initialRows.some((r) => r.status === "open");
    return hasOpen ? "open" : "open";
  });
  const [, startTransition] = useTransition();

  const openRows = useMemo(() => rows.filter((r) => r.status === "open"), [rows]);
  const resolvedRows = useMemo(
    () => rows.filter((r) => r.status === "resolved" || r.status === "cancelled"),
    [rows],
  );
  const visible = tab === "open" ? openRows : resolvedRows;

  function patch(id: string, next: Partial<ToolRequestRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }

  function handleResolve(id: string) {
    patch(id, { status: "resolved", resolvedAt: new Date() });
    startTransition(async () => {
      try {
        await resolveToolRequest({ id });
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not resolve");
        patch(id, { status: "open", resolvedAt: null });
      }
    });
  }

  function handleCancel(id: string) {
    patch(id, { status: "cancelled", resolvedAt: new Date() });
    startTransition(async () => {
      try {
        await cancelToolRequest(id);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not cancel");
        patch(id, { status: "open", resolvedAt: null });
      }
    });
  }

  function handleReopen(id: string) {
    patch(id, { status: "open", resolvedAt: null });
    startTransition(async () => {
      try {
        await reopenToolRequest(id);
      } catch (err) {
        toast.error((err as Error)?.message ?? "Could not reopen");
        patch(id, { status: "resolved" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Wrench className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              Workshop requests
            </h3>
            <p className="text-xs text-muted-foreground">
              Tool, supply and "hand needed" asks from the garage iPad.
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Filter requests"
          className="inline-flex w-full shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/60 p-1 backdrop-blur-md sm:w-auto"
        >
          {(
            [
              { id: "open" as const, label: "Open", count: openRows.length },
              {
                id: "resolved" as const,
                label: "Resolved",
                count: resolvedRows.length,
              },
            ]
          ).map((seg) => {
            const active = tab === seg.id;
            return (
              <button
                key={seg.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(seg.id)}
                className={cn(
                  "flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:flex-none",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{seg.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
                    active
                      ? "bg-background/20 text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {seg.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/15 py-12 text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-foreground/[0.06] to-transparent text-muted-foreground ring-1 ring-border/60">
            <Inbox className="h-5 w-5 opacity-70" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1 px-2">
            <p className="text-sm font-medium text-foreground">
              {tab === "open"
                ? "No open requests"
                : "Nothing closed yet"}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {tab === "open"
                ? "Workers send a request from the garage iPad with the wrench button — they'll appear here instantly."
                : "Resolved and cancelled requests will show up here."}
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {visible.map((r) => (
            <li key={r.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[14px] font-medium leading-snug text-foreground">
                    {r.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
                    {r.status === "resolved" && r.resolvedByName ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          resolved by {r.resolvedByName}
                        </span>
                      </>
                    ) : null}
                    {r.status === "cancelled" ? (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className="text-muted-foreground">cancelled</span>
                      </>
                    ) : null}
                  </p>
                  {r.voiceNote ? (
                    <div className="pt-1">
                      <VoicePlayer
                        url={r.voiceNote.url}
                        durationSeconds={r.voiceNote.durationSeconds}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-1">
                  {r.status === "open" ? (
                    <>
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
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReopen(r.id)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-muted px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground active:scale-95"
                      title="Reopen"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
