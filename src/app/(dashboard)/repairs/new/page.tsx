import { RepairForm } from "@/components/repairs/repair-form";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts } from "@/actions/parts";

export default async function NewRepairPage() {
  const [locationsList, customersList, partsCatalog] = await Promise.all([
    getLocations(),
    getAllCustomers(),
    getParts(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Repair Job</h1>
        <p className="text-muted-foreground">Create a new repair job entry</p>
      </div>
      <RepairForm locations={locationsList} customers={customersList} partsCatalog={partsCatalog} />
    </div>
  );
}
