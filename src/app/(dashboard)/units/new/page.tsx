import { getAllCustomers } from "@/actions/customers";
import { NewUnitForm } from "./new-unit-form";

export default async function NewUnitPage() {
  const customers = await getAllCustomers();

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-lg font-bold tracking-tight">New Unit</h1>
      <NewUnitForm customers={customers} />
    </div>
  );
}
