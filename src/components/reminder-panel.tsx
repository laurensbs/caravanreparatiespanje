"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Bell, Clock, AlertTriangle, Check, X, FileText, Phone, Package, Truck, Calendar, DollarSign, MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getActiveReminders,
  getActiveReminderCount,
  completeReminder,
  dismissReminder,
} from "@/actions/reminders";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const REMINDER_TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  create_invoice: { icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  follow_up_customer: { icon: Phone, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/10" },
  order_parts: { icon: Package, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  check_delivery: { icon: Truck, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
  schedule_repair: { icon: Calendar, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  send_quote: { icon: DollarSign, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  contact_customer: { icon: MessageSquare, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10" },
  custom: { icon: Pencil, color: "text-muted-foreground", bg: "bg-muted" },
};

const GARAGE_TRIGGER_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  garage_comment: { icon: MessageSquare, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
  garage_not_done: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  garage_task_suggestion: { icon: Calendar, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
  garage_done: { icon: Check, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  garage_feedback: { icon: MessageSquare, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
};

const TYPE_LABELS: Record<string, string> = {
  create_invoice: "Invoice",
  follow_up_customer: "Follow-up",
  order_parts: "Parts",
  check_delivery: "Delivery",
  schedule_repair: "Schedule",
  send_quote: "Quote",
  contact_customer: "Contact",
  custom: "Custom",
};

const GARAGE_LABELS: Record<string, string> = {
  garage_comment: "Garage",
  garage_not_done: "Garage",
  garage_task_suggestion: "Garage",
  garage_done: "Garage",
  garage_feedback: "Garage",
};

type Reminder = Awaited<ReturnType<typeof getActiveReminders>>[number];

export function ReminderPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [count, setCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  async function loadReminders() {
    try {
      const [data, c] = await Promise.all([getActiveReminders(), getActiveReminderCount()]);
      setReminders(data);
      setCount(c);
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadReminders();
  }, [open]);

  function isOverdue(dueAt: Date | null) {
    if (!dueAt) return false;
    return new Date(dueAt) < new Date();
  }

  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      const ao = isOverdue(a.dueAt) ? 1 : 0;
      const bo = isOverdue(b.dueAt) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  }, [reminders]);

  function getConfig(reminder: Reminder) {
    if (reminder.triggerEvent) {
      const key = reminder.triggerEvent.split(":")[0];
      if (GARAGE_TRIGGER_CONFIG[key]) return GARAGE_TRIGGER_CONFIG[key];
    }
    return REMINDER_TYPE_CONFIG[reminder.reminderType] ?? REMINDER_TYPE_CONFIG.custom;
  }

  function getLabel(reminder: Reminder) {
    if (reminder.triggerEvent) {
      const key = reminder.triggerEvent.split(":")[0];
      if (GARAGE_LABELS[key]) return GARAGE_LABELS[key];
    }
    return TYPE_LABELS[reminder.reminderType] ?? "Custom";
  }

  function handleComplete(e: React.MouseEvent, reminderId: string) {
    e.stopPropagation();
    startTransition(async () => {
      await completeReminder(reminderId);
      await loadReminders();
    });
  }

  function handleDismiss(e: React.MouseEvent, reminderId: string) {
    e.stopPropagation();
    startTransition(async () => {
      await dismissReminder(reminderId);
      await loadReminders();
    });
  }

  const overdueCount = reminders.filter((r) => isOverdue(r.dueAt)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0 touch-manipulation rounded-lg"
          title="Reminders"
          aria-label={count > 0 ? `Reminders, ${count} open` : "Reminders"}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums",
                overdueCount > 0 ? "bg-red-500" : "bg-cyan-600 dark:bg-cyan-500"
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1.25rem,420px)] overflow-hidden rounded-2xl border border-border/80 bg-popover p-0 shadow-xl dark:bg-popover"
      >
        <div className="border-b border-border/60 bg-gradient-to-r from-cyan-500/[0.06] to-transparent px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">Reminders</h3>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {count === 0 ? "Nothing that needs your attention" : "Tap a row to open the repair"}
              </p>
            </div>
            {count > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {count}
                {overdueCount > 0 && (
                  <span className="ml-1.5 text-red-600 dark:text-red-400">· {overdueCount} late</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="max-h-[min(70vh,440px)] overflow-y-auto overscroll-contain">
          {sortedReminders.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-foreground">You&apos;re up to date</p>
              <p className="mt-1 text-xs text-muted-foreground">We&apos;ll add items when status changes or the garage nudges you.</p>
            </div>
          ) : (
            <ul className="py-1">
              {sortedReminders.map((reminder) => {
                const config = getConfig(reminder);
                const label = getLabel(reminder);
                const Icon = config.icon;
                const overdue = isOverdue(reminder.dueAt);

                return (
                  <li key={reminder.id} className="border-b border-border/40 last:border-0">
                    <button
                      type="button"
                      className={cn(
                        "group flex w-full touch-manipulation gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 sm:px-5",
                        overdue && "bg-red-500/[0.06] hover:bg-red-500/10"
                      )}
                      onClick={() => {
                        setOpen(false);
                        if (reminder.repairJobId) router.push(`/repairs/${reminder.repairJobId}`);
                      }}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", config.color)}>{label}</span>
                          {reminder.autoGenerated && (
                            <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">Auto</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">{reminder.title}</p>
                        {reminder.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{reminder.description}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {reminder.publicCode && (
                            <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                              {reminder.publicCode}
                              {reminder.customerName ? ` · ${reminder.customerName}` : ""}
                            </span>
                          )}
                          {reminder.dueAt && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px]",
                                overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"
                              )}
                            >
                              {overdue ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <Clock className="h-3 w-3 shrink-0" />}
                              {formatDistanceToNow(new Date(reminder.dueAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400 sm:hidden">Open repair →</p>
                      </div>

                      <div className="flex shrink-0 items-start gap-0.5 pt-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => handleComplete(e, reminder.id)}
                          disabled={isPending}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-400"
                          title="Mark done"
                          aria-label="Mark reminder done"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDismiss(e, reminder.id)}
                          disabled={isPending}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Dismiss"
                          aria-label="Dismiss reminder"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
