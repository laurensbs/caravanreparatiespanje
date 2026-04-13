"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Wrench, Search, ExternalLink, Send, X, Filter, FileText, AlertTriangle, Clock, Phone, Info } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { sendHoldedInvoice } from "@/actions/holded";
import { markInvoicePaid, sendPaymentReminder } from "@/actions/invoices";
import { useRouter } from "next/navigation";
import { WorkflowGuide } from "@/components/workflow-guide";
import { cn } from "@/lib/utils";

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
  lastPaymentReminderAt?: Date | null;
}

interface Quote {
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
  approvedAt?: number | null;
  repairJobId?: string;
  repairPublicCode?: string;
  customerName?: string;
}

interface OverdueInvoice extends Invoice {
  daysOverdue: number;
}

interface InvoicesClientProps {
  invoices: Invoice[];
  quotes: Quote[];
  overdue: OverdueInvoice[];
}

type StatusFilter = "all" | "unpaid" | "paid" | "partial";
type Tab = "invoices" | "quotes" | "overdue";

export function InvoicesClient({ invoices, quotes, overdue, initialTab }: InvoicesClientProps & { initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab ?? "invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReminder, setConfirmReminder] = useState<string | null>(null);

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

  const filteredQuotes = useMemo(() => {
    let result = quotes;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.docNumber?.toLowerCase().includes(q) ||
        (i.customerName ?? i.contactName)?.toLowerCase().includes(q) ||
        i.desc?.toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime() / 1000;
      result = result.filter(i => (i.date ?? 0) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() / 1000 + 86400;
      result = result.filter(i => (i.date ?? 0) <= to);
    }
    return result;
  }, [quotes, search, dateFrom, dateTo]);

  const paidCount = filtered.filter(i => i.status === 1).length;
  const unpaidCount = filtered.filter(i => i.status === 0).length;

  const hasActiveFilters = statusFilter !== "all" || search.trim() || dateFrom || dateTo;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function openInvoiceInHolded(inv: Invoice) {
    window.open(`/api/holded/pdf?type=invoice&id=${inv.id}`, "_blank");
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

  async function handleSendReminder(inv: OverdueInvoice) {
    const email = inv.customerEmail;
    if (!email) {
      toast.error("No customer email on file — send from Holded directly");
      return;
    }
    setActionLoading(`reminder-${inv.id}`);
    try {
      await sendPaymentReminder(inv.id, [email]);
      toast.success(`Reminder sent to ${email}`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reminder");
    } finally {
      setActionLoading(null);
      setConfirmReminder(null);
    }
  }

  const overdueTotal = overdue.reduce((sum, inv) => sum + (inv.total ?? 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Invoices & Quotes</h1>
        <p className="text-xs text-muted-foreground">
          {tab === "invoices"
            ? `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""} from Holded${hasActiveFilters ? ` (${invoices.length} total)` : ""}`
            : tab === "quotes"
            ? `${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? "s" : ""} from Holded${hasActiveFilters ? ` (${quotes.length} total)` : ""}`
            : `${overdue.length} overdue invoice${overdue.length !== 1 ? "s" : ""} · €${overdueTotal.toFixed(2)} outstanding`
          }
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab("invoices")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            tab === "invoices" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Receipt className="h-3 w-3" />
          Invoices ({invoices.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("quotes")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            tab === "quotes" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FileText className="h-3 w-3" />
          Quotes ({quotes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("overdue")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            tab === "overdue" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          Overdue ({overdue.length})
          {overdue.length > 0 && (
            <span className="ml-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
              {overdue.length}
            </span>
          )}
        </button>
      </div>

      <WorkflowGuide page="invoices" />

      {/* Shared filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={tab === "invoices" ? "Search invoices..." : "Search quotes..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>
        {tab === "invoices" && (
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
        )}
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-8 w-[130px] text-xs rounded-lg"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-8 w-[130px] text-xs rounded-lg"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {tab === "invoices" && (
        <>
          {/* Invoice summary cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-xl font-bold tabular-nums">{filtered.length}</p>
            <p className="text-[11px] text-muted-foreground">invoices</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-emerald-600 uppercase tracking-wider">Paid</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{paidCount}</p>
            <p className="text-[11px] text-muted-foreground">invoices</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-red-600 uppercase tracking-wider">Unpaid</p>
            <p className="text-xl font-bold text-red-600 tabular-nums">{unpaidCount}</p>
            <p className="text-[11px] text-muted-foreground">invoices</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-amber-600 uppercase tracking-wider">Partial</p>
            <p className="text-xl font-bold text-amber-600 tabular-nums">{filtered.filter(i => i.status === 2).length}</p>
            <p className="text-[11px] text-muted-foreground">invoices</p>
          </CardContent>
        </Card>
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
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
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
                filtered.map((inv, idx) => {
                  const isDraft = inv.status === 0 && (inv as any).draft === 1;
                  return (
                  <TableRow key={inv.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                    <TableCell>
                      {isDraft ? (
                        <span className="font-medium text-[13px] text-muted-foreground">
                          {inv.docNumber || "Draft"}
                        </span>
                      ) : (
                        <a
                          href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[13px] text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {inv.docNumber}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                    <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap">
                      {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                      {inv.desc || "—"}
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
                          title="View PDF"
                          onClick={() => openInvoiceInHolded(inv)}
                        >
                          <ExternalLink className="h-3 w-3" />
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
                  );})
              )}
            </TableBody>
          </Table>
        </div>
      </div>
        </>
      )}
      {tab === "quotes" && (
        /* ─── Quotes Tab ─── */
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            <Card className="rounded-xl">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-xl font-bold tabular-nums">{quotes.length}</p>
                <p className="text-[11px] text-muted-foreground">quotes</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-emerald-600 uppercase tracking-wider">Approved</p>
                <p className="text-xl font-bold text-emerald-600 tabular-nums">{quotes.filter(q => q.approvedAt).length}</p>
                <p className="text-[11px] text-muted-foreground">quotes</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-blue-600 uppercase tracking-wider">Linked</p>
                <p className="text-xl font-bold text-blue-600 tabular-nums">{quotes.filter(q => q.repairJobId).length}</p>
                <p className="text-[11px] text-muted-foreground">to repairs</p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Quote</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Amount</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8 opacity-20" />
                          <p className="font-medium text-sm">No quotes found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQuotes.map((q, idx) => {
                      const isDraft = (q as any).draft === 1;
                      return (
                      <TableRow key={q.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                        <TableCell>
                          {isDraft ? (
                            <span className="font-medium text-[13px] text-muted-foreground">
                              {q.docNumber || "Draft"}
                            </span>
                          ) : (
                            <a
                              href={`/api/holded/pdf?type=estimate&id=${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[13px] text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {q.docNumber}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-[13px]">{q.customerName ?? q.contactName}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap">
                          {q.date ? new Date(q.date * 1000).toLocaleDateString("nl-NL") : "—"}
                        </TableCell>
                        <TableCell className="text-[13px] font-medium tabular-nums text-right">
                          €{q.total?.toFixed(2) ?? "0.00"}
                        </TableCell>
                        <TableCell>
                          {q.approvedAt ? (
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                              Approved
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {q.repairJobId ? (
                            <Link
                              href={`/repairs/${q.repairJobId}`}
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <Wrench className="h-2.5 w-2.5" />
                              {q.repairPublicCode}
                            </Link>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      );})
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
      {tab === "overdue" && (
        /* ─── Overdue Tab ─── */
        <>
          {/* Overdue summary */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <Card className="rounded-xl border-red-200 dark:border-red-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-red-600 uppercase tracking-wider">Overdue</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">{overdue.length}</p>
                <p className="text-[11px] text-muted-foreground">invoices</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-red-200 dark:border-red-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-red-600 uppercase tracking-wider">Outstanding</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">€{overdueTotal.toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground">total owed</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-amber-200 dark:border-amber-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-amber-600 uppercase tracking-wider">Needs Follow-up</p>
                <p className="text-xl font-bold text-amber-600 tabular-nums">{overdue.filter(i => i.daysOverdue >= 60).length}</p>
                <p className="text-[11px] text-muted-foreground">60+ days overdue</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Oldest</p>
                <p className="text-xl font-bold tabular-nums">{overdue[0]?.daysOverdue ?? 0}d</p>
                <p className="text-[11px] text-muted-foreground">overdue</p>
              </CardContent>
            </Card>
          </div>

          {/* Reminder stage guide */}
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>30–60 days:</strong> Holded sends automatic reminders — no action needed.{" "}
              <strong>60–90 days:</strong> Manual email available.{" "}
              <strong>90+ days:</strong> Consider calling the customer.
            </span>
          </div>

          {overdue.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 opacity-20" />
                <p className="font-medium text-sm">No overdue invoices</p>
                <p className="text-xs">All invoices have been paid within 30 days</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Invoice</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Amount</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Overdue</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Reminded</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdue.map((inv, idx) => (
                      <TableRow key={inv.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                        <TableCell>
                          <a
                            href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[13px] text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {inv.docNumber || "—"}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </TableCell>
                        <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[150px] truncate">
                          {inv.customerEmail || <span className="italic">No email</span>}
                        </TableCell>
                        <TableCell className="text-[13px] font-medium tabular-nums text-right">
                          €{inv.total?.toFixed(2) ?? "0.00"}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap">
                          {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "rounded-full text-[10px] px-2 py-0",
                              inv.daysOverdue > 90
                                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400"
                                : inv.daysOverdue > 60
                                ? "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400"
                                : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
                            )}
                          >
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            {inv.daysOverdue}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {inv.lastPaymentReminderAt
                            ? new Date(inv.lastPaymentReminderAt).toLocaleDateString("nl-NL")
                            : <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {actionLoading === `reminder-${inv.id}` ? (
                              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" disabled>
                                <span className="animate-spin">⏳</span> Sending…
                              </Button>
                            ) : confirmReminder === inv.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-amber-600 font-medium">Send?</span>
                                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-green-600 hover:text-green-700" onClick={() => handleSendReminder(inv)}>✓</Button>
                                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={() => setConfirmReminder(null)}>✕</Button>
                              </div>
                            ) : inv.daysOverdue < 60 ? (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1" title="Holded sends automatic reminders during the first 60 days">
                                <Clock className="h-3 w-3" /> Auto reminders
                              </span>
                            ) : inv.daysOverdue >= 90 ? (
                              <>
                                <Badge variant="outline" className="text-[10px] gap-1 border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                                  <Phone className="h-2.5 w-2.5" /> Call
                                </Badge>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 text-xs gap-1 text-muted-foreground"
                                  disabled={!inv.customerEmail}
                                  onClick={() => setConfirmReminder(inv.id)}
                                  title={inv.customerEmail ? `Fallback: email ${inv.customerEmail}` : "No email on file"}
                                >
                                  <Send className="h-3 w-3" /> Email
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={!inv.customerEmail}
                                onClick={() => setConfirmReminder(inv.id)}
                                title={inv.customerEmail ? `Send reminder to ${inv.customerEmail}` : "No email on file"}
                              >
                                <Send className="h-3 w-3" /> Remind
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              disabled={actionLoading === `pay-${inv.id}`}
                              onClick={() => handleMarkPaid(inv)}
                              title="Mark as paid"
                            >
                              {actionLoading === `pay-${inv.id}` ? "..." : "✓ Paid"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
