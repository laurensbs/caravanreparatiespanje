import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { getLocations } from "@/actions/locations";
import { getSuppliers } from "@/actions/parts";
import { getTags } from "@/actions/tags";
import { Users, Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { CustomerFiltersBar } from "@/components/customers/customer-filters";
import { NewCustomerDialog } from "@/components/customers/new-customer-dialog";
import { HoldedHint } from "@/components/holded-hint";
import { CustomersTableClient } from "@/components/customers/customer-quickview";
import { BusinessesTableClient } from "@/components/customers/businesses-table";

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

  const displayTotal = isBusiness ? suppliersList.length : total;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {displayTotal} {isBusiness ? "business" : "contact"}{displayTotal !== 1 ? (isBusiness ? "es" : "s") : ""}
          </p>
        </div>
        <NewCustomerDialog />
      </div>

      {/* ── Tabs ───────────────────────────────────────── */}
      <div className="flex gap-6 border-b border-gray-200">
        {CONTACT_TYPE_TABS.map((tab) => {
          const isActive = (params.contactType ?? "all") === tab.value;
          const href = tab.value === "all"
            ? `/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}) }).toString()}`
            : `/customers?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.repairStatus ? { repairStatus: params.repairStatus } : {}), ...(params.locationId ? { locationId: params.locationId } : {}), contactType: tab.value }).toString()}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-[#0CC0DF] text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      {!isBusiness && (
        <CustomerFiltersBar
          locations={filteredLocations}
          currentFilters={filters}
          allTags={allTags}
        />
      )}

      {/* ── Holded hint ────────────────────────────────── */}
      {isBusiness ? (
        <HoldedHint variant="readonly">
          Businesses (suppliers) are synced from <strong>Holded</strong>. Edit supplier details in Holded — changes appear here on next sync.
        </HoldedHint>
      ) : (
        <HoldedHint variant="sync">
          Contacts with the <span className="inline-flex items-center text-sky-600"><ExternalLink className="h-2.5 w-2.5 mx-0.5" /></span> icon are linked to Holded. Editing their phone, email, or address will update in Holded too.
        </HoldedHint>
      )}

      {/* ── Table ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border overflow-hidden">
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50/80 dark:bg-muted/80 backdrop-blur-sm border-b border-gray-100 dark:border-border">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Name</th>
                {isBusiness ? (
                  <>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Contact Person</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Phone</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3 hidden md:table-cell">Email</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3 hidden md:table-cell">Website</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Holded</th>
                  </>
                ) : (
                  <>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Type</th>
                    <th className="text-center text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Repairs</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Phone</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3 hidden md:table-cell">Email</th>
                    <th className="text-right text-xs font-medium uppercase tracking-wider text-gray-400 px-5 py-3">Updated</th>
                  </>
                )}
              </tr>
            </thead>
            {isBusiness ? (
              <BusinessesTableClient suppliers={suppliersList} />
            ) : (
              <CustomersTableClient customers={customers} total={total} filters={filters} />
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
