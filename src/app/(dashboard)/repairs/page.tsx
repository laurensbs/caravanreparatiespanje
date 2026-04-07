import { getRepairJobs, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { NewRepairDialog } from "@/components/repairs/new-repair-dialog";
import { Button } from "@/components/ui/button";
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
    archived: params.archived,
    sort: params.sort,
    dir: params.dir,
    page: params.page ? parseInt(params.page) : 1,
  };

  const [{ jobs, total, page, limit }, locationsList, customersList, partsCatalog] = await Promise.all([
    getRepairJobs(filters),
    getLocations(),
    getAllCustomers(),
    getParts(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repairs</h1>
          <p className="text-sm text-muted-foreground">
            {total} repair{total !== 1 ? "s" : ""} found
          </p>
        </div>
        <NewRepairDialog locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} />
      </div>

      <RepairFiltersBar
        locations={filteredLocations}
        currentFilters={filters}
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
