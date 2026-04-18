import { getRepairJobs, getRepairStatusCounts, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { getTags } from "@/actions/tags";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import Link from "next/link";
import { DashboardPageCanvas, DashboardPageHeader } from "@/components/layout/dashboard-surface";

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
    dueWithin: params.dueWithin,
    mine: params.mine,
    sort: params.sort,
    dir: params.dir,
    page: params.page ? parseInt(params.page) : 1,
  };

  // The NewRepairDialog now lazy-loads its supporting lists (customers,
  // parts, units, part categories) on first open, so this page only
  // selects what the table + filters actually need up-front.
  const [{ jobs, total }, locationsList, allTags, statusCounts] = await Promise.all([
    getRepairJobs(filters),
    getLocations(),
    getTags(),
    getRepairStatusCounts(),
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
    <DashboardPageCanvas>
    <div className="space-y-6 sm:space-y-8">
      <DashboardPageHeader
        eyebrow="Operations"
        title="Work Orders"
        metadata={
          <>
            <span>
              <span className="tabular-nums text-foreground/90 dark:text-foreground/90">{total}</span> work orders
            </span>
            {urgent > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {urgent} urgent
              </span>
            )}
          </>
        }
        actions={<NewRepairDialog locations={filteredLocations} />}
      />

      {/* Focus presets — drop the user straight into the most relevant
          slice without thinking about filters. Highlight the active
          preset; clicking the active one clears it. */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {([
          { key: "today", label: "Today", href: "/repairs?dueWithin=today" },
          { key: "week", label: "This week", href: "/repairs?dueWithin=week" },
          { key: "overdue", label: "Overdue", href: "/repairs?dueWithin=overdue", tone: "destructive" as const },
          { key: "unscheduled", label: "No date", href: "/repairs?dueWithin=unscheduled" },
          { key: "mine", label: "My work", href: "/repairs?mine=1" },
        ] as const).map((focus) => {
          const isActive = focus.key === "mine" ? filters.mine === "1" : filters.dueWithin === focus.key;
          const target = isActive ? "/repairs" : focus.href;
          const isDestructive = "tone" in focus && focus.tone === "destructive";
          return (
            <Link key={focus.key} href={target} className="shrink-0 snap-start touch-manipulation">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium tracking-[-0.005em] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px ${
                  isActive
                    ? isDestructive
                      ? "border-red-300 bg-red-50 text-red-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                      : "border-foreground/20 bg-foreground text-background shadow-[0_2px_8px_-2px_rgba(0,0,0,0.18)]"
                    : isDestructive
                      ? "border-border/60 bg-card text-red-700/80 hover:border-red-300/60 hover:text-red-700 dark:text-red-300/80 dark:hover:text-red-300"
                      : "border-border/60 bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground"
                }`}
              >
                {focus.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Status / priority quick filters — horizontal scroll on narrow screens */}
      <div className="-mx-1 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {quickButtons.map((btn) => {
          const href = btn.priority
            ? `/repairs?priority=${btn.priority}`
            : `/repairs?status=${btn.status}`;
          const isActive = btn.priority
            ? filters.priority === btn.priority
            : filters.status === btn.status;

          const dotColor: Record<string, string> = {
            "To Do": "bg-muted-foreground/40",
            "In Progress": "bg-foreground",
            "Waiting Parts": "bg-amber-400",
            "Waiting Customer": "bg-orange-400",
            "Completed": "bg-emerald-400",
            "Urgent": "bg-red-400",
          };

          return (
            <Link key={btn.label} href={isActive ? "/repairs" : href} className="shrink-0 snap-start touch-manipulation">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs transition-all duration-150 cursor-pointer sm:py-1.5 ${
                isActive
                  ? "bg-foreground dark:bg-card text-white dark:text-foreground font-medium shadow-sm"
                  : "text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground/90 dark:hover:text-foreground/90 hover:bg-muted dark:hover:bg-card/[0.06]"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-card dark:bg-foreground" : (dotColor[btn.label] ?? "bg-foreground/30")}`} />
                {btn.label}
                <span className={`tabular-nums font-medium ${isActive ? "" : "text-foreground/90 dark:text-foreground/80"}`}>{btn.value}</span>
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
    </DashboardPageCanvas>
  );
}
