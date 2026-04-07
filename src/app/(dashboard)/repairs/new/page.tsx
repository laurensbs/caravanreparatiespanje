import { RepairForm } from "@/components/repairs/repair-form";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";

export default async function NewRepairPage() {
  const [locationsList, customersList] = await Promise.all([
    getLocations(),
    getAllCustomers(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Repair Job</h1>
        <p className="text-muted-foreground">Create a new repair job entry</p>
      </div>
      <RepairForm locations={locationsList} customers={customersList} />
    </div>
  );
}
