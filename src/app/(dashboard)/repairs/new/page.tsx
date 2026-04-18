import { RepairForm } from "@/components/repairs/repair-form";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts, getPartCategories } from "@/actions/parts";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

interface Props {
  searchParams: Promise<{ customerId?: string }>;
}

export default async function NewRepairPage({ searchParams }: Props) {
  const params = await searchParams;
  const [locationsList, customersList, partsCatalog, partCategories] = await Promise.all([
    getLocations(),
    getAllCustomers(),
    getParts(),
    getPartCategories(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  // Validate that the prefill id actually exists in our customer list,
  // otherwise we silently drop it instead of pre-selecting a phantom.
  const defaultCustomerId =
    params.customerId && customersList.some((c) => c.id === params.customerId)
      ? params.customerId
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-0.5 animate-fade-in sm:px-0">
      <div>
        <h1 className="text-lg font-bold tracking-tight">New Repair Job</h1>
        <p className="text-xs text-muted-foreground">Create a new repair job entry</p>
      </div>
      <RepairForm
        locations={filteredLocations}
        customers={customersList}
        partsCatalog={partsCatalog}
        partCategories={partCategories}
        defaultCustomerId={defaultCustomerId}
      />
    </div>
  );
}
