import { getDashboardStats, getFollowUpItems, getDashboardSuggestions } from "@/actions/repairs";
import { getGarageAttentionItems } from "@/actions/garage-sync";
import { DashboardSuggestions } from "@/components/dashboard/dashboard-suggestions";
import { WorkflowGuide } from "@/components/workflow-guide";
import { PipelineSummary } from "@/components/repair-progress";
import { GarageAttentionWidget } from "@/components/garage-sync-ui";

import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts, getPartCategories } from "@/actions/parts";
import { getAllUnits } from "@/actions/units";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import {
  Wrench, AlertTriangle, ArrowRight, PhoneOff, TrendingUp, ClipboardCheck,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, CustomerResponseStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function DashboardPage() {
  const [{ stats, recentJobs, jobsByStatus, jobsByLocation, pipelineJobs }, followUps, locationsList, customersList, partsCatalog, dashboardSuggestions, unitsList, partCategories, garageAttention] =
    await Promise.all([
      getDashboardStats(),
      getFollowUpItems(),
      getLocations(),
      getAllCustomers(),
      getParts(),
      getDashboardSuggestions(),
      getAllUnits(),
      getPartCategories(),
      getGarageAttentionItems(),
    ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const heroCards = [
    { label: "Active Jobs", value: stats?.active ?? 0, icon: <TrendingUp className="h-5 w-5 text-gray-400 dark:text-muted-foreground" />, href: "/repairs", bg: "bg-white dark:bg-card border border-gray-100 dark:border-border" },
    { label: "Ready for Check", value: stats?.readyForCheck ?? 0, icon: <ClipboardCheck className="h-5 w-5 text-amber-500" />, href: "/repairs?status=ready_for_check", bg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20" },
    { label: "In Progress", value: stats?.inProgress ?? 0, icon: <Wrench className="h-5 w-5 text-sky-500" />, href: "/repairs?status=in_progress", bg: "bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20" },
    { label: "Urgent", value: stats?.urgent ?? 0, icon: <AlertTriangle className="h-5 w-5 text-red-500" />, href: "/repairs?priority=urgent", bg: "bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20" },
    { label: "Follow-up", value: followUps.length, icon: <PhoneOff className="h-5 w-5 text-amber-500" />, href: "/repairs?customerResponseStatus=no_response", bg: "bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20" },
  ];

  const statusTabs = [
    { label: "To Do", value: stats?.todo ?? 0, href: "/repairs?status=todo" },
    { label: "Waiting Parts", value: stats?.waitingParts ?? 0, href: "/repairs?status=waiting_parts" },
    { label: "Waiting Contact", value: stats?.waitingCustomer ?? 0, href: "/repairs?status=waiting_customer" },
    { label: "Completed", value: stats?.completed ?? 0, href: "/repairs?status=completed" },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-foreground">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">Overview of repair operations</p>
        </div>
        <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} partCategories={partCategories} units={unitsList} />
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-5">
        {heroCards.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <div className={`rounded-2xl shadow-sm p-6 transition-all duration-150 hover:shadow-md cursor-pointer ${kpi.bg}`}>
              <div className="mb-3">{kpi.icon}</div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-foreground tabular-nums">{kpi.value}</p>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">{kpi.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Status Tabs ────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-border overflow-x-auto">
        {statusTabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex items-center gap-1.5 pb-2.5 text-sm text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors whitespace-nowrap border-b-2 border-transparent hover:border-[#0CC0DF]"
          >
            {tab.label}
            <span className="font-medium tabular-nums text-gray-400 dark:text-muted-foreground">{tab.value}</span>
          </Link>
        ))}
      </div>

      {/* ── Pipeline Progress ──────────────────────────────── */}
      <PipelineSummary repairs={pipelineJobs} />

      <WorkflowGuide page="dashboard" />

      <DashboardSuggestions data={dashboardSuggestions} />

      {/* ── Main Content ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity – Left */}
        <div className="lg:col-span-2 bg-white dark:bg-card rounded-2xl shadow-sm">
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">Recent Activity</h2>
              <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">Latest updated repair jobs</p>
            </div>
            <Link
              href="/repairs"
              className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-6 pb-6">
            {recentJobs.length === 0 ? (
              <div className="py-16 text-center">
                <Wrench className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="font-medium text-sm text-gray-500">No repair jobs yet</p>
                <Link href="/repairs/new" className="text-sm text-[#0CC0DF] hover:underline mt-1 inline-block">
                  Create your first repair job
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {recentJobs.map((job) => {
                  const statusPill: Record<string, string> = {
                    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    in_progress: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
                    waiting_parts: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                    waiting_customer: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
                    blocked: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                    rejected: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
                  };
                  return (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-xl p-4 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent group"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate group-hover:text-[#0CC0DF] transition-colors">
                        {job.title || job.customerName || "Unnamed repair"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-muted-foreground mt-0.5">
                        {job.locationName && `${job.locationName} · `}
                        {job.customerName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusPill[job.status as string] ?? "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground"}`}>
                        {STATUS_LABELS[job.status as RepairStatus]}
                      </span>
                      <SmartDate date={job.updatedAt} className="text-xs text-gray-400" />
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
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">Status Summary</h3>
            {jobsByStatus.length === 0 ? (
              <p className="text-sm text-gray-500">No data</p>
            ) : (
              <div className="space-y-0">
                {jobsByStatus.map((item) => {
                  const dotColor: Record<string, string> = {
                    new: "bg-gray-300",
                    todo: "bg-gray-400",
                    in_inspection: "bg-sky-300",
                    in_progress: "bg-sky-400",
                    scheduled: "bg-sky-300",
                    waiting_parts: "bg-amber-400",
                    waiting_customer: "bg-orange-400",
                    waiting_approval: "bg-amber-300",
                    completed: "bg-emerald-400",
                    invoiced: "bg-emerald-300",
                    blocked: "bg-red-400",
                  };
                  return (
                  <Link
                    key={item.status}
                    href={`/repairs?status=${item.status}`}
                    className="flex items-center justify-between py-2.5 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent -mx-3 px-3 rounded-lg"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor[item.status as string] ?? "bg-gray-300"}`} />
                      {STATUS_LABELS[item.status as RepairStatus]}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-foreground tabular-nums">{item.count}</span>
                  </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Location Breakdown */}
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4">By Location</h3>
            {jobsByLocation.length === 0 ? (
              <p className="text-sm text-gray-500">No data</p>
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
                        className="flex items-center justify-between py-2.5 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent -mx-3 px-3 rounded-lg"
                      >
                    <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-muted-foreground">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${{
                            "cruïllas": "bg-sky-400",
                            "peratallada": "bg-amber-400",
                            "sant climent": "bg-emerald-400",
                          }[item.locationName?.toLowerCase() ?? ""] ?? "bg-gray-300"}`} />
                          {item.locationName ?? "Unassigned"}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-foreground tabular-nums">{item.count}</span>
                      </Link>
                    ))}
                    {miscTotal > 0 && (
                      <>
                        <div className="border-t border-gray-100 dark:border-border my-2" />
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Other</p>
                        {misc.map((item) => (
                          <Link
                            key={item.locationName ?? "unassigned"}
                            href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                            className="flex items-center justify-between py-2 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent -mx-3 px-3 rounded-lg"
                          >
                            <span className="text-sm text-gray-500">{item.locationName ?? "Unassigned"}</span>
                            <span className="text-sm font-medium text-gray-500 tabular-nums">{item.count}</span>
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
            <div className="bg-white dark:bg-card rounded-2xl shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center gap-2">
                <PhoneOff className="h-3.5 w-3.5 text-amber-500" />
                Needs Follow-up
              </h3>
              <div className="space-y-1">
                {followUps.slice(0, 6).map((job) => {
                  const responsePill: Record<string, string> = {
                    not_contacted: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                    no_response: "bg-gray-100 text-gray-600 dark:bg-muted dark:text-muted-foreground",
                    waiting_response: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
                    contacted: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
                    approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
                    declined: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                  };
                  return (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between py-2.5 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent -mx-3 px-3 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">{job.customerName || job.title || "Unknown"}</p>
                      <span className="text-xs text-gray-400 font-mono">{job.publicCode}</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ml-2 shrink-0 ${responsePill[job.customerResponseStatus as string] ?? "bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground"}`}>
                      {CUSTOMER_RESPONSE_LABELS[job.customerResponseStatus as CustomerResponseStatus]}
                    </span>
                  </Link>
                  );
                })}
                {followUps.length > 6 && (
                  <Link href="/repairs?customerResponseStatus=no_response" className="block text-center text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors">
                    +{followUps.length - 6} more
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
