import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { getLocations } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { CustomerFiltersBar } from "@/components/customers/customer-filters";
import { NewCustomerDialog } from "@/components/customers/new-customer-dialog";

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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">{total} customer{total !== 1 ? "s" : ""}</p>
        </div>
        <NewCustomerDialog />
      </div>

      <CustomerFiltersBar
        locations={filteredLocations}
        currentFilters={filters}
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider">Repairs</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Phone</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users className="h-8 w-8 opacity-20" />
                    <p className="font-medium text-sm">No customers found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c, idx) => (
                <TableRow key={c.id} className="group table-row-animate" style={{ animationDelay: `${idx * 20}ms` }}>
                  <TableCell>
                    <Link href={`/customers/${c.id}`} className="font-medium text-[13px] group-hover:text-primary transition-colors">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.repairCount > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                        {c.repairCount}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground hidden md:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell>
                    <SmartDate date={c.updatedAt} className="text-[11px] text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
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
