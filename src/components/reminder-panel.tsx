"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Check, X, ExternalLink, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getActiveReminders,
  getActiveReminderCount,
  completeReminder,
  dismissReminder,
} from "@/actions/reminders";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

const REMINDER_TYPE_LABELS: Record<string, string> = {
  create_invoice: "📄 Invoice",
  follow_up_customer: "📞 Follow-up",
  order_parts: "📦 Parts",
  check_delivery: "🚚 Delivery",
  schedule_repair: "📅 Schedule",
  send_quote: "💰 Quote",
  contact_customer: "📱 Contact",
  custom: "📝 Custom",
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
    const interval = setInterval(loadReminders, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadReminders();
  }, [open]);

  function handleComplete(id: string) {
    startTransition(async () => {
      await completeReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setCount((c) => Math.max(0, c - 1));
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      await dismissReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setCount((c) => Math.max(0, c - 1));
    });
  }

  function isOverdue(dueAt: Date | null) {
    if (!dueAt) return false;
    return new Date(dueAt) < new Date();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Action Reminders</h3>
          <Badge variant="secondary" className="text-[10px]">
            {count} active
          </Badge>
        </div>

        <ScrollArea className="max-h-[400px]">
          {reminders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-30" />
              <p>No active reminders</p>
              <p className="text-xs mt-1">
                Reminders are auto-created when repair statuses change
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`px-4 py-3 hover:bg-muted/50 transition-colors ${
                    isOverdue(reminder.dueAt)
                      ? "bg-destructive/5"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs">
                          {REMINDER_TYPE_LABELS[reminder.reminderType] ?? "📝"}
                        </span>
                        <p className="text-sm font-medium truncate">
                          {reminder.title}
                        </p>
                      </div>
                      {reminder.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {reminder.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {reminder.publicCode && (
                          <button
                            className="text-[10px] text-primary hover:underline"
                            onClick={() => {
                              setOpen(false);
                              router.push(`/repairs/${reminder.repairJobId}`);
                            }}
                          >
                            {reminder.publicCode}
                            {reminder.customerName
                              ? ` · ${reminder.customerName}`
                              : ""}
                          </button>
                        )}
                        {reminder.dueAt && (
                          <span
                            className={`flex items-center gap-0.5 text-[10px] ${
                              isOverdue(reminder.dueAt)
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isOverdue(reminder.dueAt) ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                            {formatDistanceToNow(new Date(reminder.dueAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                        {reminder.autoGenerated && (
                          <span className="text-[10px] text-muted-foreground/60">
                            auto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleComplete(reminder.id)}
                        disabled={isPending}
                        title="Mark as done"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleDismiss(reminder.id)}
                        disabled={isPending}
                        title="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
