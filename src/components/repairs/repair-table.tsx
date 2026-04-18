"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, JOB_TYPE_LABELS, JOB_TYPE_COLORS } from "@/types";
import type { RepairStatus, JobType } from "@/types";
import { ExternalLink } from "lucide-react";
import { SmartDate } from "@/components/ui/smart-date";
import { GarageSyncChip } from "@/components/garage-sync-ui";
import { useState, useEffect, useRef, useCallback, useTransition, Fragment } from "react";
import { BulkActions } from "./bulk-actions";
import { ArrowUp, ArrowDown, ArrowUpDown, Loader2 } from "lucide-react";
import { updateRepairJob, getRepairJobs, type RepairFilters } from "@/actions/repairs";
import { toast } from "sonner";

interface Job {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  invoiceStatus: string;
  customerResponseStatus: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null;
  locationName: string | null;
  locationId: string | null;
  customerName: string | null;
  customerId: string | null;
  unitRegistration: string | null;
  unitId: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  descriptionRaw: string | null;
  partsNeededRaw: string | null;
  notesRaw: string | null;
  warrantyInternalCostFlag: boolean;
  internalCost: string | null;
  jobType: string;
  holdedInvoiceId: string | null;
  holdedInvoiceNum: string | null;
  holdedQuoteId: string | null;
  holdedQuoteNum: string | null;
  garageNeedsAdminAttention: boolean;
  garageUnreadUpdatesCount: number;
  garageLastUpdateType: string | null;
  tags: { id: string; name: string; color: string }[];
}

interface RepairTableProps {
  jobs: Job[];
  total: number;
  filters: RepairFilters;
}

