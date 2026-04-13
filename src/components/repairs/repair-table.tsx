"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_COLORS, INVOICE_STATUS_LABELS } from "@/types";
import type { RepairStatus, InvoiceStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";
import { useState } from "react";
import { BulkActions } from "./bulk-actions";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { updateRepairJob } from "@/actions/repairs";
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
  tags: { id: string; name: string; color: string }[];
}

interface RepairTableProps {
  jobs: Job[];
}

export function RepairTable({ jobs }: RepairTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    if (selected.size === jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
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
      <div className="hidden md:flex items-center gap-4 px-4 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <div className="w-6 shrink-0" />
        <div className="flex-[2] min-w-0 cursor-pointer select-none" onClick={() => handleSort("title")}>
          <span className="inline-flex items-center">Title<SortIcon column="title" /></span>
        </div>
        <div className="w-28 shrink-0 cursor-pointer select-none" onClick={() => handleSort("status")}>
          <span className="inline-flex items-center">Status<SortIcon column="status" /></span>
        </div>
        <div className="flex-1 min-w-0 cursor-pointer select-none" onClick={() => handleSort("customerName")}>
          <span className="inline-flex items-center">Contact<SortIcon column="customerName" /></span>
        </div>
        <div className="w-24 shrink-0 cursor-pointer select-none" onClick={() => handleSort("invoiceStatus")}>
          <span className="inline-flex items-center">Invoice<SortIcon column="invoiceStatus" /></span>
        </div>
        <div className="w-24 shrink-0 cursor-pointer select-none" onClick={() => handleSort("dueDate")}>
          <span className="inline-flex items-center">Planned<SortIcon column="dueDate" /></span>
        </div>
        <div className="w-20 shrink-0 cursor-pointer select-none text-right" onClick={() => handleSort("updatedAt")}>
          <span className="inline-flex items-center">Updated<SortIcon column="updatedAt" /></span>
        </div>
      </div>

      {/* Repair rows */}
      <div className="space-y-1">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
            <ArrowUpDown className="h-8 w-8 opacity-15" />
            <p className="font-medium text-sm">No repair jobs found</p>
            <p className="text-xs">Try adjusting your filters</p>
          </div>
        ) : (
          jobs.map((job, idx) => {
            const isUrgent = job.priority === "urgent";
            const isHigh = job.priority === "high";

            return (
              <div
                key={job.id}
                className={`group relative flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-150 cursor-pointer
                  hover:bg-muted/50 hover:shadow-sm active:scale-[0.998]
                  ${selected.has(job.id) ? "bg-primary/[0.04] ring-1 ring-primary/20" : ""}
                  ${isUrgent ? "border-l-2 border-l-red-400" : ""}
                  animate-slide-up`}
                style={{ animationDelay: `${idx * 25}ms` }}
                onClick={() => {
                  const backTo = `/repairs?${searchParams.toString()}`;
                  router.push(`/repairs/${job.id}?backTo=${encodeURIComponent(backTo)}`);
                }}
              >
                {/* Checkbox */}
                <div className="w-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selected.has(job.id)}
                    onCheckedChange={() => toggleOne(job.id)}
                    className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
                  />
                </div>

                {/* Title + description */}
                <div className="flex-[2] min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {job.title || "Unnamed repair"}
                    </p>
                    {isUrgent && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                    {isHigh && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-orange-400" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {job.publicCode && (
                      <span className="text-[11px] text-muted-foreground/50 font-mono">{job.publicCode}</span>
                    )}
                    {job.publicCode && job.descriptionRaw && <span className="text-muted-foreground/30">·</span>}
                    {job.descriptionRaw && (
                      <span className="text-[11px] text-muted-foreground/60 truncate">{job.descriptionRaw.slice(0, 60)}</span>
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
                <div className="w-28 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus:outline-none">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-shadow hover:ring-1 hover:ring-ring/20 ${STATUS_COLORS[job.status as RepairStatus]}`}>
                          {STATUS_LABELS[job.status as RepairStatus]}
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
                          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${STATUS_COLORS[val as RepairStatus].split(" ")[0]}`} />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Contact */}
                <div className="flex-1 min-w-0 hidden md:block">
                  <div className="flex items-center gap-1.5">
                    {job.locationName && (
                      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${LOCATION_COLORS[job.locationName.toLowerCase()] ?? "bg-gray-300"}`} title={job.locationName} />
                    )}
                    <span className="text-xs text-foreground/80 truncate">
                      {job.customerName ?? <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </div>
                  {(job.unitRegistration || job.locationName) && (
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                      {[job.locationName, job.unitRegistration].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {/* Invoice */}
                <div className="w-24 shrink-0 hidden md:block">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    job.invoiceStatus === "paid" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                    job.invoiceStatus === "sent" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" :
                    job.invoiceStatus === "draft" ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
                    job.invoiceStatus === "warranty" ? "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400" :
                    "text-muted-foreground/40"
                  }`}>
                    {job.invoiceStatus === "not_invoiced" ? "—" : (INVOICE_STATUS_LABELS[job.invoiceStatus as InvoiceStatus] ?? job.invoiceStatus)}
                  </span>
                </div>

                {/* Planned */}
                <div className="w-24 shrink-0 hidden md:block">
                  {job.dueDate ? (
                    <SmartDate date={job.dueDate} className="text-xs text-muted-foreground/60" />
                  ) : (
                    <span className="text-muted-foreground/30 text-[11px]">—</span>
                  )}
                </div>

                {/* Updated */}
                <div className="w-20 shrink-0 text-right hidden md:block">
                  <SmartDate date={job.updatedAt} className="text-[11px] text-muted-foreground/40" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
