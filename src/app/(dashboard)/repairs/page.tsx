import { getRepairJobs, type RepairFilters } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { RepairTable } from "@/components/repairs/repair-table";
import { RepairFiltersBar } from "@/components/repairs/repair-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

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
    page: params.page ? parseInt(params.page) : 1,
  };

  const [{ jobs, total, page, limit }, locationsList] = await Promise.all([
    getRepairJobs(filters),
    getLocations(),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repair Jobs</h1>
          <p className="text-muted-foreground">
            {total} repair{total !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button asChild>
          <Link href="/repairs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Repair
          </Link>
        </Button>
      </div>

      <RepairFiltersBar
        locations={locationsList}
        currentFilters={filters}
      />

      <RepairTable jobs={jobs} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/repairs?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
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
