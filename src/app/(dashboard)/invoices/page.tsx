import { getAllInvoices, getAllQuotes } from "@/actions/invoices";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage() {
  const [invoices, quotes] = await Promise.all([getAllInvoices(), getAllQuotes()]);

  return <InvoicesClient invoices={invoices} quotes={quotes} />;
}

