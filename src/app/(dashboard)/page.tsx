import { getDashboardStats, getFollowUpItems } from "@/actions/repairs";

import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import {
  Wrench, Clock, Package, Users, CheckCircle, AlertTriangle,
  ArrowRight, PhoneOff, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";
import { cn } from "@/lib/utils";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function DashboardPage() {
  const [{ stats, recentJobs, jobsByStatus, jobsByLocation }, followUps, locationsList, customersList, partsCatalog] =
    await Promise.all([
      getDashboardStats(),
      getFollowUpItems(),
      getLocations(),
      getAllCustomers(),
      getParts(),
    ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const kpiCards = [
    { label: "Active Jobs", value: stats?.active ?? 0, icon: <TrendingUp className="h-4 w-4" />, bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400", href: "/repairs" },
    { label: "To Do", value: stats?.todo ?? 0, icon: <Clock className="h-4 w-4" />, bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400", href: "/repairs?status=todo" },
    { label: "In Progress", value: stats?.inProgress ?? 0, icon: <Wrench className="h-4 w-4" />, bg: "bg-sky-500/10 text-sky-600 dark:text-sky-400", href: "/repairs?status=in_progress" },
    { label: "Waiting Parts", value: stats?.waitingParts ?? 0, icon: <Package className="h-4 w-4" />, bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400", href: "/repairs?status=waiting_parts" },
    { label: "Waiting Customer", value: stats?.waitingCustomer ?? 0, icon: <Users className="h-4 w-4" />, bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400", href: "/repairs?status=waiting_customer" },
    { label: "Completed", value: stats?.completed ?? 0, icon: <CheckCircle className="h-4 w-4" />, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", href: "/repairs?status=completed" },
    { label: "Urgent", value: stats?.urgent ?? 0, icon: <AlertTriangle className="h-4 w-4" />, bg: "bg-red-500/10 text-red-600 dark:text-red-400", href: "/repairs?priority=urgent" },
    { label: "Follow-up", value: followUps.length, icon: <PhoneOff className="h-4 w-4" />, bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400", href: "/repairs?customerResponseStatus=no_response" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of all repair operations</p>
        </div>
        <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} />
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer border-transparent bg-card animate-slide-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{kpi.label}</p>
                  </div>
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", kpi.bg)}>
                    {kpi.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription className="text-xs">Latest updated repair jobs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs h-7 rounded-lg">
              <Link href="/repairs">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Wrench className="mx-auto mb-3 h-10 w-10 opacity-20" />
                <p className="font-medium text-sm">No repair jobs yet</p>
                <Button variant="link" asChild className="mt-1 text-xs">
                  <Link href="/repairs/new">Create your first repair job</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-xl p-3 transition-all hover:bg-muted/60 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          {job.publicCode}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] px-1.5 py-0", STATUS_COLORS[job.status as RepairStatus])}
                        >
                          {STATUS_LABELS[job.status as RepairStatus]}
                        </Badge>
                        {job.priority === "urgent" && (
                          <Badge className={cn("text-[10px] px-1.5 py-0", PRIORITY_COLORS[job.priority as Priority])}>
                            {PRIORITY_LABELS[job.priority as Priority]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium group-hover:text-primary transition-colors">
                        {job.title || job.customerName || "Unnamed repair"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {job.locationName && `${job.locationName} · `}
                        {job.customerName}
                      </p>
                    </div>
                    <SmartDate date={job.updatedAt} className="text-[11px] text-muted-foreground ml-4 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* Status breakdown */}
          <Card className="animate-slide-up" style={{ animationDelay: "250ms", animationFillMode: "backwards" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">By Status</CardTitle>
            </CardHeader>
            <CardContent>
              {jobsByStatus.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-1.5">
                  {jobsByStatus.map((item) => (
                    <Link
                      key={item.status}
                      href={`/repairs?status=${item.status}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-muted/60"
                    >
                      <Badge variant="secondary" className={cn("text-[10px]", STATUS_COLORS[item.status as RepairStatus])}>
                        {STATUS_LABELS[item.status as RepairStatus]}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">{item.count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location breakdown */}
          <Card className="animate-slide-up" style={{ animationDelay: "300ms", animationFillMode: "backwards" }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">By Location</CardTitle>
            </CardHeader>
            <CardContent>
              {jobsByLocation.length === 0 ? (
                <p className="text-xs text-muted-foreground">No data</p>
              ) : (
                (() => {
                  const mainLocations = ["Cruïllas", "Peratallada", "Sant Climent"];
                  const locationColors: Record<string, string> = {
                    "Cruïllas": "bg-blue-500",
                    "Peratallada": "bg-amber-500",
                    "Sant Climent": "bg-emerald-500",
                  };
                  const main = jobsByLocation.filter((item) =>
                    mainLocations.some((m) => item.locationName?.includes(m))
                  );
                  const misc = jobsByLocation.filter((item) =>
                    !mainLocations.some((m) => item.locationName?.includes(m))
                  );
                  const miscTotal = misc.reduce((sum, item) => sum + Number(item.count), 0);

                  return (
                    <div className="space-y-1.5">
                      {main.map((item) => (
                        <Link
                          key={item.locationName ?? "unassigned"}
                          href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-all hover:bg-muted/60"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className={cn("h-2 w-2 rounded-full", locationColors[item.locationName!] ?? "bg-gray-400")} />
                            {item.locationName ?? "Unassigned"}
                          </span>
                          <span className="font-semibold tabular-nums">{item.count}</span>
                        </Link>
                      ))}
                      {miscTotal > 0 && (
                        <>
                          <div className="border-t my-1.5" />
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2">Other</p>
                          {misc.map((item) => (
                            <Link
                              key={item.locationName ?? "unassigned"}
                              href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                              className="flex items-center justify-between rounded-lg px-2 py-1 text-xs transition-all hover:bg-muted/60"
                            >
                              <span className="text-muted-foreground">{item.locationName ?? "Unassigned"}</span>
                              <span className="font-medium tabular-nums text-muted-foreground">{item.count}</span>
                            </Link>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })()
              )}
            </CardContent>
          </Card>

          {/* Follow-ups */}
          {followUps.length > 0 && (
            <Card className="animate-slide-up border-rose-200/50 dark:border-rose-500/20" style={{ animationDelay: "350ms", animationFillMode: "backwards" }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
                  <PhoneOff className="h-3.5 w-3.5" />
                  Needs Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {followUps.slice(0, 6).map((job) => (
                    <Link
                      key={job.id}
                      href={`/repairs/${job.id}`}
                      className="flex items-center justify-between rounded-lg p-2 text-xs transition-all hover:bg-muted/60"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{job.publicCode}</span>
                        <p className="truncate font-medium text-sm">{job.customerName || job.title || "Unknown"}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2 text-[10px] shrink-0">
                        {CUSTOMER_RESPONSE_LABELS[job.customerResponseStatus as CustomerResponseStatus]}
                      </Badge>
                    </Link>
                  ))}
                  {followUps.length > 6 && (
                    <Link href="/repairs?customerResponseStatus=no_response" className="block text-center text-xs text-muted-foreground hover:text-primary py-1">
                      +{followUps.length - 6} more
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
