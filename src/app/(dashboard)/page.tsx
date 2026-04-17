import { getDashboardStats, getFollowUpItems, getDashboardSuggestions } from "@/actions/repairs";
import { getGarageAttentionItems } from "@/actions/garage-sync";
import { DashboardSuggestions } from "@/components/dashboard/dashboard-suggestions";
import { PipelineSummary } from "@/components/repair-progress";
import { GarageAttentionWidget } from "@/components/garage-sync-ui";

import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts, getPartCategories } from "@/actions/parts";
import { getAllUnits } from "@/actions/units";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import {
  Wrench, AlertTriangle, ArrowRight, PhoneOff,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, CustomerResponseStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function DashboardPage() {
  const [{ stats, recentJobs, jobsByLocation, pipelineJobs }, followUps, locationsList, customersList, partsCatalog, dashboardSuggestions, unitsList, partCategories, garageAttention] =
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

  const quickPills = [
    { label: "To Do", value: stats?.todo ?? 0, href: "/repairs?status=todo", dot: "bg-gray-400" },
    { label: "In Progress", value: stats?.inProgress ?? 0, href: "/repairs?status=in_progress", dot: "bg-sky-400" },
    { label: "Waiting Parts", value: stats?.waitingParts ?? 0, href: "/repairs?status=waiting_parts", dot: "bg-amber-400" },
    { label: "Waiting Customer", value: stats?.waitingCustomer ?? 0, href: "/repairs?status=waiting_customer", dot: "bg-orange-400" },
    { label: "Completed", value: stats?.completed ?? 0, href: "/repairs?status=completed", dot: "bg-emerald-400" },
    { label: "Urgent", value: stats?.urgent ?? 0, href: "/repairs?priority=urgent", dot: "bg-red-400" },
    { label: "Follow-up", value: followUps.length, href: "/repairs?customerResponseStatus=no_response", dot: "bg-orange-400" },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Overview of repair operations</p>
        </div>
        <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} partCategories={partCategories} units={unitsList} />
      </div>

      {/* ── Quick Filter Pills ─────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {quickPills.map((pill) => (
          <Link key={pill.label} href={pill.href}>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-150 cursor-pointer">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${pill.dot}`} />
              {pill.label}
              <span className="tabular-nums font-medium text-gray-700 dark:text-slate-300">{pill.value}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* ── Pipeline Progress ──────────────────────────────── */}
      <PipelineSummary repairs={pipelineJobs} />

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
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">Status Summary</h3>
            <div className="space-y-0">
              {quickPills.map((pill) => (
                <Link
                  key={pill.label}
                  href={pill.href}
                  className="flex items-center justify-between py-2 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent -mx-2.5 px-2.5 rounded-lg"
                >
                  <span className="flex items-center gap-2 text-xs text-gray-600 dark:text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${pill.dot}`} />
                    {pill.label}
                  </span>
                  <span className="text-xs font-medium text-gray-900 dark:text-foreground tabular-nums">{pill.value}</span>
                </Link>
              ))}
            </div>
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
                    reply_not_required: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
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
