import { getDashboardStats, getFollowUpItems } from "@/actions/repairs";
import { getActiveReminderCount } from "@/actions/reminders";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import {
  Wrench, Clock, Package, Users, CheckCircle, AlertTriangle,
  FileSpreadsheet, ArrowRight, Bell, PhoneOff,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const [{ stats, recentJobs, jobsByStatus, jobsByLocation }, followUps, reminderCount, locationsList, customersList, partsCatalog] =
    await Promise.all([
      getDashboardStats(),
      getFollowUpItems(),
      getActiveReminderCount(),
      getLocations(),
      getAllCustomers(),
      getParts(),
    ]);

  const kpiCards = [
    { label: "Total Jobs", value: stats?.total ?? 0, icon: <Wrench className="h-5 w-5" />, color: "text-blue-600", href: "/repairs" },
    { label: "Open Jobs", value: stats?.open ?? 0, icon: <Clock className="h-5 w-5" />, color: "text-orange-600", href: "/repairs?status=in_progress" },
    { label: "Waiting for Parts", value: stats?.waitingParts ?? 0, icon: <Package className="h-5 w-5" />, color: "text-purple-600", href: "/repairs?status=waiting_parts" },
    { label: "Waiting for Customer", value: stats?.waitingCustomer ?? 0, icon: <Users className="h-5 w-5" />, color: "text-amber-600", href: "/repairs?status=waiting_customer" },
    { label: "Completed", value: stats?.completed ?? 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600", href: "/repairs?status=completed" },
    { label: "Urgent", value: stats?.urgent ?? 0, icon: <AlertTriangle className="h-5 w-5" />, color: "text-red-600", href: "/repairs?priority=urgent" },
    { label: "Reminders", value: reminderCount, icon: <Bell className="h-5 w-5" />, color: "text-indigo-600", href: "/repairs" },
    { label: "Need Follow-up", value: followUps.length, icon: <PhoneOff className="h-5 w-5" />, color: "text-rose-600", href: "/repairs?customerResponseStatus=no_response" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caravan Repairs</h1>
          <p className="text-muted-foreground">Overview of all repair operations</p>
        </div>
        <div className="flex gap-2">
          <NewRepairDialog locations={locationsList} customers={customersList} partsCatalog={partsCatalog} />
          <Button variant="outline" asChild>
            <Link href="/import">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import Data
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="transition-all duration-200 hover:bg-muted/50 hover:shadow-md active:scale-[0.98] cursor-pointer animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("rounded-lg p-2 bg-muted/80", kpi.color)}>{kpi.icon}</div>
                  <div>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updated repair jobs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/repairs">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Wrench className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No repair jobs yet</p>
                <Button variant="link" asChild className="mt-2">
                  <Link href="/repairs/new">Create your first repair job</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {job.publicCode}
                        </span>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[job.status as RepairStatus]}
                        >
                          {STATUS_LABELS[job.status as RepairStatus]}
                        </Badge>
                        {job.priority === "urgent" && (
                          <Badge className={PRIORITY_COLORS[job.priority as Priority]}>
                            {PRIORITY_LABELS[job.priority as Priority]}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-medium">
                        {job.title || job.customerName || "Unnamed repair"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.locationName && `${job.locationName} · `}
                        {job.customerName}
                      </p>
                    </div>
                    <div className="ml-4 text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Jobs by Status */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs by Status</CardTitle>
            </CardHeader>
            <CardContent>
              {jobsByStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data</p>
              ) : (
                <div className="space-y-2">
                  {jobsByStatus.map((item) => (
                    <Link
                      key={item.status}
                      href={`/repairs?status=${item.status}`}
                      className="flex items-center justify-between rounded-md p-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <Badge variant="secondary" className={STATUS_COLORS[item.status as RepairStatus]}>
                        {STATUS_LABELS[item.status as RepairStatus]}
                      </Badge>
                      <span className="font-medium">{item.count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Jobs by Location</CardTitle>
            </CardHeader>
            <CardContent>
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
                    <div className="space-y-2">
                      {main.map((item) => (
                        <Link
                          key={item.locationName ?? "unassigned"}
                          href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                          className="flex items-center justify-between rounded-md p-1.5 text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="text-muted-foreground">
                            {item.locationName ?? "Unassigned"}
                          </span>
                          <span className="font-medium">{item.count}</span>
                        </Link>
                      ))}
                      {miscTotal > 0 && (
                        <>
                          <div className="border-t my-2" />
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1.5">Misc</p>
                          {misc.map((item) => (
                            <Link
                              key={item.locationName ?? "unassigned"}
                              href={item.locationId ? `/repairs?locationId=${item.locationId}` : "/repairs"}
                              className="flex items-center justify-between rounded-md p-1.5 text-sm transition-colors hover:bg-muted/50"
                            >
                              <span className="text-muted-foreground text-xs">
                                {item.locationName ?? "Unassigned"}
                              </span>
                              <span className="font-medium text-xs text-muted-foreground">{item.count}</span>
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

          {/* Follow-up Required */}
          {followUps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-rose-600">
                  <PhoneOff className="h-4 w-4" />
                  Needs Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {followUps.slice(0, 8).map((job) => (
                    <Link
                      key={job.id}
                      href={`/repairs/${job.id}`}
                      className="flex items-center justify-between rounded-md border p-2 text-xs transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-muted-foreground">
                          {job.publicCode}
                        </span>
                        <p className="truncate font-medium">
                          {job.customerName || job.title || "Unknown"}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="ml-2 text-[10px]"
                      >
                        {CUSTOMER_RESPONSE_LABELS[job.customerResponseStatus as CustomerResponseStatus]}
                      </Badge>
                    </Link>
                  ))}
                  {followUps.length > 8 && (
                    <p className="text-center text-xs text-muted-foreground">
                      +{followUps.length - 8} more
                    </p>
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
