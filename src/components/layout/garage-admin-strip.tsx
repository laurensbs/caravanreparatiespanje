"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Check, ClipboardList, MessageSquare, RotateCcw, Wrench } from "lucide-react";
import { adminApproveRepair, adminSendBackRepair } from "@/actions/repairs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type GarageAdminStripProps = {
  readyForCheck: number;
  unreadMessages: number;
  readyItems: Array<{
    id: string;
    publicCode: string | null;
    title: string | null;
    customerName: string | null;
    garageUnreadUpdatesCount: number;
  }>;
};

export function GarageAdminStrip({
  readyForCheck,
  unreadMessages,
  readyItems,
}: GarageAdminStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (readyForCheck <= 0 && unreadMessages <= 0) return null;

  const totalSignals = readyForCheck + unreadMessages;
  const label =
    readyForCheck > 0 && unreadMessages > 0
      ? `Garage waiting on office: ${readyForCheck} to check, ${unreadMessages} unread messages`
      : readyForCheck > 0
        ? `Garage waiting on office: ${readyForCheck} ${readyForCheck === 1 ? "job" : "jobs"} to check`
        : `Garage inbox needs attention: ${unreadMessages} unread ${unreadMessages === 1 ? "message" : "messages"}`;

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-sky-50 px-4 py-3 shadow-sm dark:border-amber-400/20 dark:from-amber-500/10 dark:via-background dark:to-sky-500/10 md:mx-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Wrench className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-300/80">
              Garage attention
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {label}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {readyForCheck > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-1 font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {readyForCheck} ready for check
                </span>
              )}
              {unreadMessages > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-100/80 px-2.5 py-1 font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  {unreadMessages} unread garage messages
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.05] px-2.5 py-1 font-medium text-muted-foreground dark:bg-white/[0.05]">
                {totalSignals} active garage {totalSignals === 1 ? "signal" : "signals"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {readyForCheck > 0 && (
            <Link
              href="/repairs?status=ready_for_check"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-50 dark:border-amber-400/20 dark:bg-background/80 dark:text-amber-200 dark:hover:bg-amber-500/10"
            >
              <ClipboardList className="h-4 w-4" />
              Open work orders
            </Link>
          )}
          {unreadMessages > 0 && (
            <Link
              href="/messages"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-900 transition-colors hover:bg-sky-50 dark:border-sky-400/20 dark:bg-background/80 dark:text-sky-200 dark:hover:bg-sky-500/10"
            >
              <MessageSquare className="h-4 w-4" />
              Open inbox
            </Link>
          )}
        </div>
      </div>

      {readyItems.length > 0 && (
        <div className="mt-3 grid gap-2 border-t border-amber-200/70 pt-3 dark:border-amber-400/10">
          {readyItems.slice(0, 3).map((item) => {
            const label = item.title?.trim() || item.customerName?.trim() || "Repair";
            const sublabel = [item.publicCode, item.customerName].filter(Boolean).join(" · ");
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-white/80 px-3 py-2.5 dark:border-white/[0.06] dark:bg-background/50 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{label}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {sublabel ? <span>{sublabel}</span> : null}
                    {item.garageUnreadUpdatesCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100/80 px-2 py-0.5 font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-200">
                        {item.garageUnreadUpdatesCount} unread
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/repairs/${item.id}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground dark:border-white/[0.08]"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Open
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await adminSendBackRepair(item.id);
                        toast.success("Sent back to garage");
                        router.refresh();
                      });
                    }}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-500/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Send back</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        await adminApproveRepair(item.id);
                        toast.success("Approved and completed");
                        router.refresh();
                      });
                    }}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </Button>
                </div>
              </div>
            );
          })}
          {readyForCheck > readyItems.length && (
            <p className="px-1 text-xs text-muted-foreground">
              {readyForCheck - readyItems.length} more jobs waiting in work orders.
            </p>
          )}
        </div>
      )}
    </div>
  );
}