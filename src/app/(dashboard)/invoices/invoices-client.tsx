"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, ExternalLink, Wrench, Search, FileDown, Send, X, Filter } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { downloadHoldedInvoicePdf, sendHoldedInvoice } from "@/actions/holded";
import { markInvoicePaid } from "@/actions/invoices";
import { useRouter } from "next/navigation";
import { WorkflowGuide } from "@/components/workflow-guide";

interface Invoice {
  id: string;
  docNumber: string;
  contact: string;
  contactName: string;
  date: number;
  dueDate?: number;
  total: number;
  subtotal: number;
  status: number;
  currency: string;
  desc?: string;
  repairJobId?: string;
  repairPublicCode?: string;
  customerName?: string;
  customerEmail?: string;
}

interface InvoicesClientProps {
  invoices: Invoice[];
}

type StatusFilter = "all" | "unpaid" | "paid" | "partial";

export function InvoicesClient({ invoices }: InvoicesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = invoices;

    // Status filter
    if (statusFilter === "unpaid") result = result.filter(i => i.status === 0);
    else if (statusFilter === "paid") result = result.filter(i => i.status === 1);
    else if (statusFilter === "partial") result = result.filter(i => i.status === 2);

    // Search filter (invoice number, contact name, description)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.docNumber?.toLowerCase().includes(q) ||
        (i.customerName ?? i.contactName)?.toLowerCase().includes(q) ||
        i.desc?.toLowerCase().includes(q)
      );
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom).getTime() / 1000;
      result = result.filter(i => (i.date ?? 0) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() / 1000 + 86400; // end of day
      result = result.filter(i => (i.date ?? 0) <= to);
    }

    return result;
  }, [invoices, statusFilter, search, dateFrom, dateTo]);

  const totalRevenue = filtered.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
  const paidCount = filtered.filter(i => i.status === 1).length;
  const unpaidCount = filtered.filter(i => i.status === 0).length;
  const unpaidTotal = filtered.filter(i => i.status !== 1).reduce((sum, inv) => sum + (inv.total ?? 0), 0);

  const hasActiveFilters = statusFilter !== "all" || search.trim() || dateFrom || dateTo;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  async function handleDownloadPdf(inv: Invoice) {
    if (!inv.repairJobId) {
      // Open in Holded if no repair job linked
      window.open("https://app.holded.com/sales/revenue", "_blank");
      return;
    }
    setActionLoading(`pdf-${inv.id}`);
    try {
      const { data, filename } = await downloadHoldedInvoicePdf(inv.repairJobId);
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${data}`;
      link.download = filename;
      link.click();
      toast.success("PDF downloaded");
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSendEmail(inv: Invoice) {
    if (!inv.repairJobId) {
      toast.error("No repair job linked — send from Holded directly");
      return;
    }
    setActionLoading(`send-${inv.id}`);
    try {
      await sendHoldedInvoice(inv.repairJobId);
      toast.success("Invoice sent via email");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkPaid(inv: Invoice) {
    setActionLoading(`pay-${inv.id}`);
    try {
      await markInvoicePaid(inv.id);
      toast.success(`Invoice ${inv.docNumber} marked as paid`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} from Holded
          {hasActiveFilters && ` (${invoices.length} total)`}
        </p>
      </div>

      <WorkflowGuide page="invoices" />

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold tabular-nums">€{totalRevenue.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">{filtered.length} invoices</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-emerald-600 uppercase tracking-wider">Paid</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{paidCount}</p>
            <p className="text-[11px] text-muted-foreground">€{(totalRevenue - unpaidTotal).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-red-600 uppercase tracking-wider">Unpaid</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">{unpaidCount}</p>
            <p className="text-[11px] text-muted-foreground">€{unpaidTotal.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-amber-600 uppercase tracking-wider">Partial</p>
            <p className="text-xl font-bold text-amber-600 tabular-nums">{filtered.filter(i => i.status === 2).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-[120px] text-xs rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-[130px] text-xs rounded-lg"
          />
          <span>to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-[130px] text-xs rounded-lg"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
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
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Receipt className="h-8 w-8 opacity-20" />
                      <p className="font-medium text-sm">
                        {hasActiveFilters ? "No invoices match filters" : "No invoices found"}
                      </p>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((inv, idx) => (
                  <TableRow key={inv.id} className="group table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                    <TableCell>
                      <a
                        href="https://app.holded.com/sales/revenue"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[13px] text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {inv.docNumber}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </TableCell>
                    <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap">
                      {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                      {inv.desc || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-[13px] tabular-nums">
                      €{inv.total?.toFixed(2) ?? "0.00"}
                    </TableCell>
                    <TableCell>
                      {inv.status === 1 ? (
                        <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                          Paid
                        </Badge>
                      ) : inv.status === 2 ? (
                        <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400">
                          Partial
                        </Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv)}
                          disabled={actionLoading === `pay-${inv.id}`}
                          className="cursor-pointer"
                          title="Click to mark as paid"
                        >
                          <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 transition-colors">
                            {actionLoading === `pay-${inv.id}` ? "Updating..." : "Unpaid"}
                          </Badge>
                        </button>
                      )}
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
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Download PDF"
                          disabled={actionLoading === `pdf-${inv.id}`}
                          onClick={() => handleDownloadPdf(inv)}
                        >
                          <FileDown className="h-3 w-3" />
                        </Button>
                        {inv.repairJobId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Send via email"
                            disabled={actionLoading === `send-${inv.id}`}
                            onClick={() => handleSendEmail(inv)}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
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
