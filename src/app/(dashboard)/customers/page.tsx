import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { getLocations } from "@/actions/locations";
import { getSuppliers } from "@/actions/parts";
import { getTags } from "@/actions/tags";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { CustomerFiltersBar } from "@/components/customers/customer-filters";
import { NewCustomerDialog } from "@/components/customers/new-customer-dialog";
import { HoldedHint } from "@/components/holded-hint";
import { CustomersTableClient } from "@/components/customers/customer-quickview";
import { BusinessesTableClient } from "@/components/customers/businesses-table";
import {
  DashboardPageCanvas,
  DashboardPageHeader,
  SegmentedTabs,
  dashboardPanelClass,
} from "@/components/layout/dashboard-surface";
import { cn } from "@/lib/utils";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

const CONTACT_TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "person", label: "Persons" },
  { value: "business", label: "Businesses" },
] as const;

function qp(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key];
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s || undefined;
}

/** Keep search, repair filter, location, tags, and dates when switching tabs */
function customersListHref(
  params: Record<string, string | string[] | undefined>,
  tab: (typeof CONTACT_TYPE_TABS)[number]["value"],
): string {
  const p = new URLSearchParams();
  for (const key of ["q", "repairStatus", "locationId", "tagId", "dateFrom", "dateTo", "page"] as const) {
    const v = qp(params, key);
    if (v && key !== "page") p.set(key, v);
    else if (v && key === "page" && v !== "1") p.set("page", v);
  }
  if (tab !== "all") p.set("contactType", tab);
  const s = p.toString();
  return s ? `/customers?${s}` : "/customers";
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomersPage({ searchParams }: Props) {
  const params = await searchParams;
  const pageRaw = qp(params, "page");
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
  const activeTab = qp(params, "contactType") ?? "all";
  const isBusiness = activeTab === "business";

  const filters: CustomerFilters = {
    q: qp(params, "q"),
    contactType: isBusiness ? undefined : qp(params, "contactType"),
    repairStatus: qp(params, "repairStatus"),
    locationId: qp(params, "locationId"),
    tagId: qp(params, "tagId"),
    dateFrom: qp(params, "dateFrom"),
    dateTo: qp(params, "dateTo"),
    page,
  };

  const [{ customers, total, limit }, locationsList, allSuppliers, allTags] = await Promise.all([
    isBusiness ? Promise.resolve({ customers: [], total: 0, limit: 50 }) : getCustomers(filters),
    getLocations(),
    isBusiness ? getSuppliers() : Promise.resolve([]),
    getTags(),
  ]);

  // Filter suppliers by search query if present
  const qStr = qp(params, "q");
  const suppliersList = qStr
    ? allSuppliers.filter(s =>
        s.name.toLowerCase().includes(qStr.toLowerCase()) ||
        s.contactName?.toLowerCase().includes(qStr.toLowerCase()) ||
        s.email?.toLowerCase().includes(qStr.toLowerCase()) ||
        s.phone?.includes(qStr)
      )
    : allSuppliers;

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  const displayTotal = isBusiness ? suppliersList.length : total;

  return (
    <DashboardPageCanvas>
    <div className="space-y-6 sm:space-y-8">
      <DashboardPageHeader
        eyebrow="Address book"
        title="Contacts"
        metadata={
          <>
            <span className="tabular-nums">{displayTotal}</span>
            <span>{isBusiness ? "businesses" : "contacts"}</span>
            {!isBusiness && (
              <span className="text-muted-foreground/70 dark:text-muted-foreground">· tap a row for a quick view</span>
            )}
          </>
        }
        description={
          !isBusiness
            ? (
                <>
                  The same record is used on <strong className="font-medium text-foreground dark:text-foreground">work orders</strong>,{" "}
                  <strong className="font-medium text-foreground dark:text-foreground">planning</strong>, and the{" "}
                  <strong className="font-medium text-foreground dark:text-foreground">garage</strong>. When a row is linked to Holded, phone, email, and address stay aligned with accounting.
                </>
              )
            : undefined
        }
        actions={<NewCustomerDialog />}
      />

      <SegmentedTabs
        value={activeTab as (typeof CONTACT_TYPE_TABS)[number]["value"]}
        hrefFor={(v) => customersListHref(params, v)}
        tabs={CONTACT_TYPE_TABS.map((t) => ({ value: t.value, label: t.label }))}
      />

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
          Contacts with the <span className="inline-flex items-center text-foreground/80"><ExternalLink className="h-2.5 w-2.5 mx-0.5" /></span> icon are linked to Holded. Editing their phone, email, or address will update in Holded too.
        </HoldedHint>
      )}

      {/* ── Table (horizontal scroll on small screens — keeps all columns) ─ */}
      <div className={cn("overflow-hidden", dashboardPanelClass)}>
        <div className="max-h-[min(70vh,calc(100vh-14rem))] overflow-auto overscroll-contain sm:max-h-[calc(100vh-16rem)]">
          <table className="w-full min-w-[44rem]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border/60 bg-muted/50 backdrop-blur-sm dark:border-border dark:bg-card/[0.04]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 sm:px-5 dark:text-muted-foreground">Name</th>
                {isBusiness ? (
                  <>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Contact Person</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Phone</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 md:table-cell dark:text-muted-foreground">Email</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 md:table-cell dark:text-muted-foreground">Website</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Holded</th>
                  </>
                ) : (
                  <>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Repairs</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 md:table-cell dark:text-muted-foreground">Phone</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/70 md:table-cell dark:text-muted-foreground">Email</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">Updated</th>
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
    </DashboardPageCanvas>
  );
}
