import { getAllInvoices } from "@/actions/invoices";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, ExternalLink, Wrench } from "lucide-react";
import Link from "next/link";
import { HoldedHint } from "@/components/holded-hint";

export default async function InvoicesPage() {
  const invoices = await getAllInvoices();

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
  const paidCount = invoices.filter((i) => i.status === 1).length;
  const unpaidCount = invoices.filter((i) => i.status === 0).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} from Holded · Total: €{totalRevenue.toFixed(2)}
        </p>
      </div>

      <HoldedHint variant="readonly">
        All invoices are fetched live from <strong>Holded</strong>. To create or edit invoices, use the repair detail page or Holded directly. Invoice numbers link to Holded.
      </HoldedHint>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Invoices</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-emerald-600 uppercase tracking-wider">Paid</p>
            <p className="text-2xl font-bold text-emerald-600">{paidCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] text-red-600 uppercase tracking-wider">Unpaid</p>
            <p className="text-2xl font-bold text-red-600">{unpaidCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-18rem)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Invoice</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Description</TableHead>
                <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Amount</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Receipt className="h-8 w-8 opacity-20" />
                      <p className="font-medium text-sm">No invoices found</p>
                      <p className="text-xs">Invoices created in Holded will appear here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv, idx) => (
                  <TableRow key={inv.id} className="group table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                    <TableCell>
                      <a
                        href={`https://app.holded.com/documents/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[13px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {inv.docNumber}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </TableCell>
                    <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                      {inv.desc || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[13px] tabular-nums">
                      €{inv.total?.toFixed(2) ?? "0.00"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`rounded-full text-[10px] px-2 py-0 ${
                          inv.status === 1
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                            : inv.status === 2
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400"
                        }`}
                      >
                        {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : "Unpaid"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.repairJobId ? (
                        <Link
                          href={`/repairs/${inv.repairJobId}`}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <Wrench className="h-2.5 w-2.5" />
                          {inv.repairPublicCode}
                        </Link>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
