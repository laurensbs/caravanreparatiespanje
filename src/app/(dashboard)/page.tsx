import { getDashboardStats, getFollowUpItems } from "@/actions/repairs";
import { getActiveReminderCount } from "@/actions/reminders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Wrench, Clock, Package, Users, CheckCircle, AlertTriangle,
  Plus, FileSpreadsheet, ArrowRight, Bell, PhoneOff,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, PRIORITY_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const [{ stats, recentJobs, jobsByStatus, jobsByLocation }, followUps, reminderCount] =
    await Promise.all([
      getDashboardStats(),
      getFollowUpItems(),
      getActiveReminderCount(),
    ]);

  const kpiCards = [
    { label: "Total Jobs", value: stats?.total ?? 0, icon: <Wrench className="h-5 w-5" />, color: "text-blue-600" },
    { label: "Open Jobs", value: stats?.open ?? 0, icon: <Clock className="h-5 w-5" />, color: "text-orange-600" },
    { label: "Waiting for Parts", value: stats?.waitingParts ?? 0, icon: <Package className="h-5 w-5" />, color: "text-purple-600" },
    { label: "Waiting for Customer", value: stats?.waitingCustomer ?? 0, icon: <Users className="h-5 w-5" />, color: "text-amber-600" },
    { label: "Completed", value: stats?.completed ?? 0, icon: <CheckCircle className="h-5 w-5" />, color: "text-emerald-600" },
    { label: "Urgent", value: stats?.urgent ?? 0, icon: <AlertTriangle className="h-5 w-5" />, color: "text-red-600" },
    { label: "Reminders", value: reminderCount, icon: <Bell className="h-5 w-5" />, color: "text-indigo-600" },
    { label: "Need Follow-up", value: followUps.length, icon: <PhoneOff className="h-5 w-5" />, color: "text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of all repair operations</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/repairs/new">
              <Plus className="mr-2 h-4 w-4" />
              New Repair
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/import">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Import Data
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={kpi.color}>{kpi.icon}</div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
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
                    <div key={item.status} className="flex items-center justify-between text-sm">
                      <Badge variant="secondary" className={STATUS_COLORS[item.status as RepairStatus]}>
                        {STATUS_LABELS[item.status as RepairStatus]}
                      </Badge>
                      <span className="font-medium">{item.count}</span>
                    </div>
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
                <div className="space-y-2">
                  {jobsByLocation.map((item) => (
                    <div key={item.locationName ?? "unassigned"} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.locationName ?? "Unassigned"}
                      </span>
                      <span className="font-medium">{item.count}</span>
                    </div>
                  ))}
                </div>
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
