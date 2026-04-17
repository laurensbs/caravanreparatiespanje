import { getAllInvoices, getAllQuotes, getOverdueInvoices, getOverdueEstimates } from "@/actions/invoices";
import { InvoicesClient } from "./invoices-client";
import { cn } from "@/lib/utils";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const [invoices, quotes, overdue, overdueEstimates] = await Promise.all([
    getAllInvoices(),
    getAllQuotes(),
    getOverdueInvoices(),
    getOverdueEstimates(),
  ]);
  const initialTab = params.tab === "quotes" ? "quotes" : params.tab === "overdue" ? "overdue" : "invoices";

  return (
    <div className="mx-auto w-full max-w-7xl animate-fade-in px-0 sm:px-0">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm",
          "max-sm:rounded-none max-sm:border-x-0 max-sm:border-b-0 max-sm:shadow-none"
        )}
      >
        <InvoicesClient
          invoices={invoices}
          quotes={quotes}
          overdue={overdue}
          overdueEstimates={overdueEstimates}
          initialTab={initialTab as "invoices" | "quotes" | "overdue"}
        />
      </div>
    </div>
  );
}

