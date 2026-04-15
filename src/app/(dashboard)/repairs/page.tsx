import { getRepairJobs, getRepairStatusCounts, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts, getPartCategories } from "@/actions/parts";
import { getAllUnits } from "@/actions/units";
import { getTags } from "@/actions/tags";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
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
    jobType: params.jobType,
    archived: params.archived,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    sort: params.sort,
    dir: params.dir,
    page: params.page ? parseInt(params.page) : 1,
  };

  const [{ jobs, total }, locationsList, customersList, partsCatalog, allTags, unitsList, statusCounts, partCategories] = await Promise.all([
    getRepairJobs(filters),
    getLocations(),
    getAllCustomers(),
    getParts(),
    getTags(),
    getAllUnits(),
    getRepairStatusCounts(),
    getPartCategories(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const { byStatus, urgent } = statusCounts;

  const quickButtons = [
    { label: "To Do", value: (byStatus["new"] ?? 0) + (byStatus["todo"] ?? 0), status: "todo" },
    { label: "In Progress", value: (byStatus["in_progress"] ?? 0) + (byStatus["scheduled"] ?? 0) + (byStatus["in_inspection"] ?? 0), status: "in_progress" },
    { label: "Waiting Parts", value: byStatus["waiting_parts"] ?? 0, status: "waiting_parts" },
    { label: "Waiting Customer", value: byStatus["waiting_customer"] ?? 0, status: "waiting_customer" },
    { label: "Completed", value: byStatus["completed"] ?? 0, status: "completed" },
    { label: "Urgent", value: urgent, status: undefined as string | undefined, priority: "urgent" as string | undefined },
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Work Orders</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {total} work order{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
            <Link href="/repairs/bin">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Bin
            </Link>
          </Button>
          <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} partCategories={partCategories} units={unitsList} />
        </div>
      </div>

      {/* Quick filters — subtle chips with semantic color dots */}
      <div className="flex flex-wrap gap-1.5">
        {quickButtons.map((btn) => {
          const href = btn.priority
            ? `/repairs?priority=${btn.priority}`
            : `/repairs?status=${btn.status}`;
          const isActive = btn.priority
            ? filters.priority === btn.priority
            : filters.status === btn.status;

          const dotColor: Record<string, string> = {
            "To Do": "bg-gray-400",
            "In Progress": "bg-sky-400",
            "Waiting Parts": "bg-amber-400",
            "Waiting Customer": "bg-orange-400",
            "Completed": "bg-emerald-400",
            "Urgent": "bg-red-400",
          };

          return (
            <Link key={btn.label} href={isActive ? "/repairs" : href}>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-white dark:bg-gray-900" : (dotColor[btn.label] ?? "bg-gray-300")}`} />
                {btn.label}
                <span className={`tabular-nums font-medium ${isActive ? "" : "text-gray-700 dark:text-slate-300"}`}>{btn.value}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <RepairFiltersBar
        locations={filteredLocations}
        currentFilters={filters}
        allTags={allTags}
        datasetFacets={{
          invoiceStatuses: [...new Set(jobs.map(j => j.invoiceStatus))],
          responseStatuses: [...new Set(jobs.map(j => j.customerResponseStatus))],
          priorities: [...new Set(jobs.map(j => j.priority))],
          locationIds: [...new Set(jobs.map(j => j.locationId).filter(Boolean))] as string[],
          tagIds: [...new Set(jobs.flatMap(j => j.tags?.map((t: { id: string }) => t.id) ?? []))],
          hasDateVariation: jobs.length > 1 && new Set(jobs.map(j => j.createdAt?.toString().slice(0, 10))).size > 1,
        }}
      />

      <RepairTable jobs={jobs} total={total} filters={filters} />
    </div>
  );
}
