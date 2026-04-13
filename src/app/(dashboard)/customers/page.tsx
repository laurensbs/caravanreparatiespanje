import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { getLocations } from "@/actions/locations";
import { getSuppliers } from "@/actions/parts";
import { getTags } from "@/actions/tags";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { CustomerFiltersBar } from "@/components/customers/customer-filters";
import { NewCustomerDialog } from "@/components/customers/new-customer-dialog";
import { HoldedHint } from "@/components/holded-hint";
import { WorkflowGuide } from "@/components/workflow-guide";
import { CustomersTableClient } from "@/components/customers/customer-quickview";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

const CONTACT_TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "person", label: "Persons" },
  { value: "business", label: "Businesses" },
] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const activeTab = params.contactType ?? "all";
  const isBusiness = activeTab === "business";

  const filters: CustomerFilters = {
    q: params.q,
    contactType: isBusiness ? undefined : params.contactType,
    repairStatus: params.repairStatus,
    locationId: params.locationId,
    tagId: params.tagId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
  };

  const [{ customers, total, limit }, locationsList, allSuppliers, allTags] = await Promise.all([
    isBusiness ? Promise.resolve({ customers: [], total: 0, limit: 50 }) : getCustomers(filters),
    getLocations(),
    isBusiness ? getSuppliers() : Promise.resolve([]),
    getTags(),
  ]);

  // Filter suppliers by search query if present
  const suppliersList = params.q
    ? allSuppliers.filter(s =>
        s.name.toLowerCase().includes(params.q!.toLowerCase()) ||
        s.contactName?.toLowerCase().includes(params.q!.toLowerCase()) ||
        s.email?.toLowerCase().includes(params.q!.toLowerCase()) ||
        s.phone?.includes(params.q!)
      )
    : allSuppliers;

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const totalPages = isBusiness ? 1 : Math.ceil(total / limit);
  const displayTotal = isBusiness ? suppliersList.length : total;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{displayTotal} {isBusiness ? "business" : "contact"}{displayTotal !== 1 ? (isBusiness ? "es" : "s") : ""}</p>
        </div>
        <NewCustomerDialog />
      </div>

      <WorkflowGuide page="customers" />

      {/* Contact type tabs */}
      <div className="flex gap-1 border-b">
        {CONTACT_TYPE_TABS.map((tab) => {
          const isActive = (params.contactType ?? "all") === tab.value;
          const href = tab.value === "all"
            ? `/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}) }).toString()}`
            : `/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), contactType: tab.value }).toString()}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {!isBusiness && (
        <CustomerFiltersBar
          locations={filteredLocations}
          currentFilters={filters}
          allTags={allTags}
        />
      )}

      {isBusiness ? (
        <HoldedHint variant="readonly">
          Businesses (suppliers) are synced from <strong>Holded</strong>. Edit supplier details in Holded — changes appear here on next sync.
        </HoldedHint>
      ) : (
        <HoldedHint variant="sync">
          Contacts with the <span className="inline-flex items-center text-emerald-600"><ExternalLink className="h-2.5 w-2.5 mx-0.5" /></span> icon are linked to Holded. Editing their phone, email, or address will update in Holded too.
        </HoldedHint>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Name</TableHead>
              {isBusiness ? (
                <>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact Person</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider">Website</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Holded</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wider">Repairs</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Phone</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Updated</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          {isBusiness ? (
          <TableBody>
            {suppliersList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-8 w-8 opacity-20" />
                      <p className="font-medium text-sm">No businesses found</p>
                      <p className="text-xs">Businesses are synced from Holded</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                suppliersList.map((s, idx) => (
                  <TableRow key={s.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 20}ms` }}>
                    <TableCell>
                      <span className="font-medium text-[13px]">{s.name}</span>
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{s.contactName ?? "—"}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground hidden md:table-cell">{s.email ?? "—"}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground hidden md:table-cell">
                      {s.website ? (
                        <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px] inline-block">
                          {s.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {s.holdedContactId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                          <ExternalLink className="h-2.5 w-2.5" /> Linked
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
          </TableBody>
          ) : (
            <CustomersTableClient customers={customers} />
          )}
        </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1.5">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-xs">
                <Link href={`/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.contactType ? { contactType: params.contactType } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-xs">
                <Link href={`/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.contactType ? { contactType: params.contactType } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), page: String(page + 1) }).toString()}`}>
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
