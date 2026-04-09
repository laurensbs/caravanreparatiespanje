import { getAllInvoices, getAllQuotes } from "@/actions/invoices";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const [invoices, quotes] = await Promise.all([getAllInvoices(), getAllQuotes()]);
  const initialTab = params.tab === "quotes" ? "quotes" : "invoices";

  return <InvoicesClient invoices={invoices} quotes={quotes} initialTab={initialTab as any} />;
}

