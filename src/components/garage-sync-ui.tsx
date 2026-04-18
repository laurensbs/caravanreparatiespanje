"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  ClipboardCheck,
  AlertTriangle,
  Package,
  MessageSquare,
  Wrench,
  Camera,
  Timer,
  ChevronRight,
  ArrowRight,
  Ban,
  CheckCircle,
  Search,
  Zap,
  Clock,
  ChevronDown,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface SyncState {
  garageLastUpdateAt: Date | string | null;
  garageLastUpdateType: string | null;
  garageNeedsAdminAttention: boolean;
  garageUnreadUpdatesCount: number;
  lastUpdatedByName: string | null;
  status: string;
  finalCheckStatus: string | null;
  recentEvents: {
    eventType: string;
    comment: string | null;
    userName: string | null;
    createdAt: Date | string;
    newValue?: string | null;
  }[];
}

interface ActivityEvent {
  id: string;
  eventType: string;
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  comment: string | null;
  createdAt: Date | string;
  userName: string | null;
  userId: string | null;
}

interface AttentionItem {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  garageLastUpdateType: string | null;
  garageLastUpdateAt: Date | string | null;
  garageNeedsAdminAttention: boolean;
  garageUnreadUpdatesCount: number;
  customerName: string | null;
  locationName: string | null;
  lastUpdatedByName: string | null;
}

interface AttentionData {
  counts: {
    readyForCheck: number;
    blocked: number;
    partsRequested: number;
  };
  items: AttentionItem[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC STRIP — compact bar for repair detail page
// ═══════════════════════════════════════════════════════════════════════════

const UPDATE_TYPE_LABELS: Record<string, string> = {
  work_started: "Work started",
  task_completed: "Task completed",
  task_reopened: "Task reopened",
  issue_reported: "Issue reported",
  note_added: "Note added",
  photo_uploaded: "Photo uploaded",
  part_requested: "Part requested",
  task_suggested: "Task suggested",
  job_blocked: "Blocked",
  blocker_added: "Blocker reported",
  ready_for_check: "Ready for check",
  urgent_issue: "Urgent issue reported",
  timer_started: "Timer started",
  timer_logged: "Time logged",
};

function getStripStyle(updateType: string | null, status: string) {
  if (status === "ready_for_check") {
    return {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-100 dark:border-emerald-800/60",
      icon: <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    };
  }
  if (updateType === "part_requested" || updateType === "task_suggested") {
    return {
      bg: "bg-foreground/[0.04] dark:bg-foreground/[0.05]",
      border: "border-border/60",
      icon: <Package className="h-4 w-4 text-foreground/80" />,
      iconBg: "bg-foreground/[0.10]",
    };
  }
  if (
    updateType === "issue_reported" ||
    updateType === "urgent_issue" ||
    updateType === "job_blocked" ||
    updateType === "blocker_added"
  ) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-100 dark:border-amber-800/60",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
    };
  }
  return {
    bg: "bg-foreground/[0.04] dark:bg-foreground/[0.05]",
    border: "border-border/60",
    icon: <Wrench className="h-4 w-4 text-foreground/80" />,
    iconBg: "bg-foreground/[0.10]",
  };
}

