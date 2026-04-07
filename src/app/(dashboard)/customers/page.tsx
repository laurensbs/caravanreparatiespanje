import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { getLocations } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { CustomerFiltersBar } from "@/components/customers/customer-filters";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const filters: CustomerFilters = {
    q: params.q,
    repairStatus: params.repairStatus,
    locationId: params.locationId,
    page,
  };

  const [{ customers, total, limit }, locationsList] = await Promise.all([
    getCustomers(filters),
    getLocations(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">{total} customer{total !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Link>
        </Button>
      </div>

      <CustomerFiltersBar
        locations={filteredLocations}
        currentFilters={filters}
      />

      <div className="rounded-lg border bg-card max-h-[calc(100vh-16rem)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0] shadow-border">
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Repairs</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.repairCount > 0 ? (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary">
                        {c.repairCount}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm hidden md:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell>
                    <SmartDate date={c.updatedAt} className="text-xs text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), page: String(page + 1) }).toString()}`}>
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
