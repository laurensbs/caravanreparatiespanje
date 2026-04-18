"use client";

import { Fragment, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Wrench, Search, ExternalLink, Send, X, FileText, AlertTriangle, Clock, Phone, Info, MessageSquare, Trash2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { sendHoldedInvoice } from "@/actions/holded";
import { markInvoicePaid, sendPaymentReminder, dismissQuote, setQuoteNote, convertAndSendQuote } from "@/actions/invoices";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { HoldedHint } from "@/components/holded-hint";
import { SegmentedTabs, StatStrip } from "@/components/layout/dashboard-surface";

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

interface OverdueEstimate extends Quote {
  daysOverdue: number;
  customerEmail?: string;
  repairHasInvoice?: boolean;
  note?: string | null;
}

interface InvoicesClientProps {
  invoices: Invoice[];
  quotes: Quote[];
  overdue: OverdueInvoice[];
  overdueEstimates?: OverdueEstimate[];
}

type StatusFilter = "all" | "unpaid" | "paid" | "partial";
type Tab = "invoices" | "quotes" | "overdue";

export function InvoicesClient({ invoices, quotes, overdue, overdueEstimates = [], initialTab }: InvoicesClientProps & { initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab ?? "invoices");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReminder, setConfirmReminder] = useState<string | null>(null);
  // Quote override state
  const [noteEditing, setNoteEditing] = useState<string | null>(null); // holdedQuoteId being edited
  const [noteValue, setNoteValue] = useState("");
  // Track locally converted quotes (quoteId → converted date) for instant UI feedback
  const [convertedRows, setConvertedRows] = useState<Record<string, Date>>({});

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

  const filteredOverdue = useMemo(() => {
    let result: OverdueInvoice[] = overdue;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.docNumber?.toLowerCase().includes(q) ||
        (i.customerName ?? i.contactName)?.toLowerCase().includes(q) ||
        i.customerEmail?.toLowerCase().includes(q) ||
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
  }, [overdue, search, dateFrom, dateTo]);

  const filteredOverdueEstimates = useMemo(() => {
    let result: OverdueEstimate[] = overdueEstimates;
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
  }, [overdueEstimates, search, dateFrom, dateTo]);

  const paidCount = filtered.filter(i => i.status === 1).length;
  const unpaidCount = filtered.filter(i => i.status === 0).length;

  const hasActiveFilters = statusFilter !== "all" || search.trim() || dateFrom || dateTo;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  }

  function goTab(next: Tab) {
    setTab(next);
    router.replace(next === "invoices" ? "/invoices" : `/invoices?tab=${next}`, { scroll: false });
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

  const overdueTotal = filteredOverdue.reduce((sum, inv) => sum + (inv.total ?? 0), 0);
  const estimatesTotal = filteredOverdueEstimates.reduce((sum, q) => sum + (q.total ?? 0), 0);
  const totalOverdueCount = filteredOverdue.length + filteredOverdueEstimates.length;

  return (
    <div className="animate-fade-in">
      <header className="border-b border-border/60 bg-card px-4 py-5 dark:bg-transparent sm:px-6 sm:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">
          Billing
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-foreground dark:text-foreground sm:text-3xl">
          Invoices &amp; quotes
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {tab === "invoices"
            ? `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""}${hasActiveFilters ? ` (${invoices.length} total)` : ""}`
            : tab === "quotes"
              ? `${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? "s" : ""}${hasActiveFilters ? ` (${quotes.length} total)` : ""}`
              : `${filteredOverdue.length} overdue invoice${filteredOverdue.length !== 1 ? "s" : ""}${filteredOverdueEstimates.length > 0 ? ` + ${filteredOverdueEstimates.length} uninvoiced quote${filteredOverdueEstimates.length !== 1 ? "s" : ""}` : ""}${hasActiveFilters ? ` (${overdue.length + overdueEstimates.length} total)` : ""} · €${(overdueTotal + estimatesTotal).toFixed(2)} outstanding`}
        </p>
        <HoldedHint variant="readonly" className="mt-4">
          Lists are synced from Holded (repair-related documents only). PDF links open Holded documents; repair codes
          link to jobs in this panel. Mark paid and reminders use Holded where applicable.
        </HoldedHint>
      </header>

      <div className="space-y-5 border-b border-border/40 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-5">
        <SegmentedTabs
          value={tab}
          onValueChange={(v) => goTab(v)}
          className="w-full"
          tabs={[
            {
              value: "invoices",
              label: "Invoices",
              count: invoices.length,
              icon: <Receipt className="h-3.5 w-3.5" aria-hidden />,
            },
            {
              value: "quotes",
              label: "Quotes",
              count: quotes.length,
              icon: <FileText className="h-3.5 w-3.5" aria-hidden />,
            },
            {
              value: "overdue",
              label: "Overdue",
              count: totalOverdueCount,
              icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
            },
          ]}
        />

        {/* Shared filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-0 w-full sm:max-w-md sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === "invoices" ? "Search invoices…" : tab === "quotes" ? "Search quotes…" : "Search overdue…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 touch-manipulation rounded-xl pl-10 text-sm"
            />
          </div>
          {tab === "invoices" && (
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl text-sm sm:w-[140px]">
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
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 touch-manipulation rounded-xl text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 touch-manipulation rounded-xl text-sm"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="outline" className="h-11 w-full touch-manipulation sm:w-auto" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>

      {tab === "invoices" && (
        <>
          <StatStrip
            items={[
              { label: "Total", value: filtered.length, hint: "invoices" },
              { label: "Paid", value: paidCount, hint: "invoices", tone: "emerald" },
              { label: "Unpaid", value: unpaidCount, hint: "invoices", tone: "red" },
              {
                label: "Partial",
                value: filtered.filter((i) => i.status === 2).length,
                hint: "invoices",
                tone: "amber",
              },
            ]}
          />

          {filtered.length === 0 ? (
            <div className="rounded-xl border bg-card py-14 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Receipt className="h-10 w-10 opacity-20" />
                <p className="font-medium text-sm">{hasActiveFilters ? "No invoices match filters" : "No invoices found"}</p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-2 touch-manipulation" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filtered.map((inv) => {
                  const isDraft = inv.status === 0 && (inv as any).draft === 1;
                  return (
                    <div key={inv.id} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isDraft ? (
                            <span className="font-semibold text-foreground">{inv.docNumber || "Draft"}</span>
                          ) : (
                            <a
                              href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 font-semibold text-primary hover:underline"
                            >
                              {inv.docNumber}
                              <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                          )}
                          <p className="mt-1 text-sm text-muted-foreground">{inv.customerName ?? inv.contactName}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                            {inv.desc ? ` · ${inv.desc}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {inv.status === 1 ? (
                            <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                              Paid
                            </Badge>
                          ) : inv.status === 2 ? (
                            <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400">
                              Partial
                            </Badge>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(inv)}
                              disabled={actionLoading === `pay-${inv.id}`}
                              className="touch-manipulation"
                              title="Mark as paid in Holded"
                            >
                              <Badge variant="secondary" className="rounded-full bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400">
                                {actionLoading === `pay-${inv.id}` ? "…" : "Unpaid"}
                              </Badge>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                        {inv.repairJobId ? (
                          <Button variant="outline" size="sm" className="h-10 touch-manipulation rounded-xl" asChild>
                            <Link href={`/repairs/${inv.repairJobId}`}>
                              <Wrench className="mr-1.5 h-4 w-4" />
                              {inv.repairPublicCode}
                            </Link>
                          </Button>
                        ) : null}
                        <Button type="button" variant="secondary" className="h-10 touch-manipulation rounded-xl" onClick={() => openInvoiceInHolded(inv)}>
                          <ExternalLink className="mr-1.5 h-4 w-4" />
                          PDF
                        </Button>
                        {inv.repairJobId ? (
                          <Button
                            type="button"
                            variant="default"
                            className="h-10 touch-manipulation rounded-xl"
                            disabled={actionLoading === `send-${inv.id}`}
                            onClick={() => handleSendEmail(inv)}
                          >
                            <Send className="mr-1.5 h-4 w-4" />
                            Email
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
                <div className="max-h-[min(70vh,720px)] overflow-y-auto xl:max-h-[calc(100vh-20rem)]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Invoice</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Description</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((inv, idx) => {
                        const isDraft = inv.status === 0 && (inv as any).draft === 1;
                        return (
                          <TableRow key={inv.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                            <TableCell>
                              {isDraft ? (
                                <span className="text-[13px] font-medium text-muted-foreground">{inv.docNumber || "Draft"}</span>
                              ) : (
                                <a
                                  href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                                >
                                  {inv.docNumber}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                            <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                              {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-[13px] text-muted-foreground">{inv.desc || "—"}</TableCell>
                            <TableCell>
                              {inv.status === 1 ? (
                                <Badge variant="secondary" className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                  Paid
                                </Badge>
                              ) : inv.status === 2 ? (
                                <Badge variant="secondary" className="rounded-full border-amber-200 bg-amber-50 px-2 py-0 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-400">
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
                                  <Badge variant="secondary" className="rounded-full border-red-200 bg-red-50 px-2 py-0 text-[10px] text-red-700 transition-colors hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900">
                                    {actionLoading === `pay-${inv.id}` ? "Updating…" : "Unpaid"}
                                  </Badge>
                                </button>
                              )}
                            </TableCell>
                            <TableCell>
                              {inv.repairJobId ? (
                                <Link href={`/repairs/${inv.repairJobId}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                  <Wrench className="h-2.5 w-2.5" />
                                  {inv.repairPublicCode}
                                </Link>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                                <Button variant="ghost" size="icon" className="h-9 w-9" title="View PDF" onClick={() => openInvoiceInHolded(inv)}>
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                {inv.repairJobId ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    title="Send via email"
                                    disabled={actionLoading === `send-${inv.id}`}
                                    onClick={() => handleSendEmail(inv)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {tab === "quotes" && (
        <>
          <StatStrip
            className="sm:grid-cols-3"
            items={[
              { label: "Total", value: quotes.length, hint: "quotes" },
              {
                label: "Approved",
                value: quotes.filter((q) => q.approvedAt).length,
                hint: "quotes",
                tone: "emerald",
              },
              {
                label: "Linked",
                value: quotes.filter((q) => q.repairJobId).length,
                hint: "to repairs",
                tone: "sky",
              },
            ]}
          />

          {filteredQuotes.length === 0 ? (
            <div className="rounded-xl border bg-card py-14 text-center text-muted-foreground">
              <FileText className="mx-auto h-10 w-10 opacity-20" />
              <p className="mt-2 font-medium text-sm">No quotes found</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredQuotes.map((q) => {
                  const isDraft = (q as any).draft === 1;
                  return (
                    <div key={q.id} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {isDraft ? (
                            <span className="font-semibold">{q.docNumber || "Draft"}</span>
                          ) : (
                            <a
                              href={`/api/holded/pdf?type=estimate&id=${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 font-semibold text-primary hover:underline"
                            >
                              {q.docNumber}
                              <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                          )}
                          <p className="mt-1 text-sm text-muted-foreground">{q.customerName ?? q.contactName}</p>
                          <p className="mt-2 text-lg font-semibold tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {q.date ? new Date(q.date * 1000).toLocaleDateString("nl-NL") : "—"}
                          </p>
                        </div>
                        {q.approvedAt ? (
                          <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400">
                            Pending
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 border-t border-border/50 pt-3">
                        {q.repairJobId ? (
                          <Button variant="outline" size="sm" className="h-10 w-full touch-manipulation rounded-xl sm:w-auto" asChild>
                            <Link href={`/repairs/${q.repairJobId}`}>
                              <Wrench className="mr-1.5 h-4 w-4" />
                              Repair {q.repairPublicCode}
                            </Link>
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground">No repair linked — open in Holded from PDF.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
                <div className="max-h-[min(70vh,720px)] overflow-y-auto xl:max-h-[calc(100vh-20rem)]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Quote</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((q, idx) => {
                        const isDraft = (q as any).draft === 1;
                        return (
                          <TableRow key={q.id} className="interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                            <TableCell>
                              {isDraft ? (
                                <span className="text-[13px] font-medium text-muted-foreground">{q.docNumber || "Draft"}</span>
                              ) : (
                                <a
                                  href={`/api/holded/pdf?type=estimate&id=${q.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                                >
                                  {q.docNumber}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="text-[13px]">{q.customerName ?? q.contactName}</TableCell>
                            <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                              {q.date ? new Date(q.date * 1000).toLocaleDateString("nl-NL") : "—"}
                            </TableCell>
                            <TableCell className="text-right text-[13px] font-medium tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</TableCell>
                            <TableCell>
                              {q.approvedAt ? (
                                <Badge variant="secondary" className="rounded-full border-emerald-200 bg-emerald-50 px-2 py-0 text-[10px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                  Approved
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="rounded-full border-blue-200 bg-blue-50 px-2 py-0 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {q.repairJobId ? (
                                <Link href={`/repairs/${q.repairJobId}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                  <Wrench className="h-2.5 w-2.5" />
                                  {q.repairPublicCode}
                                </Link>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {tab === "overdue" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="rounded-xl border-red-200 dark:border-red-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-red-600 uppercase tracking-wider">Overdue</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">{filteredOverdue.length}</p>
                <p className="text-[11px] text-muted-foreground">invoices</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-red-200 dark:border-red-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-red-600 uppercase tracking-wider">Outstanding</p>
                <p className="text-xl font-bold text-red-600 tabular-nums">€{(overdueTotal + estimatesTotal).toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground">total owed</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl border-amber-200 dark:border-amber-900">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-amber-600 uppercase tracking-wider">Uninvoiced</p>
                <p className="text-xl font-bold text-amber-600 tabular-nums">{filteredOverdueEstimates.length}</p>
                <p className="text-[11px] text-muted-foreground">quotes · €{estimatesTotal.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-xl">
              <CardContent className="pt-4 pb-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Needs Follow-up</p>
                <p className="text-xl font-bold tabular-nums">{filteredOverdue.filter(i => i.daysOverdue >= 60).length + filteredOverdueEstimates.filter(q => q.daysOverdue >= 60).length}</p>
                <p className="text-[11px] text-muted-foreground">60+ days overdue</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-xs leading-relaxed text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300 sm:flex-row sm:items-start sm:text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <strong>30–60 days:</strong> Holded sends automatic reminders — no action needed.{" "}
              <strong>60–90 days:</strong> Manual email from here. <strong>90+ days:</strong> Prefer calling the customer; email is a fallback.
            </p>
          </div>

          {filteredOverdue.length === 0 ? (
            <div className="rounded-xl border bg-card px-4 py-12 text-center sm:py-14">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-10 w-10 opacity-20" />
                <p className="font-medium text-sm">{hasActiveFilters ? "No overdue invoices match filters" : "No overdue invoices"}</p>
                <p className="max-w-sm text-xs">{hasActiveFilters ? "Try adjusting your search or dates." : "All repair invoices are paid within the overdue window, or none are linked yet."}</p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-2 touch-manipulation" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3 lg:hidden">
                {filteredOverdue.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <a
                        href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 font-semibold text-primary hover:underline"
                      >
                        {inv.docNumber || "—"}
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </a>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 rounded-full text-xs",
                          inv.daysOverdue > 90
                            ? "border-red-200 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                            : inv.daysOverdue > 60
                              ? "border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                              : "border-amber-200 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                        )}
                      >
                        <Clock className="mr-0.5 inline h-3 w-3" />
                        {inv.daysOverdue}d overdue
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{inv.customerName ?? inv.contactName}</p>
                    <p className="break-all text-xs text-muted-foreground">{inv.customerEmail || "No email on file"}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="font-semibold tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</span>
                      <span className="text-muted-foreground">{inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        Reminded:{" "}
                        {inv.lastPaymentReminderAt ? new Date(inv.lastPaymentReminderAt).toLocaleDateString("nl-NL") : "—"}
                      </span>
                    </div>
                    {inv.repairJobId ? (
                      <Button variant="outline" size="sm" className="mt-3 h-10 w-full touch-manipulation rounded-xl sm:w-auto" asChild>
                        <Link href={`/repairs/${inv.repairJobId}`}>
                          <Wrench className="mr-1.5 h-4 w-4" />
                          Repair {inv.repairPublicCode}
                        </Link>
                      </Button>
                    ) : null}
                    <div className="mt-3 flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:flex-wrap">
                      {actionLoading === `reminder-${inv.id}` ? (
                        <Button variant="secondary" className="h-11 touch-manipulation" disabled>
                          Sending…
                        </Button>
                      ) : confirmReminder === inv.id ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="text-sm font-medium text-amber-600">Send reminder email?</span>
                          <div className="flex gap-2">
                            <Button className="h-11 flex-1 touch-manipulation sm:flex-none" onClick={() => handleSendReminder(inv)}>
                              Send
                            </Button>
                            <Button variant="outline" className="h-11 flex-1 touch-manipulation sm:flex-none" onClick={() => setConfirmReminder(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : inv.daysOverdue < 60 ? (
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-4 w-4 shrink-0" />
                          Holded auto-reminders (first 60 days)
                        </p>
                      ) : inv.daysOverdue >= 90 ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                          <Badge variant="outline" className="h-10 w-fit justify-center gap-1 border-orange-300 text-orange-700 dark:border-orange-800 dark:text-orange-400">
                            <Phone className="h-4 w-4" /> Call customer
                          </Badge>
                          <Button
                            variant="secondary"
                            className="h-11 touch-manipulation"
                            disabled={!inv.customerEmail}
                            onClick={() => setConfirmReminder(inv.id)}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Email instead
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          className="h-11 w-full touch-manipulation sm:w-auto"
                          disabled={!inv.customerEmail}
                          onClick={() => setConfirmReminder(inv.id)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send reminder
                        </Button>
                      )}
                      <Button
                        variant="default"
                        className="h-11 touch-manipulation sm:ml-auto"
                        disabled={actionLoading === `pay-${inv.id}`}
                        onClick={() => handleMarkPaid(inv)}
                      >
                        {actionLoading === `pay-${inv.id}` ? "…" : "Mark paid (Holded)"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
                <div className="max-h-[min(70vh,720px)] overflow-y-auto xl:max-h-[calc(100vh-20rem)]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Invoice</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Email</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Overdue</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Reminded</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverdue.map((inv, idx) => (
                          <TableRow key={inv.id} className="group interactive-row table-row-animate" style={{ animationDelay: `${idx * 15}ms` }}>
                          <TableCell>
                            <a
                              href={`/api/holded/pdf?type=invoice&id=${inv.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                            >
                              {inv.docNumber || "—"}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </TableCell>
                          <TableCell className="text-[13px]">{inv.customerName ?? inv.contactName}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-[11px] text-muted-foreground">
                            {inv.customerEmail || <span className="italic">No email</span>}
                          </TableCell>
                          <TableCell className="text-right text-[13px] font-medium tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</TableCell>
                          <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                            {inv.date ? new Date(inv.date * 1000).toLocaleDateString("nl-NL") : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "rounded-full px-2 py-0 text-[10px]",
                                inv.daysOverdue > 90
                                  ? "border-red-200 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                  : inv.daysOverdue > 60
                                    ? "border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                                    : "border-amber-200 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                              )}
                            >
                              <Clock className="mr-0.5 h-2.5 w-2.5" />
                              {inv.daysOverdue}d
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {inv.lastPaymentReminderAt ? new Date(inv.lastPaymentReminderAt).toLocaleDateString("nl-NL") : <span className="text-muted-foreground/50">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {actionLoading === `reminder-${inv.id}` ? (
                                <Button variant="ghost" size="sm" className="h-8 text-xs" disabled>
                                  Sending…
                                </Button>
                              ) : confirmReminder === inv.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] font-medium text-amber-600">Send?</span>
                                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-green-600" onClick={() => handleSendReminder(inv)}>
                                    ✓
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setConfirmReminder(null)}>
                                    ✕
                                  </Button>
                                </div>
                              ) : inv.daysOverdue < 60 ? (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Holded sends automatic reminders during the first 60 days">
                                  <Clock className="h-3 w-3" /> Auto
                                </span>
                              ) : inv.daysOverdue >= 90 ? (
                                <>
                                  <Badge variant="outline" className="gap-1 border-orange-300 text-[10px] text-orange-700 dark:border-orange-800 dark:text-orange-400">
                                    <Phone className="h-2.5 w-2.5" /> Call
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    disabled={!inv.customerEmail}
                                    onClick={() => setConfirmReminder(inv.id)}
                                  >
                                    <Send className="h-3 w-3" /> Email
                                  </Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" className="h-8 text-xs" disabled={!inv.customerEmail} onClick={() => setConfirmReminder(inv.id)}>
                                  <Send className="h-3 w-3" /> Remind
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-8 text-xs" disabled={actionLoading === `pay-${inv.id}`} onClick={() => handleMarkPaid(inv)}>
                                {actionLoading === `pay-${inv.id}` ? "…" : "Paid"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {filteredOverdueEstimates.length > 0 && (
            <>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-semibold">Uninvoiced quotes</h3>
                <Badge variant="secondary" className="w-fit rounded-full border-amber-200 bg-amber-50 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  {filteredOverdueEstimates.length} · €{estimatesTotal.toFixed(2)}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200 sm:text-sm">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    Sent in Holded but not converted to an invoice. Convert here (creates invoice in Holded), add a note for your team, or dismiss when no follow-up is needed. Linked repairs open in this app.
                  </p>
                </div>
              </div>

              <div className="space-y-3 lg:hidden">
                {filteredOverdueEstimates.map((q) => {
                  const convertedAt = convertedRows[q.id];
                  const reason =
                    convertedAt ? (
                      <span className="inline-flex items-center gap-1 font-medium text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Converted {convertedAt.toLocaleDateString("en-GB")}
                      </span>
                    ) : q.note ? (
                      <span className="italic text-foreground/80">{q.note}</span>
                    ) : q.repairJobId ? (
                      "Repair done — quote not converted to invoice yet."
                    ) : q.desc ? (
                      `Sent: ${q.desc}`
                    ) : (
                      "Quote sent — not converted to invoice."
                    );
                  return (
                    <Fragment key={q.id}>
                      <div className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-sm", convertedAt && "opacity-60")}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-2">
                            <a
                              href={`/api/holded/pdf?type=estimate&id=${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 font-semibold text-primary hover:underline"
                            >
                              {q.docNumber || "—"}
                              <ExternalLink className="h-4 w-4 shrink-0" />
                            </a>
                            <a
                              href={`https://app.holded.com/contacts/${q.contact}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-muted-foreground hover:text-foreground"
                            >
                              Open contact in Holded ↗
                            </a>
                          </div>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0 rounded-full text-xs",
                              q.daysOverdue > 90
                                ? "border-red-200 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                : q.daysOverdue > 60
                                  ? "border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                                  : "border-amber-200 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                            )}
                          >
                            <Clock className="mr-0.5 inline h-3 w-3" />
                            {q.daysOverdue}d
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm font-medium">{q.customerName ?? q.contactName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
                        <p className="mt-2 text-lg font-semibold tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</p>
                        <p className="text-xs text-muted-foreground">{q.date ? new Date(q.date * 1000).toLocaleDateString("nl-NL") : "—"}</p>
                        {q.repairJobId ? (
                          <Button variant="outline" size="sm" className="mt-3 h-10 w-full touch-manipulation rounded-xl" asChild>
                            <Link href={`/repairs/${q.repairJobId}`}>
                              <Wrench className="mr-1.5 h-4 w-4" />
                              {q.repairPublicCode || "Open repair"}
                            </Link>
                          </Button>
                        ) : null}
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Button
                            type="button"
                            className="h-11 touch-manipulation"
                            disabled={!!actionLoading || !!convertedRows[q.id]}
                            onClick={async () => {
                              setActionLoading(`convert-${q.id}`);
                              try {
                                const res = await convertAndSendQuote(q.id, q.customerEmail);
                                setConvertedRows(prev => ({ ...prev, [q.id]: new Date() }));
                                toast.success(`Invoice ${res.docNumber ?? ""} created${q.customerEmail ? " and sent" : ""}`);
                                setTimeout(() => router.refresh(), 1500);
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : "Failed to convert";
                                toast.error(msg);
                              } finally {
                                setActionLoading(null);
                              }
                            }}
                          >
                            {actionLoading === `convert-${q.id}` ? "…" : "Make invoice"}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-11 touch-manipulation"
                            onClick={() => {
                              setNoteEditing(noteEditing === q.id ? null : q.id);
                              setNoteValue(q.note ?? "");
                            }}
                          >
                            Note
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 touch-manipulation text-destructive hover:text-destructive"
                            disabled={actionLoading === `dismiss-${q.id}`}
                            onClick={async () => {
                              setActionLoading(`dismiss-${q.id}`);
                              try {
                                await dismissQuote(q.id);
                                toast.success(`${q.docNumber} dismissed`);
                                router.refresh();
                              } catch {
                                toast.error("Failed to dismiss");
                              } finally {
                                setActionLoading(null);
                              }
                            }}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                      {noteEditing === q.id && (
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                          <Textarea
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            placeholder="Note for your team (e.g. customer declined, follow up next month)…"
                            className="min-h-[88px] resize-none text-sm"
                            autoFocus
                          />
                          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="outline" className="h-11 touch-manipulation sm:min-w-[100px]" onClick={() => setNoteEditing(null)}>
                              Cancel
                            </Button>
                            <Button
                              className="h-11 touch-manipulation sm:min-w-[100px]"
                              disabled={actionLoading === `note-${q.id}`}
                              onClick={async () => {
                                setActionLoading(`note-${q.id}`);
                                try {
                                  await setQuoteNote(q.id, noteValue);
                                  toast.success("Note saved");
                                  setNoteEditing(null);
                                  router.refresh();
                                } catch {
                                  toast.error("Failed to save note");
                                } finally {
                                  setActionLoading(null);
                                }
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
                <div className="max-h-[min(70vh,720px)] overflow-y-auto xl:max-h-[calc(100vh-20rem)]">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Quote</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Reason</TableHead>
                        <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider">Amount</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Overdue</TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                        <TableHead className="w-[120px] text-[11px] font-semibold uppercase tracking-wider" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOverdueEstimates.map((q, idx) => {
                        const convertedAt = convertedRows[q.id];
                        return (
                          <Fragment key={q.id}>
                            <TableRow className={cn("group interactive-row table-row-animate", convertedAt && "opacity-60")} style={{ animationDelay: `${idx * 15}ms` }}>
                              <TableCell>
                                <div className="space-y-1">
                                  <a
                                    href={`/api/holded/pdf?type=estimate&id=${q.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
                                  >
                                    {q.docNumber || "—"}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                  <a
                                    href={`https://app.holded.com/contacts/${q.contact}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[11px] text-muted-foreground hover:text-foreground"
                                  >
                                    Holded contact ↗
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell className="text-[13px]">{q.customerName ?? q.contactName}</TableCell>
                              <TableCell className="max-w-[220px] text-[12px] text-muted-foreground">
                                {convertedAt ? (
                                  <span className="inline-flex items-center gap-1 font-medium text-green-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Converted {convertedAt.toLocaleDateString("en-GB")}
                                  </span>
                                ) : q.note ? (
                                  <span className="italic text-foreground/70">{q.note}</span>
                                ) : q.repairJobId ? (
                                  "Repair done, quote not converted to invoice"
                                ) : q.desc ? (
                                  `Sent: ${q.desc}`
                                ) : (
                                  "Quote sent, not converted to invoice"
                                )}
                              </TableCell>
                              <TableCell className="text-right text-[13px] font-medium tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</TableCell>
                              <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                                {q.date ? new Date(q.date * 1000).toLocaleDateString("en-GB") : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "rounded-full px-2 py-0 text-[10px]",
                                    q.daysOverdue > 90
                                      ? "border-red-200 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                      : q.daysOverdue > 60
                                        ? "border-orange-200 bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                                        : "border-amber-200 bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                  )}
                                >
                                  <Clock className="mr-0.5 h-2.5 w-2.5" />
                                  {q.daysOverdue}d
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {q.repairJobId ? (
                                  <Link href={`/repairs/${q.repairJobId}`} className="text-[11px] text-primary hover:underline">
                                    {q.repairPublicCode || "View"}
                                  </Link>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/50">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                                  <button
                                    type="button"
                                    title="Convert to invoice in Holded"
                                    className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-green-50 hover:text-green-700"
                                    disabled={!!actionLoading || !!convertedRows[q.id]}
                                    onClick={async () => {
                                      setActionLoading(`convert-${q.id}`);
                                      try {
                                        const res = await convertAndSendQuote(q.id, q.customerEmail);
                                        setConvertedRows(prev => ({ ...prev, [q.id]: new Date() }));
                                        toast.success(`Invoice ${res.docNumber ?? ""} created${q.customerEmail ? " and sent" : ""}`);
                                        setTimeout(() => router.refresh(), 1500);
                                      } catch (err) {
                                        const msg = err instanceof Error ? err.message : "Failed to convert";
                                        toast.error(msg);
                                      } finally {
                                        setActionLoading(null);
                                      }
                                    }}
                                  >
                                    {actionLoading === `convert-${q.id}` ? (
                                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : (
                                      <Receipt className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    title="Add note"
                                    className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    onClick={() => {
                                      setNoteEditing(noteEditing === q.id ? null : q.id);
                                      setNoteValue(q.note ?? "");
                                    }}
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Dismiss"
                                    className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                                    disabled={actionLoading === `dismiss-${q.id}`}
                                    onClick={async () => {
                                      setActionLoading(`dismiss-${q.id}`);
                                      try {
                                        await dismissQuote(q.id);
                                        toast.success(`${q.docNumber} dismissed`);
                                        router.refresh();
                                      } catch {
                                        toast.error("Failed to dismiss");
                                      } finally {
                                        setActionLoading(null);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {noteEditing === q.id && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30 px-4 py-3">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                    <Textarea
                                      value={noteValue}
                                      onChange={(e) => setNoteValue(e.target.value)}
                                      placeholder="Add a note about this quote…"
                                      className="min-h-[72px] flex-1 resize-none text-sm"
                                      autoFocus
                                    />
                                    <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-col">
                                      <Button
                                        className="h-10 touch-manipulation"
                                        disabled={actionLoading === `note-${q.id}`}
                                        onClick={async () => {
                                          setActionLoading(`note-${q.id}`);
                                          try {
                                            await setQuoteNote(q.id, noteValue);
                                            toast.success("Note saved");
                                            setNoteEditing(null);
                                            router.refresh();
                                          } catch {
                                            toast.error("Failed to save note");
                                          } finally {
                                            setActionLoading(null);
                                          }
                                        }}
                                      >
                                        Save
                                      </Button>
                                      <Button variant="ghost" className="h-10 touch-manipulation" onClick={() => setNoteEditing(null)}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