export function GarageSyncStrip({ syncState }: { syncState: SyncState | null }) {
  if (!syncState) return null;
  if (
    !syncState.garageNeedsAdminAttention &&
    syncState.garageUnreadUpdatesCount === 0
  ) {
    return null;
  }

  const style = getStripStyle(syncState.garageLastUpdateType, syncState.status);
  const label =
    UPDATE_TYPE_LABELS[syncState.garageLastUpdateType ?? ""] ??
    "Garage update";

  const time = syncState.garageLastUpdateAt
    ? format(new Date(syncState.garageLastUpdateAt), "HH:mm")
    : null;

  // Build a summary from recent events
  const summary = syncState.recentEvents?.length
    ? buildSummary(syncState.recentEvents, syncState.lastUpdatedByName)
    : syncState.lastUpdatedByName
      ? `${syncState.lastUpdatedByName} — ${label.toLowerCase()}`
      : label;

  return (
    <div
      className={`rounded-2xl ${style.bg} border ${style.border} px-4 py-3 transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-8 w-8 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}
        >
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {summary}
          </p>
          {time && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {time}
              {syncState.garageUnreadUpdatesCount > 1 && (
                <span className="ml-2 text-muted-foreground/70">
                  · {syncState.garageUnreadUpdatesCount} updates
                </span>
              )}
            </p>
          )}
        </div>
        {syncState.garageUnreadUpdatesCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-foreground text-background text-[11px] font-bold px-1.5">
            {syncState.garageUnreadUpdatesCount}
          </span>
        )}
      </div>
    </div>
  );
}

function buildSummary(
  events: SyncState["recentEvents"],
  lastBy: string | null
): string {
  if (events.length === 0) return "Garage update received";

  const first = events[0];
  const name = first.userName?.split(" ")[0] ?? lastBy?.split(" ")[0] ?? "Garage";

  // Check for ready_for_check
  if (
    first.eventType === "status_changed" &&
    first.newValue === "ready_for_check"
  ) {
    return `${name} marked this repair ready for check`;
  }

  // Summarize mixed events
  const taskDone = events.filter(
    (e) => e.eventType === "task_status_changed" && e.comment?.includes("→ done")
  ).length;
  const partReq = events.filter((e) => e.eventType === "part_requested").length;
  const issues = events.filter(
    (e) =>
      e.eventType === "task_status_changed" &&
      e.comment?.includes("Problem")
  ).length;

  const parts: string[] = [];
  if (taskDone > 0) parts.push(`completed ${taskDone} task${taskDone > 1 ? "s" : ""}`);
  if (partReq > 0) parts.push(`requested ${partReq} part${partReq > 1 ? "s" : ""}`);
  if (issues > 0) parts.push(`reported ${issues} issue${issues > 1 ? "s" : ""}`);

  if (parts.length > 0) return `${name} ${parts.join(" and ")}`;

  // Fallback to first event comment
  if (first.comment) {
    const shortComment =
      first.comment.length > 60
        ? first.comment.slice(0, 57) + "…"
        : first.comment;
    return `${name}: ${shortComment}`;
  }

  return `${name} updated this repair`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GARAGE ACTIVITY TIMELINE — block for repair detail page
// ═══════════════════════════════════════════════════════════════════════════

const EVENT_ICON: Record<string, React.ReactNode> = {
  status_changed: <Wrench className="h-3.5 w-3.5" />,
  task_status_changed: <CheckCircle className="h-3.5 w-3.5" />,
  part_requested: <Package className="h-3.5 w-3.5" />,
  task_suggested: <Zap className="h-3.5 w-3.5" />,
  finding_added: <Search className="h-3.5 w-3.5" />,
  blocker_added: <Ban className="h-3.5 w-3.5" />,
  blocker_resolved: <CheckCircle className="h-3.5 w-3.5" />,
  finding_resolved: <CheckCircle className="h-3.5 w-3.5" />,
  final_check_passed: <ClipboardCheck className="h-3.5 w-3.5" />,
  final_check_failed: <AlertTriangle className="h-3.5 w-3.5" />,
  photo_uploaded: <Camera className="h-3.5 w-3.5" />,
  task_deleted: <Ban className="h-3.5 w-3.5" />,
};

const EVENT_DOT_COLOR: Record<string, string> = {
  status_changed: "text-foreground/80",
  task_status_changed: "text-emerald-500",
  part_requested: "text-purple-500",
  task_suggested: "text-amber-500",
  finding_added: "text-orange-500",
  blocker_added: "text-red-500",
  blocker_resolved: "text-emerald-500",
  finding_resolved: "text-emerald-500",
  final_check_passed: "text-emerald-500",
  final_check_failed: "text-red-500",
  photo_uploaded: "text-foreground/80",
  task_deleted: "text-muted-foreground/70",
};

export function GarageActivityTimeline({
  events,
  repairId,
  totalCount,
}: {
  events: ActivityEvent[];
  repairId: string;
  totalCount?: number;
}) {
  if (events.length === 0) return null;

  return (
    <div className="bg-card dark:bg-card rounded-2xl border border-border/60 dark:border-border shadow-sm overflow-hidden">
      <details>
        <summary className="px-5 py-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground dark:text-foreground flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground/70" />
            Garage Activity
            {(totalCount ?? events.length) > events.length && (
              <span className="text-xs font-normal text-muted-foreground/70">
                ({events.length} of {totalCount})
              </span>
            )}
          </h3>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 opacity-40" />
        </summary>
      <div className="px-5 pb-5 space-y-0">
        {events.map((event, i) => {
          const icon = EVENT_ICON[event.eventType] ?? (
            <Wrench className="h-3.5 w-3.5" />
          );
          const dotColor =
            EVENT_DOT_COLOR[event.eventType] ?? "text-muted-foreground/70";
          const name = event.userName?.split(" ")[0] ?? "System";
          const time = format(new Date(event.createdAt), "HH:mm");
          const dateStr = format(new Date(event.createdAt), "d MMM");

          // Clean up the comment for display
          let message = event.comment ?? event.eventType.replace(/_/g, " ");
          // Remove the status prefix if present
          if (message.startsWith("Task ")) {
            message = message; // keep task messages as-is
          }

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 py-2.5 group"
            >
              <div
                className={`mt-0.5 shrink-0 ${dotColor}`}
              >
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground/90 dark:text-muted-foreground/50 leading-snug">
                  <span className="font-medium text-foreground dark:text-foreground">
                    {name}
                  </span>{" "}
                  <span className="text-muted-foreground dark:text-muted-foreground/70">
                    {message}
                  </span>
                </p>
              </div>
              <span className="text-xs text-muted-foreground/70 dark:text-muted-foreground tabular-nums shrink-0 mt-0.5">
                {dateStr} · {time}
              </span>
            </div>
          );
        })}
      </div>
      </details>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD ATTENTION WIDGET — "Garage needs attention" card
// ═══════════════════════════════════════════════════════════════════════════

const ATTENTION_TYPE_LABEL: Record<string, string> = {
  ready_for_check: "Ready for check",
  part_requested: "Part requested",
  job_blocked: "Blocked",
  blocker_added: "Blocked",
  issue_reported: "Issue reported",
  urgent_issue: "Urgent issue",
  task_suggested: "Task suggested",
  note_added: "Note added",
};

const ATTENTION_TYPE_CHIP: Record<string, string> = {
  ready_for_check: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  part_requested: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  job_blocked: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  blocker_added: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  issue_reported: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  urgent_issue: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  task_suggested: "bg-foreground/[0.06] text-foreground/80",
};

export function GarageAttentionWidget({ data }: { data: AttentionData }) {
  const total =
    data.counts.readyForCheck + data.counts.blocked + data.counts.partsRequested;
  if (total === 0 && data.items.length === 0) return null;

  return (
    <div className="bg-card dark:bg-card rounded-2xl border border-border/60 dark:border-border shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground dark:text-foreground mb-4 flex items-center gap-2">
        <Wrench className="h-3.5 w-3.5 text-amber-500" />
        Garage Needs Attention
      </h3>

      {/* Counts */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {data.counts.readyForCheck > 0 && (
          <Link
            href="/repairs?status=ready_for_check"
            className="flex items-center gap-1.5 text-sm text-muted-foreground dark:text-muted-foreground/50 hover:text-foreground dark:hover:text-gray-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="font-medium tabular-nums">
              {data.counts.readyForCheck}
            </span>
            <span className="text-muted-foreground/70 dark:text-muted-foreground">
              ready for check
            </span>
          </Link>
        )}
        {data.counts.blocked > 0 && (
          <Link
            href="/repairs?status=blocked"
            className="flex items-center gap-1.5 text-sm text-muted-foreground dark:text-muted-foreground/50 hover:text-foreground dark:hover:text-gray-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
            <span className="font-medium tabular-nums">
              {data.counts.blocked}
            </span>
            <span className="text-muted-foreground/70 dark:text-muted-foreground">blocked</span>
          </Link>
        )}
        {data.counts.partsRequested > 0 && (
          <Link
            href="/parts"
            className="flex items-center gap-1.5 text-sm text-muted-foreground dark:text-muted-foreground/50 hover:text-foreground dark:hover:text-gray-100 transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0" />
            <span className="font-medium tabular-nums">
              {data.counts.partsRequested}
            </span>
            <span className="text-muted-foreground/70 dark:text-muted-foreground">
              parts requested
            </span>
          </Link>
        )}
      </div>

      {/* Items */}
      {data.items.length > 0 && (
        <div className="space-y-1 -mx-2">
          {data.items.slice(0, 5).map((item) => {
            const chipLabel =
              item.status === "ready_for_check"
                ? "Ready for check"
                : item.status === "blocked"
                  ? "Blocked"
                  : (ATTENTION_TYPE_LABEL[item.garageLastUpdateType ?? ""] ??
                    "Update");
            const chipCls =
              item.status === "ready_for_check"
                ? ATTENTION_TYPE_CHIP.ready_for_check
                : item.status === "blocked"
                  ? ATTENTION_TYPE_CHIP.job_blocked
                  : (ATTENTION_TYPE_CHIP[item.garageLastUpdateType ?? ""] ??
                    "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground");

            return (
              <Link
                key={item.id}
                href={`/repairs/${item.id}`}
                className="flex items-center justify-between rounded-xl px-2 py-2.5 transition-all duration-150 hover:bg-muted/40 dark:hover:bg-accent group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate transition-colors">
                    {item.title || item.customerName || "Unnamed"}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {item.publicCode}
                    {item.lastUpdatedByName && (
                      <span>
                        {" "}
                        · {item.lastUpdatedByName.split(" ")[0]}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${chipCls}`}
                  >
                    {chipLabel}
                  </span>
                  {item.garageUnreadUpdatesCount > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-4 rounded-full bg-foreground text-white text-[10px] font-bold px-1">
                      {item.garageUnreadUpdatesCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST VIEW SYNC CHIP — subtle inline chip for repair table rows
// ═══════════════════════════════════════════════════════════════════════════

const SYNC_CHIP_CONFIG: Record<
  string,
  { label: string; cls: string }
> = {
  ready_for_check: {
    label: "Ready for check",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  part_requested: {
    label: "Part requested",
    cls: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  },
  job_blocked: {
    label: "Blocked",
    cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  blocker_added: {
    label: "Blocked",
    cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  issue_reported: {
    label: "Issue",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  urgent_issue: {
    label: "Urgent issue",
    cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  },
  task_suggested: {
    label: "Task suggested",
    cls: "bg-foreground/[0.06] text-foreground/80",
  },
};

export function GarageSyncChip({
  needsAttention,
  unreadCount,
  updateType,
  status,
}: {
  needsAttention: boolean;
  unreadCount: number;
  updateType: string | null;
  status: string;
}) {
  // Show a chip for ready_for_check status always
  if (status === "ready_for_check") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
        Ready for check
      </span>
    );
  }

  // Show sync chip only if needs attention or has unread updates
  if (!needsAttention && unreadCount === 0) return null;

  const config = SYNC_CHIP_CONFIG[updateType ?? ""];

  if (config) {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${config.cls}`}
        >
          {config.label}
        </span>
        {unreadCount > 0 && (
          <span className="inline-flex items-center justify-center h-3.5 min-w-3.5 rounded-full bg-foreground text-white text-[9px] font-bold px-0.5">
            {unreadCount}
          </span>
        )}
      </span>
    );
  }

  // Generic "Garage update" with unread dot
  if (unreadCount > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-foreground/[0.06] text-foreground/80">
        Garage update
        <span className="inline-flex items-center justify-center h-3.5 min-w-3.5 rounded-full bg-foreground text-white text-[9px] font-bold px-0.5">
          {unreadCount}
        </span>
      </span>
    );
  }

  return null;
}
