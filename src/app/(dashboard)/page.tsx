import { getDashboardStats, getFollowUpItems, getDashboardSuggestions } from "@/actions/repairs";
import { getGarageAttentionItems } from "@/actions/garage-sync";
import { DashboardSuggestions } from "@/components/dashboard/dashboard-suggestions";
import { PipelineSummary } from "@/components/repair-progress";
import { GarageAttentionWidget } from "@/components/garage-sync-ui";

import { getLocations } from "@/actions/locations";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import {
  Wrench, AlertTriangle, ArrowRight, PhoneOff, Plus,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, CustomerResponseStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";
import { cn } from "@/lib/utils";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function DashboardPage() {
  // The dashboard used to eagerly SELECT every customer, unit, part, and
  // part category only to hand them to the NewRepairDialog. The dialog
  // now lazy-loads those lists on first open, so this page stays lean.
  const [{ stats, recentJobs, jobsByLocation, pipelineJobs }, followUps, locationsList, dashboardSuggestions, garageAttention] =
    await Promise.all([
      getDashboardStats(),
      getFollowUpItems(),
      getLocations(),
      getDashboardSuggestions(),
      getGarageAttentionItems(),
    ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const quickPills = [
    { label: "To Do", value: stats?.todo ?? 0, href: "/repairs?status=todo", dot: "bg-muted-foreground/40" },
    { label: "In Progress", value: stats?.inProgress ?? 0, href: "/repairs?status=in_progress", dot: "bg-foreground" },
    { label: "Waiting Parts", value: stats?.waitingParts ?? 0, href: "/repairs?status=waiting_parts", dot: "bg-amber-400" },
    { label: "Waiting Customer", value: stats?.waitingCustomer ?? 0, href: "/repairs?status=waiting_customer", dot: "bg-orange-400" },
    { label: "Completed", value: stats?.completed ?? 0, href: "/repairs?status=completed", dot: "bg-emerald-400" },
    { label: "Urgent", value: stats?.urgent ?? 0, href: "/repairs?priority=urgent", dot: "bg-red-400" },
    { label: "Follow-up", value: followUps.length, href: "/repairs?customerResponseStatus=no_response", dot: "bg-orange-400" },
  ];

  // Today briefing — extracts the 'what should you actually look at'
  // signal from the same stats object the pills already use. No extra
  // server roundtrips. Each highlight links into the relevant filter.
  const briefingItems = [
    stats?.urgent
      ? { label: "Urgent", value: stats.urgent, tone: "red" as const, href: "/repairs?priority=urgent" }
      : null,
    stats?.waitingCustomer
      ? { label: "Wachten op klant", value: stats.waitingCustomer, tone: "orange" as const, href: "/repairs?status=waiting_customer" }
      : null,
    stats?.waitingParts
      ? { label: "Wachten op onderdelen", value: stats.waitingParts, tone: "amber" as const, href: "/repairs?status=waiting_parts" }
      : null,
    followUps.length > 0
      ? { label: "Follow-up nodig", value: followUps.length, tone: "amber" as const, href: "/repairs?customerResponseStatus=no_response" }
      : null,
    stats?.readyForCheck
      ? { label: "Klaar voor controle", value: stats.readyForCheck, tone: "emerald" as const, href: "/repairs?status=ready_for_check" }
      : null,
  ].filter((x): x is { label: string; value: number; tone: "red" | "orange" | "amber" | "emerald"; href: string } => !!x);

  const briefingTotal = briefingItems.reduce((acc, x) => acc + x.value, 0);
  const briefingHeadline = briefingTotal === 0
    ? "All clear — nothing needs you today."
    : briefingItems.length === 1
      ? `${briefingItems[0].value} ${briefingItems[0].label.toLowerCase()} today.`
      : `${briefingTotal} item${briefingTotal !== 1 ? "s" : ""} vragen je aandacht.`;

  return (
    <DashboardPageCanvas>
    <div className="space-y-6 sm:space-y-8">
      <DashboardPageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="Overview of repair operations across locations."
        actions={<NewRepairDialog locations={filteredLocations} />}
      />

      {/* ── Today briefing ─────────────────────────────────────
          The first thing you see on the dashboard. Consolidates the
          handful of "actionable now" signals into one card so the user
          doesn't have to translate a strip of pills into a to-do list. */}
      <div
        className={cn(
          dashboardPanelClass,
          "relative overflow-hidden p-5 sm:p-6",
          briefingTotal === 0 && "bg-emerald-50/40 dark:bg-emerald-500/[0.04]",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {briefingTotal === 0 ? "Inbox zero" : "Today"}
            </p>
            <h2 className="text-lg font-semibold tracking-[-0.015em] text-foreground sm:text-xl">
              {briefingHeadline}
            </h2>
          </div>
          {briefingItems.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {briefingItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium tracking-[-0.005em] shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.12)]",
                    item.tone === "red" && "border-red-200/70 bg-red-50 text-red-700 hover:border-red-300 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
                    item.tone === "orange" && "border-orange-200/70 bg-orange-50 text-orange-700 hover:border-orange-300 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
                    item.tone === "amber" && "border-amber-200/70 bg-amber-50 text-amber-700 hover:border-amber-300 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
                    item.tone === "emerald" && "border-emerald-200/70 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
                  )}
                >
                  <span className="font-mono tabular-nums text-sm font-semibold">{item.value}</span>
                  <span>{item.label}</span>
                  <ArrowRight className="h-3 w-3 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-90" />
                </Link>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All clear
            </span>
          )}
        </div>
      </div>

      {/* ── Quick Filter Pills ─────────────────────────────── */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {quickPills.map((pill) => (
          <Link key={pill.label} href={pill.href} className="shrink-0">
            <span className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] transition-all duration-150 hover:-translate-y-px hover:border-foreground/15 hover:text-foreground hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${pill.dot} transition-transform group-hover:scale-125`} />
              {pill.label}
              <span className="font-medium tabular-nums text-foreground">{pill.value}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* ── Pipeline Progress ──────────────────────────────── */}
      <div className={cn(dashboardPanelClass, "px-4 py-3 sm:px-5")}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          Pipeline
        </p>
        <PipelineSummary repairs={pipelineJobs} />
      </div>

      <DashboardSuggestions data={dashboardSuggestions} />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity – Left */}
        <div className={cn("lg:col-span-2 overflow-hidden", dashboardPanelClass)}>
          <div className="flex flex-col gap-3 p-5 pb-3 sm:flex-row sm:items-end sm:justify-between sm:p-6 sm:pb-4">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-lg font-semibold tracking-[-0.015em] text-foreground">Recent Activity</h2>
              <p className="text-sm text-muted-foreground">Latest updated repair jobs</p>
            </div>
            <Link
              href="/repairs"
              className="group inline-flex shrink-0 items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground sm:self-auto"
            >
              View all <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {recentJobs.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="No repairs yet"
                description="Add your first work order to see activity here."
                action={{ label: "New repair", href: "/repairs/new", icon: Plus }}
              />
            ) : (
              <div className="space-y-1">
                {recentJobs.map((job) => {
                  const statusPill: Record<string, string> = {
                    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    in_progress: "bg-muted/60 text-foreground dark:bg-foreground/[0.06] dark:text-foreground/80",
                    waiting_parts: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                    waiting_customer: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
                    blocked: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                    rejected: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
                  };
                  return (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="group relative flex flex-col gap-3 rounded-xl p-3 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tracking-[-0.005em] text-foreground transition-transform group-hover:translate-x-0.5">
                        {job.title || job.customerName || "Unnamed repair"}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {job.locationName && `${job.locationName} · `}
                        {job.customerName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-4 sm:justify-end sm:gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-[-0.005em] ${statusPill[job.status as string] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[job.status as RepairStatus]}
                      </span>
                      <SmartDate date={job.updatedAt} className="text-xs text-muted-foreground/70 tabular-nums" />
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Garage Needs Attention */}
          <GarageAttentionWidget data={garageAttention} />

          {/* Status Summary */}
          <div className={cn(dashboardPanelClass, "p-5")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Status Summary</h3>
            <div className="space-y-0">
              {quickPills.map((pill) => (
                <Link
                  key={pill.label}
                  href={pill.href}
                  className="group -mx-2.5 flex items-center justify-between rounded-lg px-2.5 py-2 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/60"
                >
                  <span className="flex items-center gap-2 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${pill.dot} transition-transform group-hover:scale-125`} />
                    {pill.label}
                  </span>
                  <span className="text-xs font-medium text-foreground tabular-nums">{pill.value}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Location Breakdown */}
          <div className={cn(dashboardPanelClass, "p-6")}>
            <h3 className="mb-4 text-sm font-semibold tracking-[-0.01em] text-foreground">By Location</h3>
            {jobsByLocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              (() => {
                const mainLocations = ["Cruïllas", "Peratallada", "Sant Climent"];
                const main = jobsByLocation.filter((item) =>
                  mainLocations.some((m) => item.locationName?.includes(m))
                );
                const misc = jobsByLocation.filter((item) =>
                  !mainLocations.some((m) => item.locationName?.includes(m))
                );
                const miscTotal = misc.reduce((sum, item) => sum + Number(item.count), 0);

                return (
                  <div className="space-y-0">
                    {main.map((item) => (
                      <Link
                        key={item.locationName ?? "unassigned"}
                        href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                        className="group -mx-3 flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/60"
                      >
                        <span className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${{
                            "cruïllas": "bg-foreground",
                            "peratallada": "bg-amber-400",
                            "sant climent": "bg-emerald-400",
                          }[item.locationName?.toLowerCase() ?? ""] ?? "bg-muted-foreground/30"}`} />
                          {item.locationName ?? "Unassigned"}
                        </span>
                        <span className="text-sm font-medium text-foreground tabular-nums">{item.count}</span>
                      </Link>
                    ))}
                    {miscTotal > 0 && (
                      <>
                        <div className="my-2 border-t border-border/60" />
                        <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/70">Other</p>
                        {misc.map((item) => (
                          <Link
                            key={item.locationName ?? "unassigned"}
                            href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                            className="-mx-3 flex items-center justify-between rounded-lg px-3 py-2 transition-all duration-200 hover:bg-muted/60"
                          >
                            <span className="text-sm text-muted-foreground">{item.locationName ?? "Unassigned"}</span>
                            <span className="text-sm font-medium text-muted-foreground tabular-nums">{item.count}</span>
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()
            )}
          </div>

          {/* Follow-ups */}
          {followUps.length > 0 && (
            <div className={cn(dashboardPanelClass, "p-6")}>
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-foreground">
                <PhoneOff className="h-3.5 w-3.5 text-amber-500" />
                Needs Follow-up
              </h3>
              <div className="space-y-1">
                {followUps.slice(0, 6).map((job) => {
                  const responsePill: Record<string, string> = {
                    not_contacted: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                    no_response: "bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground",
                    waiting_response: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                    contacted: "bg-muted/60 text-foreground dark:bg-foreground/[0.06] dark:text-foreground/80",
                    approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    declined: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                    reply_not_required: "bg-muted text-muted-foreground dark:bg-foreground/[0.08] dark:text-foreground/80",
                  };
                  return (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="-mx-3 flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-muted/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tracking-[-0.005em] text-foreground">{job.customerName || job.title || "Unknown"}</p>
                      <span className="font-mono text-xs text-muted-foreground/70">{job.publicCode}</span>
                    </div>
                    <span className={`ml-2 inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${responsePill[job.customerResponseStatus as string] ?? "bg-muted text-muted-foreground"}`}>
                      {CUSTOMER_RESPONSE_LABELS[job.customerResponseStatus as CustomerResponseStatus]}
                    </span>
                  </Link>
                  );
                })}
                {followUps.length > 6 && (
                  <Link href="/repairs?customerResponseStatus=no_response" className="block py-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
                    +{followUps.length - 6} more
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardPageCanvas>
  );
}
