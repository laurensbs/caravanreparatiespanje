import { getAllInvoices } from "@/actions/invoices";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const invoices = await getAllInvoices();

  return <InvoicesClient invoices={invoices} />;
}

