import { getRepairJobs, getRepairStatusCounts, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { getTags } from "@/actions/tags";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import { RepairFocusBar } from "@/components/repairs/repair-focus-bar";
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

  const { urgent, byStatus, byDate } = statusCounts;

  // "To Do" = alles wat nog niet is opgepakt (zelfde groepering als
  // getDashboardStats). "In Garage" is letterlijk de status `in_progress`:
  // wat er fysiek in de werkplaats ligt. Die telling expres NIET
  // uitbreiden met scheduled/inspection — anders verliest het cijfer zijn
  // betekenis voor de werker die wil weten "wat staat er nu hier?".
  const todoCount = (byStatus.new ?? 0) + (byStatus.todo ?? 0);
  const inGarageCount = byStatus.in_progress ?? 0;
  const waitingPartsCount = byStatus.waiting_parts ?? 0;
  const waitingCustomerCount = byStatus.waiting_customer ?? 0;
  const readyForCheckCount = byStatus.ready_for_check ?? 0;
  const quoteNeededCount = byStatus.quote_needed ?? 0;

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

      {/* Focus + status snapshot in één rij, gegroepeerd in drie blokken
          met subtiele scheidingsstreepjes:
            1. WHEN — date-presets (today / this week / overdue / no date)
            2. MY WORK — wat de werker zelf moet doen (to do / in garage / ready)
            3. WAITING ON — wat blokkeert (parts / contact / quote)
          Elke chip toont z'n live count zodat het overzicht meetbaar is.
          "Mine" en de blokkerings-chips verbergen we als ze 0 zijn,
          zodat de rij niet onnodig wordt opgeblazen. De kern-stroom
          (To Do / In Garage / Ready) blijft altijd staan zodat een
          werker die elke ochtend opent, vaste ankerpunten heeft. */}
      <RepairFocusBar filters={filters} chips={[
        { group: "when", key: "today", label: "Today", count: byDate.today, href: "/repairs?dueWithin=today", isActive: filters.dueWithin === "today" },
        { group: "when", key: "week", label: "This week", count: byDate.week, href: "/repairs?dueWithin=week", isActive: filters.dueWithin === "week" },
        { group: "when", key: "overdue", label: "Overdue", count: byDate.overdue, href: "/repairs?dueWithin=overdue", isActive: filters.dueWithin === "overdue", tone: "destructive", hideIfEmpty: true },
        { group: "when", key: "unscheduled", label: "No date", count: byDate.unscheduled, href: "/repairs?dueWithin=unscheduled", isActive: filters.dueWithin === "unscheduled" },
        { group: "mine", key: "todo", label: "To Do", count: todoCount, href: "/repairs?status=todo", isActive: filters.status === "todo" },
        { group: "mine", key: "in_progress", label: "In Garage", count: inGarageCount, href: "/repairs?status=in_progress", isActive: filters.status === "in_progress", tone: "solid" },
        { group: "mine", key: "ready_for_check", label: "Ready for Check", count: readyForCheckCount, href: "/repairs?status=ready_for_check", isActive: filters.status === "ready_for_check", tone: "amber" },
        { group: "mine", key: "mine", label: "My work", count: null, href: "/repairs?mine=1", isActive: filters.mine === "1" },
        { group: "waiting", key: "waiting_parts", label: "Waiting for Parts", count: waitingPartsCount, href: "/repairs?status=waiting_parts", isActive: filters.status === "waiting_parts", tone: "amber", hideIfEmpty: true },
        { group: "waiting", key: "waiting_customer", label: "Waiting for Contact", count: waitingCustomerCount, href: "/repairs?status=waiting_customer", isActive: filters.status === "waiting_customer", tone: "orange", hideIfEmpty: true },
        { group: "waiting", key: "quote_needed", label: "Quote Needed", count: quoteNeededCount, href: "/repairs?status=quote_needed", isActive: filters.status === "quote_needed", tone: "amber", hideIfEmpty: true },
      ]} />

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
