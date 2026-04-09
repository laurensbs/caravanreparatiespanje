import { getAllInvoices, getAllQuotes, getOverdueInvoices } from "@/actions/invoices";
import { InvoicesClient } from "./invoices-client";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const [invoices, quotes, overdue] = await Promise.all([
    getAllInvoices(),
    getAllQuotes(),
    getOverdueInvoices(),
  ]);
  const initialTab = params.tab === "quotes" ? "quotes" : params.tab === "overdue" ? "overdue" : "invoices";

  return <InvoicesClient invoices={invoices} quotes={quotes} overdue={overdue} initialTab={initialTab as any} />;
}