export function RepairTable({ jobs: initialJobs, total, filters }: RepairTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allJobs, setAllJobs] = useState<Job[]>(initialJobs);
  const [loading, startLoading] = useTransition();
  const [hasMore, setHasMore] = useState(initialJobs.length < total);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when initialJobs change (filters/sort changed)
  useEffect(() => {
    setAllJobs(initialJobs);
    pageRef.current = 1;
    setHasMore(initialJobs.length < total);
    setSelected(new Set());
  }, [initialJobs, total]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    startLoading(async () => {
      const nextPage = pageRef.current + 1;
      const { jobs: moreJobs } = await getRepairJobs({ ...filters, page: nextPage });
      setAllJobs(prev => {
        const existingIds = new Set(prev.map(j => j.id));
        const newJobs = (moreJobs as Job[]).filter(j => !existingIds.has(j.id));
        return [...prev, ...newJobs];
      });
      pageRef.current = nextPage;
      const loaded = nextPage * (filters.limit ?? 50);
      if (loaded >= total) setHasMore(false);
    });
  }, [loading, hasMore, filters, total]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const currentSort = searchParams.get("sort") ?? "updatedAt";
  const currentDir = searchParams.get("dir") ?? "desc";

  function handleSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === column) {
      params.set("dir", currentDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", column);
      params.set("dir", "desc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function SortIcon({ column }: { column: string }) {
    if (currentSort !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return currentDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  }

  const toggleAll = () => {
    if (selected.size === allJobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allJobs.map((j) => j.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const LOCATION_COLORS: Record<string, string> = {
    "cruïllas": "bg-blue-500",
    "peratallada": "bg-amber-500",
    "sant climent": "bg-emerald-500",
  };

  function getDocumentInfo(job: Job): { type: string; label: string; color: string; pdfUrl?: string; holdedUrl?: string; title?: string } | null {
    // 1. Invoice exists → show invoice
    if (job.holdedInvoiceId) {
      const isPaid = job.invoiceStatus === "paid";
      const isSent = job.invoiceStatus === "sent";
      return {
        type: "invoice",
        label: job.holdedInvoiceNum ? `Inv ${job.holdedInvoiceNum}` : "Invoice",
        color: isPaid
          ? "text-emerald-700 dark:text-emerald-400"
          : isSent
            ? "text-blue-700 dark:text-blue-400"
            : "text-amber-700 dark:text-amber-400",
        pdfUrl: `/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`,
        holdedUrl: `https://app.holded.com/invoicing/invoice/${job.holdedInvoiceId}`,
        title: isPaid ? "Invoice (Paid)" : isSent ? "Invoice (Sent)" : "Invoice (Draft)",
      };
    }
    // 2. Quote exists + rejected status → rejected quote
    if (job.holdedQuoteId && (job.status === "rejected" || job.customerResponseStatus === "declined")) {
      return {
        type: "rejected-quote",
        label: job.holdedQuoteNum ? `Quote ${job.holdedQuoteNum}` : "Rejected Quote",
        color: "text-red-600 dark:text-red-400",
        pdfUrl: `/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`,
        holdedUrl: `https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`,
        title: "Rejected Quote",
      };
    }
    // 3. Quote exists → show quote
    if (job.holdedQuoteId) {
      return {
        type: "quote",
        label: job.holdedQuoteNum ? `Quote ${job.holdedQuoteNum}` : "Quote",
        color: "text-foreground",
        pdfUrl: `/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`,
        holdedUrl: `https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`,
        title: "Quote",
      };
    }
    // 4. Special statuses without documents
    if (job.invoiceStatus === "warranty") {
      return { type: "warranty", label: "Warranty", color: "text-purple-600 dark:text-purple-400" };
    }
    if (job.invoiceStatus === "no_damage") {
      return { type: "no-damage", label: "No Damage", color: "text-muted-foreground/70 dark:text-muted-foreground" };
    }
    if (job.invoiceStatus === "paid") {
      return { type: "paid", label: "Paid", color: "text-emerald-600 dark:text-emerald-400" };
    }
    // 5. No document
    return null;
  }

  function getInitials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  function getInitialsColor(name: string): string {
    const colors = [
      "bg-amber-600", "bg-emerald-600", "bg-rose-600", "bg-violet-600",
      "bg-orange-600", "bg-indigo-600", "bg-teal-600", "bg-stone-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  const STATUS_ACCENT: Record<string, string> = {
    new: "bg-foreground/30 dark:bg-foreground/30",
    todo: "bg-foreground/30 dark:bg-foreground/30",
    in_inspection: "bg-foreground/40 dark:bg-foreground/60",
    no_damage: "bg-emerald-300 dark:bg-emerald-400",
    quote_needed: "bg-amber-300 dark:bg-amber-400",
    waiting_approval: "bg-amber-300 dark:bg-amber-400",
    waiting_customer: "bg-orange-400 dark:bg-orange-400",
    waiting_parts: "bg-amber-400 dark:bg-amber-400",
    scheduled: "bg-foreground/40 dark:bg-foreground/60",
    in_progress: "bg-foreground/60 dark:bg-foreground/60",
    blocked: "bg-red-400 dark:bg-red-400",
    completed: "bg-emerald-400 dark:bg-emerald-400",
    invoiced: "bg-emerald-300 dark:bg-emerald-400",
    rejected: "bg-red-300 dark:bg-rose-400",
    archived: "bg-foreground/30 dark:bg-foreground/[0.10]",
  };

  const STATUS_PILL: Record<string, string> = {
    new: "bg-muted text-muted-foreground dark:bg-foreground/[0.06] dark:text-foreground/90",
    todo: "bg-muted text-muted-foreground dark:bg-foreground/[0.06] dark:text-foreground/90",
    in_inspection: "bg-muted/60 text-foreground dark:bg-foreground/[0.10] dark:text-foreground/90",
    no_damage: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    quote_needed: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    waiting_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    waiting_customer: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    waiting_parts: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    scheduled: "bg-muted/60 text-foreground dark:bg-foreground/[0.10] dark:text-foreground/90",
    in_progress: "bg-muted/60 text-foreground dark:bg-foreground/[0.10] dark:text-foreground/90",
    blocked: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rejected: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    archived: "bg-muted text-muted-foreground/70 dark:bg-foreground/[0.04] dark:text-muted-foreground/70",
  };

  async function quickStatusChange(jobId: string, newStatus: string) {
    const res = await updateRepairJob(jobId, { status: newStatus as RepairStatus });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Status → ${STATUS_LABELS[newStatus as RepairStatus]}`);
    router.refresh();
  }

  const clearSelection = () => setSelected(new Set());

  return (
    <div>
      {selected.size > 0 && (
        <BulkActions
          selectedIds={Array.from(selected)}
          onClear={clearSelection}
        />
      )}

      {/* Column headers */}
      <div className="hidden md:flex items-center gap-5 px-5 pb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground select-none">
        <div className="w-8 shrink-0" />
        <div className="flex-[2] min-w-0 cursor-pointer" onClick={() => handleSort("title")}>
          <span className="inline-flex items-center">Title<SortIcon column="title" /></span>
        </div>
        <div className="w-32 shrink-0 cursor-pointer" onClick={() => handleSort("status")}>
          <span className="inline-flex items-center">Status<SortIcon column="status" /></span>
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSort("customerName")}>
          <span className="inline-flex items-center">Contact<SortIcon column="customerName" /></span>
        </div>
        <div className="w-28 shrink-0 cursor-pointer" onClick={() => handleSort("invoiceStatus")}>
          <span className="inline-flex items-center">Document<SortIcon column="invoiceStatus" /></span>
        </div>
        <div className="w-24 shrink-0 cursor-pointer" onClick={() => handleSort("dueDate")}>
          <span className="inline-flex items-center">Planned<SortIcon column="dueDate" /></span>
        </div>
        <div className="w-20 shrink-0 cursor-pointer text-right" onClick={() => handleSort("updatedAt")}>
          <span className="inline-flex items-center">Updated<SortIcon column="updatedAt" /></span>
        </div>
      </div>

      {/* Repair rows — cards on small screens, table-style row from md */}
      <div className="space-y-2 md:space-y-0">
        {allJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground/70 dark:text-muted-foreground">
            <ArrowUpDown className="h-8 w-8 opacity-20" />
            <p className="font-medium text-sm text-muted-foreground dark:text-muted-foreground/70">No repair jobs found</p>
            <p className="text-xs text-muted-foreground/70 dark:text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          allJobs.map((job, idx) => {
            const isUrgent = job.priority === "urgent";
            const isHigh = job.priority === "high";

            const goToJob = () => {
              const backTo = `/repairs?${searchParams.toString()}`;
              router.push(`/repairs/${job.id}?backTo=${encodeURIComponent(backTo)}`);
            };

            const titleBlock = (
              <>
                <div className="flex items-center gap-2">
                  <p className="truncate text-[15px] font-medium text-foreground transition-colors dark:text-foreground">
                    {job.title || "Unnamed repair"}
                  </p>
                  {job.jobType && job.jobType !== "repair" && (
                    <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${JOB_TYPE_COLORS[job.jobType as JobType] ?? "bg-muted text-foreground/80 dark:bg-foreground/[0.10] dark:text-foreground/80"}`}>
                      {JOB_TYPE_LABELS[job.jobType as JobType] ?? job.jobType}
                    </span>
                  )}
                  {isUrgent && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-red-500" />}
                  {isHigh && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {job.publicCode && (
                    <span className="font-mono text-[11px] text-muted-foreground/70 dark:text-muted-foreground">{job.publicCode}</span>
                  )}
                  {job.publicCode && job.descriptionRaw && <span className="text-muted-foreground/50 dark:text-muted-foreground">·</span>}
                  {job.descriptionRaw && (
                    <span className="truncate text-[11px] text-muted-foreground/70 dark:text-muted-foreground">{job.descriptionRaw.slice(0, 60)}</span>
                  )}
                </div>
                {job.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {job.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-block rounded-md px-1.5 py-0 text-[10px] font-medium leading-4 opacity-70"
                        style={{ backgroundColor: tag.color + "22", color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            );

            const documentCell = (
              <>
                {(() => {
                  const doc = getDocumentInfo(job);
                  if (!doc) return <span className="block truncate text-[11px] text-muted-foreground/50 dark:text-muted-foreground">—</span>;
                  if (!doc.pdfUrl) {
                    return <span className={`block truncate text-[11px] font-medium ${doc.color}`}>{doc.label}</span>;
                  }
                  return (
                    <a
                      href={doc.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group/doc inline-flex max-w-full items-center gap-1 truncate text-[11px] font-medium ${doc.color} hover:underline`}
                      title={doc.title}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="truncate">{doc.label}</span>
                      {doc.holdedUrl && (
                        <a
                          href={doc.holdedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground/70 opacity-100 transition-opacity hover:text-muted-foreground group-hover/doc:opacity-100 dark:hover:text-muted-foreground/50 md:opacity-0 md:group-hover/doc:opacity-100"
                          title="Open in Holded"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </a>
                  );
                })()}
              </>
            );

            const statusPicker = (
              <TableStatusPicker
                value={job.status}
                onChange={(val) => quickStatusChange(job.id, val)}
                pillClass={STATUS_PILL[job.status as RepairStatus] ?? "bg-muted dark:bg-foreground/[0.06] text-muted-foreground dark:text-foreground/90"}
                accentClass={STATUS_ACCENT[job.status] ?? "bg-foreground/30 dark:bg-foreground/30"}
              />
            );

            return (
              <Fragment key={job.id}>
                {/* Phone / small tablet: card */}
                <div
                  className={`group relative touch-manipulation rounded-xl border border-border bg-card/95 p-4 shadow-sm transition-all active:scale-[0.99] dark:border-white/[0.08] dark:bg-card/[0.03] md:hidden ${selected.has(job.id) ? "ring-2 ring-border dark:ring-foreground/20" : ""} animate-slide-up`}
                  style={{ animationDelay: `${Math.min(idx, 20) * 20}ms`, animationFillMode: "backwards" }}
                  role="button"
                  tabIndex={0}
                  onClick={goToJob}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goToJob();
                    }
                  }}
                >
                  <div className={`absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full ${STATUS_ACCENT[job.status] ?? "bg-foreground/30 dark:bg-foreground/[0.10]"}`} />
                  <div className="relative flex gap-3 pl-2.5">
                    <div className="shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(job.id)}
                        onCheckedChange={() => toggleOne(job.id)}
                        className="opacity-100 transition-opacity data-[state=checked]:opacity-100"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">{titleBlock}</div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          {statusPicker}
                        </div>
                      </div>
                      {(job.garageNeedsAdminAttention || job.garageUnreadUpdatesCount > 0 || job.status === "ready_for_check") && (
                        <GarageSyncChip
                          needsAttention={job.garageNeedsAdminAttention}
                          unreadCount={job.garageUnreadUpdatesCount}
                          updateType={job.garageLastUpdateType}
                          status={job.status}
                        />
                      )}
                      <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3 dark:border-white/[0.06]">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground">Contact</p>
                          <p className="mt-1 truncate text-sm font-medium text-foreground dark:text-foreground/90">
                            {job.customerName ?? <span className="text-muted-foreground/70">—</span>}
                          </p>
                          {job.locationName && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LOCATION_COLORS[job.locationName.toLowerCase()] ?? "bg-foreground/30 dark:bg-foreground/[0.10]"}`} />
                              <span className="truncate text-[11px] text-muted-foreground dark:text-muted-foreground/70">{job.locationName}</span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground">Document</p>
                          <div className="mt-1">{documentCell}</div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground">Planned</p>
                          <div className="mt-1">
                            {job.dueDate ? (
                              <SmartDate date={job.dueDate} className="text-xs text-muted-foreground dark:text-foreground/80" />
                            ) : (
                              <span className="text-[11px] text-muted-foreground/70 dark:text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground">Updated</p>
                          <div className="mt-1">
                            <SmartDate date={job.updatedAt} className="text-[11px] text-muted-foreground dark:text-muted-foreground/70" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop: wide row */}
                <div
                  className={`group relative hidden cursor-pointer items-center gap-5 border-b border-border/60 px-5 py-5 transition-all duration-150 last:border-b-0 hover:bg-muted/40 active:scale-[0.998] dark:border-white/[0.05] dark:hover:bg-card/[0.03] md:flex ${selected.has(job.id) ? "bg-muted/40 ring-1 ring-border/60 dark:bg-foreground/[0.06] dark:ring-foreground/15" : ""} animate-slide-up`}
                  style={{ animationDelay: `${Math.min(idx, 20) * 20}ms`, animationFillMode: "backwards" }}
                  onClick={goToJob}
                >
                  <div className={`absolute bottom-3 left-0 top-3 w-[3px] rounded-full opacity-90 ${STATUS_ACCENT[job.status] ?? "bg-foreground/30 dark:bg-foreground/[0.10]"}`} />

                  <div className="ml-1 w-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(job.id)}
                      onCheckedChange={() => toggleOne(job.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 data-[state=checked]:opacity-100"
                    />
                  </div>

                  <div className="min-w-0 flex-[2]">{titleBlock}</div>

                  <div className="flex w-32 shrink-0 flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                    {statusPicker}
                    {(job.garageNeedsAdminAttention || job.garageUnreadUpdatesCount > 0 || job.status === "ready_for_check") && (
                      <GarageSyncChip
                        needsAttention={job.garageNeedsAdminAttention}
                        unreadCount={job.garageUnreadUpdatesCount}
                        updateType={job.garageLastUpdateType}
                        status={job.status}
                      />
                    )}
                  </div>

                  <div className="hidden min-w-0 flex-1 md:block">
                    <span className="block truncate text-sm text-foreground dark:text-foreground/90">
                      {job.customerName ?? <span className="text-muted-foreground/50 dark:text-muted-foreground">—</span>}
                    </span>
                    {job.locationName && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LOCATION_COLORS[job.locationName.toLowerCase()] ?? "bg-foreground/30 dark:bg-foreground/[0.10]"}`} />
                        <span className="truncate text-[11px] text-muted-foreground/70 dark:text-muted-foreground/70">{job.locationName}</span>
                      </div>
                    )}
                  </div>

                  <div className="hidden w-28 shrink-0 md:block" onClick={(e) => e.stopPropagation()}>
                    {documentCell}
                  </div>

                  <div className="hidden w-24 shrink-0 md:block">
                    {job.dueDate ? (
                      <SmartDate date={job.dueDate} className="text-xs text-muted-foreground dark:text-foreground/80" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground/50 dark:text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="hidden w-20 shrink-0 text-right md:block">
                    <SmartDate date={job.updatedAt} className="text-[11px] text-muted-foreground/70 dark:text-muted-foreground/70" />
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />}
        </div>
      )}

      {!hasMore && allJobs.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/70 dark:text-muted-foreground py-4">
          {allJobs.length} repair{allJobs.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ─── Table Status Picker (grouped dropdown) ───

const TABLE_STATUS_GROUPS = [
  { label: "Intake", items: ["new", "todo", "in_inspection", "no_damage"] },
  { label: "Quote", items: ["quote_needed", "waiting_approval", "waiting_customer"] },
  { label: "Work", items: ["waiting_parts", "scheduled", "in_progress", "blocked", "ready_for_check"] },
  { label: "Done", items: ["completed", "invoiced", "rejected", "archived"] },
] as const;

function TableStatusPicker({ value, onChange, pillClass, accentClass }: { value: string; onChange: (v: string) => void; pillClass: string; accentClass: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="focus:outline-none"
      >
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium max-w-[130px] transition-shadow hover:ring-1 hover:ring-gray-200 dark:hover:ring-white/10 ${pillClass}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${accentClass}`} />
          <span className="truncate">{STATUS_LABELS[value as RepairStatus]}</span>
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 max-h-[min(360px,70dvh)] min-w-[180px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg dark:border-border dark:bg-foreground md:left-0 md:right-auto">
          {TABLE_STATUS_GROUPS.map((group) => (
            <div key={group.label} className="mb-0.5 last:mb-0">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/50 dark:text-muted-foreground px-3 pt-2 pb-0.5">{group.label}</p>
              {group.items.map((val) => {
                const active = value === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { if (val !== value) onChange(val); setOpen(false); }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? "bg-muted dark:bg-foreground/[0.08] text-foreground dark:text-foreground"
                        : "text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted/40 dark:hover:bg-foreground/[0.05]"
                    }`}
                  >
                    {STATUS_LABELS[val as RepairStatus]}
                    {active && <span className="ml-auto text-green-500">✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
