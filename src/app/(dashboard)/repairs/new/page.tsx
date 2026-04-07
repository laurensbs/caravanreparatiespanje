import { RepairForm } from "@/components/repairs/repair-form";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function NewRepairPage() {
  const [locationsList, customersList, partsCatalog] = await Promise.all([
    getLocations(),
    getAllCustomers(),
    getParts(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Repair Job</h1>
        <p className="text-sm text-muted-foreground">Create a new repair job entry</p>
      </div>
      <RepairForm locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} />
    </div>
  );
}
