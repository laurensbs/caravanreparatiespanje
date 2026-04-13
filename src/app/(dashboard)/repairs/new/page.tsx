import { RepairForm } from "@/components/repairs/repair-form";
import { getLocations } from "@/actions/locations";
import { getAllCustomers } from "@/actions/customers";
import { getParts, getPartCategories } from "@/actions/parts";
import { WorkflowGuide } from "@/components/workflow-guide";

const MAIN_LOCATIONS = ["cruïllas", "peratallada", "sant climent"];

export default async function NewRepairPage() {
  const [locationsList, customersList, partsCatalog, partCategories] = await Promise.all([
    getLocations(),
    getAllCustomers(),
    getParts(),
    getPartCategories(),
  ]);

  const filteredLocations = locationsList.filter(l =>
    MAIN_LOCATIONS.includes(l.name.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">New Repair Job</h1>
        <p className="text-xs text-muted-foreground">Create a new repair job entry</p>
      </div>
      <WorkflowGuide page="repair-new" />
      <RepairForm locations={filteredLocations} customers={customersList} partsCatalog={partsCatalog} partCategories={partCategories} />
    </div>
  );
}
