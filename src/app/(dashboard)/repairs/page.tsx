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
import { Trash2 } from "lucide-react";
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

  const [{ jobs, total }, locationsList, customersList, partsCatalog, allTags, unitsList, statusCounts] = await Promise.all([
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

  const { byStatus, urgent } = statusCounts;

  const quickButtons = [
    { label: "To Do", value: (byStatus["new"] ?? 0) + (byStatus["todo"] ?? 0), status: "todo", color: "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800/50" },
    { label: "In Progress", value: (byStatus["in_progress"] ?? 0) + (byStatus["scheduled"] ?? 0) + (byStatus["in_inspection"] ?? 0), status: "in_progress", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30" },
    { label: "Waiting Parts", value: byStatus["waiting_parts"] ?? 0, status: "waiting_parts", color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30" },
    { label: "Waiting Customer", value: byStatus["waiting_customer"] ?? 0, status: "waiting_customer", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30" },
    { label: "Completed", value: byStatus["completed"] ?? 0, status: "completed", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30" },
    { label: "Urgent", value: urgent, status: undefined as string | undefined, priority: "urgent" as string | undefined, color: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Repairs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} repair{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg text-xs text-muted-foreground">
            <Link href="/repairs/bin">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Bin
            </Link>
          </Button>
          <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} units={unitsList} />
        </div>
      </div>

      {/* Quick filters — calm pills */}
      <div className="flex flex-wrap gap-1.5">
        {quickButtons.map((btn) => {
          const href = btn.priority
            ? `/repairs?priority=${btn.priority}`
            : `/repairs?status=${btn.status}`;
          const isActive = btn.priority
            ? filters.priority === btn.priority
            : filters.status === btn.status;
          return (
            <Link key={btn.label} href={isActive ? "/repairs" : href}>
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                isActive ? `${btn.color} ring-1 ring-current/20 shadow-sm` : "text-muted-foreground hover:bg-muted/50"
              }`}>
                {btn.label}
                <span className="tabular-nums font-semibold">{btn.value}</span>
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

      <RepairTable jobs={jobs} total={total} filters={filters} />
    </div>
  );
}
