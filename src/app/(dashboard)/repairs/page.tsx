import { getRepairJobs, getRepairStatusCounts, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";
import { getAllUnits } from "@/actions/units";
import { getTags } from "@/actions/tags";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import { WorkflowGuide } from "@/components/workflow-guide";
import { Button } from "@/components/ui/button";
import { Trash2, Wrench, Clock, Package, Users, AlertTriangle, CheckCircle, FileText, PhoneOff } from "lucide-react";
import Link from "next/link";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RepairsPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters: RepairFilters = {
    q: params.q,
    status: params.status,
    locationId: params.locationId,
    priority: params.priority,
    assignedUserId: params.assignedUserId,
    invoiceStatus: params.invoiceStatus,
    customerResponseStatus: params.customerResponseStatus,
    tagId: params.tagId,
    archived: params.archived,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sort: params.sort,
    dir: params.dir,
    page: params.page ? parseInt(params.page) : 1,
  };

  const [{ jobs, total, page, limit }, locationsList, customersList, partsCatalog, allTags, unitsList, statusCounts] = await Promise.all([
    getRepairJobs(filters),
    getLocations(),
    getAllCustomers(),
    getParts(),
    getTags(),
    getAllUnits(),
    getRepairStatusCounts(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  const { byStatus, urgent } = statusCounts;

  const quickButtons = [
    { label: "To Do", value: (byStatus["new"] ?? 0) + (byStatus["todo"] ?? 0), icon: <Clock className="h-4 w-4" />, status: "todo", bg: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400 ring-orange-300/40" },
    { label: "In Progress", value: (byStatus["in_progress"] ?? 0) + (byStatus["scheduled"] ?? 0) + (byStatus["in_inspection"] ?? 0), icon: <Wrench className="h-4 w-4" />, status: "in_progress", bg: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400 ring-sky-300/40" },
    { label: "Waiting Parts", value: byStatus["waiting_parts"] ?? 0, icon: <Package className="h-4 w-4" />, status: "waiting_parts", bg: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 ring-purple-300/40" },
    { label: "Waiting Customer", value: byStatus["waiting_customer"] ?? 0, icon: <Users className="h-4 w-4" />, status: "waiting_customer", bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 ring-amber-300/40" },
    { label: "Completed", value: byStatus["completed"] ?? 0, icon: <CheckCircle className="h-4 w-4" />, status: "completed", bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 ring-emerald-300/40" },
    { label: "Urgent", value: urgent, icon: <AlertTriangle className="h-4 w-4" />, status: undefined as string | undefined, priority: "urgent" as string | undefined, bg: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 ring-red-300/40" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Repairs</h1>
          <p className="text-sm text-muted-foreground">
            {total} repair{total !== 1 ? "s" : ""} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-9 rounded-lg text-xs">
            <Link href="/repairs/bin">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Bin
            </Link>
          </Button>
          <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} units={unitsList} />
        </div>
      </div>

      {/* Quick status buttons */}
      <div className="flex flex-wrap gap-2">
        {quickButtons.map((btn) => {
          const href = btn.priority
            ? `/repairs?priority=${btn.priority}`
            : `/repairs?status=${btn.status}`;
          const isActive = btn.priority
            ? filters.priority === btn.priority
            : filters.status === btn.status;
          return (
            <Link key={btn.label} href={isActive ? "/repairs" : href}>
              <span className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer ring-1 ${btn.bg} ${isActive ? "ring-2 shadow-md scale-[1.02]" : ""}`}>
                {btn.icon}
                {btn.label}
                <span className="text-base font-bold tabular-nums">{btn.value}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <WorkflowGuide page="repairs" />

      <RepairFiltersBar
        locations={filteredLocations}
        currentFilters={filters}
        allTags={allTags}
      />

      <RepairTable jobs={jobs} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-xs">
                <Link href={`/repairs?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-xs">
                <Link href={`/repairs?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
