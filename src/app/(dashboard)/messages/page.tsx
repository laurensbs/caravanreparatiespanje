import Link from "next/link";
import { listMessageThreads } from "@/actions/garage-sync";
import { MessageSquare, ArrowRight } from "lucide-react";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function relativeTime(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

export default async function MessagesPage() {
  const threads = await listMessageThreads();

  const withUnread = threads.filter((t) => t.unreadCount > 0);
  const others = threads.filter((t) => t.unreadCount === 0);

  return (
    <DashboardPageCanvas>
      <div className="space-y-6">
        <DashboardPageHeader
          title="Messages"
          description="All conversations between the office and the garage tablet. Tap any row to reply."
        />

        {threads.length === 0 ? (
          <div
            className={cn(
              dashboardPanelClass,
              "flex flex-col items-center justify-center gap-2 py-16 text-center",
            )}
          >
            <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No conversations yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              When the garage sends a message from the tablet it will appear here.
            </p>
          </div>
        ) : (
          <>
            {withUnread.length > 0 ? (
              <ThreadList
                title="Unread from garage"
                threads={withUnread}
                highlight
              />
            ) : null}
            {others.length > 0 ? (
              <ThreadList title="All conversations" threads={others} />
            ) : null}
          </>
        )}
      </div>
    </DashboardPageCanvas>
  );
}

type Thread = Awaited<ReturnType<typeof listMessageThreads>>[number];

function ThreadList({
  title,
  threads,
  highlight = false,
}: {
  title: string;
  threads: Thread[];
  highlight?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </h2>
      <ul className={cn(dashboardPanelClass, "divide-y divide-border/60 p-0")}>
        {threads.map((t) => (
          <li key={t.repairJobId}>
            <Link
              href={`/repairs/${t.repairJobId}`}
              className={cn(
                "flex items-start gap-3 px-4 py-3.5 transition-colors active:scale-[0.998] sm:items-center sm:gap-4",
                highlight
                  ? "bg-amber-50/50 hover:bg-amber-100/60 dark:bg-amber-500/[0.04] dark:hover:bg-amber-500/[0.08]"
                  : "hover:bg-muted/50 dark:hover:bg-card/[0.04]",
              )}
            >
              <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground dark:bg-card/[0.06] sm:mt-0">
                <MessageSquare className="h-4 w-4" />
                {t.unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
                    {t.unreadCount > 9 ? "9+" : t.unreadCount}
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {t.customerName ?? "Unknown customer"}
                  </p>
                  {t.publicCode ? (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground dark:bg-card/[0.06]">
                      {t.publicCode}
                    </span>
                  ) : null}
                  <span className="shrink-0 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground dark:bg-card/[0.04]">
                    {statusLabel(t.status)}
                  </span>
                </div>
                {t.title ? (
                  <p className="truncate text-xs text-muted-foreground/70">{t.title}</p>
                ) : null}
                {t.lastBody ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    <span className="font-medium text-muted-foreground/80">
                      {t.lastDirection === "garage_to_admin"
                        ? (t.lastAuthor ?? "Garage")
                        : "Office"}
                      :
                    </span>{" "}
                    {t.lastBody}
                  </p>
                ) : null}
              </div>

              <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                {t.lastAt ? (
                  <span className="text-[11px] text-muted-foreground/70">
                    {relativeTime(t.lastAt)}
                  </span>
                ) : null}
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
              <div className="flex flex-col items-end gap-1 sm:hidden">
                {t.lastAt ? (
                  <span className="text-[10px] text-muted-foreground/70">
                    {relativeTime(t.lastAt)}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
