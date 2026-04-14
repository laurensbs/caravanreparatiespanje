"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Clock, AlertTriangle, Check, X, FileText, Phone, Package, Truck, Calendar, DollarSign, MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getActiveReminders,
  getActiveReminderCount,
  completeReminder,
  dismissReminder,
} from "@/actions/reminders";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

const REMINDER_TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  create_invoice: { icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
  follow_up_customer: { icon: Phone, color: "text-emerald-600", bg: "bg-emerald-50" },
  order_parts: { icon: Package, color: "text-purple-600", bg: "bg-purple-50" },
  check_delivery: { icon: Truck, color: "text-indigo-600", bg: "bg-indigo-50" },
  schedule_repair: { icon: Calendar, color: "text-sky-600", bg: "bg-sky-50" },
  send_quote: { icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
  contact_customer: { icon: MessageSquare, color: "text-teal-600", bg: "bg-teal-50" },
  custom: { icon: Pencil, color: "text-gray-600", bg: "bg-gray-100" },
};

const GARAGE_TRIGGER_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  garage_comment: { icon: MessageSquare, color: "text-sky-600", bg: "bg-sky-50" },
  garage_not_done: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  garage_task_suggestion: { icon: Calendar, color: "text-violet-600", bg: "bg-violet-50" },
  garage_done: { icon: Check, color: "text-emerald-600", bg: "bg-emerald-50" },
  garage_feedback: { icon: MessageSquare, color: "text-sky-600", bg: "bg-sky-50" },
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
      const [data, c] = await Promise.all([
        getActiveReminders(),
        getActiveReminderCount(),
      ]);
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
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              overdueCount > 0 ? "bg-red-500" : "bg-[#0CC0DF]"
            }`}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] rounded-2xl border border-gray-200/60 p-0 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Action Reminders</h3>
            {overdueCount > 0 && (
              <p className="text-[11px] text-red-500 font-medium mt-0.5">
                {overdueCount} overdue
              </p>
            )}
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 tabular-nums">
            {count}
          </span>
        </div>

        {/* Body */}
        <div className="max-h-[440px] overflow-y-auto overscroll-contain">
          {reminders.length === 0 ? (
            <div className="py-16 px-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-gray-900">You're all caught up</p>
              <p className="text-xs text-gray-400 mt-1">
                Reminders appear when repair statuses change
              </p>
            </div>
          ) : (
            <div className="py-1.5">
              {reminders.map((reminder) => {
                const config = getConfig(reminder);
                const label = getLabel(reminder);
                const Icon = config.icon;
                const overdue = isOverdue(reminder.dueAt);

                return (
                  <button
                    key={reminder.id}
                    type="button"
                    className={`group relative w-full text-left px-5 py-3.5 transition-colors cursor-pointer hover:bg-gray-50 ${
                      overdue ? "bg-red-50/40" : ""
                    }`}
                    onClick={() => {
                      setOpen(false);
                      if (reminder.repairJobId) {
                        router.push(`/repairs/${reminder.repairJobId}`);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Icon */}
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                            {label}
                          </span>
                          {reminder.autoGenerated && (
                            <span className="text-[9px] font-medium text-gray-300 uppercase tracking-wider">
                              auto
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] font-medium text-gray-900 mt-0.5 leading-snug">
                          {reminder.title}
                        </p>
                        {reminder.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                            {reminder.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {reminder.publicCode && (
                            <span className="text-[11px] font-medium text-[#0CC0DF]">
                              {reminder.publicCode}
                              {reminder.customerName ? ` · ${reminder.customerName}` : ""}
                            </span>
                          )}
                          {reminder.dueAt && (
                            <span
                              className={`flex items-center gap-1 text-[11px] ${
                                overdue
                                  ? "text-red-500 font-semibold"
                                  : "text-gray-400"
                              }`}
                            >
                              {overdue ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              {formatDistanceToNow(new Date(reminder.dueAt), {
                                addSuffix: true,
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions — show on hover */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                        <button
                          type="button"
                          onClick={(e) => handleComplete(e, reminder.id)}
                          disabled={isPending}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-50 transition-colors"
                          title="Complete"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDismiss(e, reminder.id)}
                          disabled={isPending}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                          title="Dismiss"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
