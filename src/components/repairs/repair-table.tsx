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
import { useState, useEffect, useRef, useCallback, useTransition } from "react";
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
        color: "text-sky-700 dark:text-sky-400",
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
      return { type: "no-damage", label: "No Damage", color: "text-gray-400 dark:text-slate-500" };
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
      "bg-blue-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600",
      "bg-purple-600", "bg-cyan-600", "bg-orange-600", "bg-indigo-600",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  const STATUS_ACCENT: Record<string, string> = {
    new: "bg-gray-300 dark:bg-slate-500",
    todo: "bg-gray-300 dark:bg-slate-500",
    in_inspection: "bg-sky-300 dark:bg-sky-400",
    no_damage: "bg-emerald-300 dark:bg-emerald-400",
    quote_needed: "bg-amber-300 dark:bg-amber-400",
    waiting_approval: "bg-amber-300 dark:bg-amber-400",
    waiting_customer: "bg-orange-400 dark:bg-orange-400",
    waiting_parts: "bg-amber-400 dark:bg-amber-400",
    scheduled: "bg-sky-300 dark:bg-sky-400",
    in_progress: "bg-sky-400 dark:bg-sky-400",
    blocked: "bg-red-400 dark:bg-red-400",
    completed: "bg-emerald-400 dark:bg-emerald-400",
    invoiced: "bg-emerald-300 dark:bg-emerald-400",
    rejected: "bg-red-300 dark:bg-rose-400",
    archived: "bg-gray-300 dark:bg-slate-600",
  };

  const STATUS_PILL: Record<string, string> = {
    new: "bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-slate-200",
    todo: "bg-gray-100 text-gray-600 dark:bg-slate-700/60 dark:text-slate-200",
    in_inspection: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    no_damage: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    quote_needed: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    waiting_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    waiting_customer: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    waiting_parts: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    scheduled: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    in_progress: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    blocked: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rejected: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
    archived: "bg-gray-100 text-gray-400 dark:bg-slate-700/40 dark:text-slate-400",
  };

  async function quickStatusChange(jobId: string, newStatus: string) {
    try {
      await updateRepairJob(jobId, { status: newStatus as any });
      toast.success(`Status → ${STATUS_LABELS[newStatus as RepairStatus]}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    }
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
      <div className="hidden md:flex items-center gap-5 px-5 pb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500 select-none">
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

      {/* Repair rows */}
      <div className="space-y-0">
        {allJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-gray-400 dark:text-slate-500">
            <ArrowUpDown className="h-8 w-8 opacity-20" />
            <p className="font-medium text-sm text-gray-500 dark:text-slate-400">No repair jobs found</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">Try adjusting your filters</p>
          </div>
        ) : (
          allJobs.map((job, idx) => {
            const isUrgent = job.priority === "urgent";
            const isHigh = job.priority === "high";

            return (
              <div
                key={job.id}
                className={`group relative flex items-center gap-5 rounded-xl px-5 py-5 transition-all duration-150 cursor-pointer
                  hover:bg-gray-50 dark:hover:bg-white/[0.03] active:scale-[0.998] border-b border-gray-100/60 dark:border-white/[0.05] last:border-b-0
                  ${selected.has(job.id) ? "bg-sky-50/40 dark:bg-sky-500/[0.06] ring-1 ring-sky-100 dark:ring-sky-500/20" : ""}
                  ${isUrgent ? "" : ""}
                  animate-slide-up`}
                style={{ animationDelay: `${Math.min(idx, 20) * 20}ms`, animationFillMode: "backwards" }}
                onClick={() => {
                  const backTo = `/repairs?${searchParams.toString()}`;
                  router.push(`/repairs/${job.id}?backTo=${encodeURIComponent(backTo)}`);
                }}
              >
                {/* Left status accent bar */}
                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-90 ${STATUS_ACCENT[job.status] ?? "bg-gray-300 dark:bg-slate-600"}`} />

                {/* Checkbox */}
                <div className="w-6 shrink-0 ml-1" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(job.id)}
                    onCheckedChange={() => toggleOne(job.id)}
                    className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                  />
                </div>

                {/* Title + description */}
                <div className="flex-[2] min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-medium text-gray-900 dark:text-slate-100 group-hover:text-[#0CC0DF] transition-colors">
                      {job.title || "Unnamed repair"}
                    </p>
                    {job.jobType && job.jobType !== "repair" && (
                      <span className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${JOB_TYPE_COLORS[job.jobType as JobType] ?? "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"}`}>
                        {JOB_TYPE_LABELS[job.jobType as JobType] ?? job.jobType}
                      </span>
                    )}
                    {isUrgent && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                    {isHigh && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-orange-400" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {job.publicCode && (
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 font-mono">{job.publicCode}</span>
                    )}
                    {job.publicCode && job.descriptionRaw && <span className="text-gray-300 dark:text-slate-600">·</span>}
                    {job.descriptionRaw && (
                      <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate">{job.descriptionRaw.slice(0, 60)}</span>
                    )}
                  </div>
                  {/* Tags inline */}
                  {job.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
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
                </div>

                {/* Status */}
                <div className="w-32 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus:outline-none">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium max-w-[130px] transition-shadow hover:ring-1 hover:ring-gray-200 dark:hover:ring-white/10 ${STATUS_PILL[job.status as RepairStatus] ?? "bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-slate-200"}`} title={STATUS_LABELS[job.status as RepairStatus]}>
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_ACCENT[job.status] ?? "bg-gray-300 dark:bg-slate-500"}`} />
                          <span className="truncate">{STATUS_LABELS[job.status as RepairStatus]}</span>
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <DropdownMenuItem
                          key={val}
                          className={val === job.status ? "font-semibold" : ""}
                          onClick={() => { if (val !== job.status) quickStatusChange(job.id, val); }}
                        >
                          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_ACCENT[val] ?? "bg-gray-300 dark:bg-slate-500"}`} />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Garage sync chip */}
                {(job.garageNeedsAdminAttention || job.garageUnreadUpdatesCount > 0 || job.status === "ready_for_check") && (
                  <div className="shrink-0 hidden sm:block">
                    <GarageSyncChip
                      needsAttention={job.garageNeedsAdminAttention}
                      unreadCount={job.garageUnreadUpdatesCount}
                      updateType={job.garageLastUpdateType}
                      status={job.status}
                    />
                  </div>
                )}

                {/* Contact */}
                <div className="flex-1 min-w-0 hidden md:block">
                  <span className="text-sm text-gray-800 dark:text-slate-200 truncate block">
                    {job.customerName ?? <span className="text-gray-300 dark:text-slate-600">—</span>}
                  </span>
                  {job.locationName && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${LOCATION_COLORS[job.locationName.toLowerCase()] ?? "bg-gray-300 dark:bg-slate-600"}`} />
                      <span className="text-[11px] text-gray-400 dark:text-slate-400 truncate">{job.locationName}</span>
                    </div>
                  )}
                </div>

                {/* Document */}
                <div className="w-28 shrink-0 hidden md:block" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    // Document priority logic
                    const doc = getDocumentInfo(job);
                    if (!doc) return <span className="text-[11px] text-gray-300 dark:text-slate-600">—</span>;
                    if (!doc.pdfUrl) {
                      return <span className={`text-[11px] font-medium truncate block ${doc.color}`}>{doc.label}</span>;
                    }
                    return (
                      <a
                        href={doc.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group/doc inline-flex items-center gap-1 text-[11px] font-medium truncate ${doc.color} hover:underline`}
                        title={doc.title}
                      >
                        <span className="truncate">{doc.label}</span>
                        {doc.holdedUrl && (
                          <a
                            href={doc.holdedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover/doc:opacity-100 shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                            title="Open in Holded"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </a>
                    );
                  })()}
                </div>

                {/* Planned */}
                <div className="w-24 shrink-0 hidden md:block">
                  {job.dueDate ? (
                    <SmartDate date={job.dueDate} className="text-xs text-gray-500 dark:text-slate-300" />
                  ) : (
                    <span className="text-gray-300 dark:text-slate-600 text-[11px]">—</span>
                  )}
                </div>

                {/* Updated */}
                <div className="w-20 shrink-0 text-right hidden md:block">
                  <SmartDate date={job.updatedAt} className="text-[11px] text-gray-400 dark:text-slate-400" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
      )}

      {!hasMore && allJobs.length > 0 && (
        <p className="text-center text-[11px] text-gray-400 dark:text-slate-500 py-4">
          {allJobs.length} repair{allJobs.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
