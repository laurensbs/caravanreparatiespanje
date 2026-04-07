"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, INVOICE_STATUS_LABELS } from "@/types";
import type { RepairStatus, Priority, InvoiceStatus } from "@/types";
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

      <div className="rounded-lg border bg-card overflow-x-auto max-h-[calc(100vh-16rem)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0] shadow-border">
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 sticky left-0 bg-muted/50">
                <Checkbox
                  checked={jobs.length > 0 && selected.size === jobs.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-28">Ref</TableHead>
              <TableHead>Title / Description</TableHead>
              <TableHead className="w-24 cursor-pointer select-none" onClick={() => handleSort("status")}>
                <span className="inline-flex items-center">Status<SortIcon column="status" /></span>
              </TableHead>
              <TableHead className="w-24 cursor-pointer select-none" onClick={() => handleSort("priority")}>
                <span className="inline-flex items-center">Priority<SortIcon column="priority" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("customerName")}>
                <span className="inline-flex items-center">Customer<SortIcon column="customerName" /></span>
              </TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-28 cursor-pointer select-none" onClick={() => handleSort("invoiceStatus")}>
                <span className="inline-flex items-center">Invoice<SortIcon column="invoiceStatus" /></span>
              </TableHead>
              <TableHead className="w-28 cursor-pointer select-none" onClick={() => handleSort("updatedAt")}>
                <span className="inline-flex items-center">Updated<SortIcon column="updatedAt" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ArrowUpDown className="h-8 w-8 opacity-30" />
                    <p className="font-medium">No repair jobs found</p>
                    <p className="text-xs">Try adjusting your filters or create a new repair</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70"
                  data-state={selected.has(job.id) ? "selected" : undefined}
                  onClick={() => {
                    const backTo = `/repairs?${searchParams.toString()}`;
                    router.push(`/repairs/${job.id}?backTo=${encodeURIComponent(backTo)}`);
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(job.id)}
                      onCheckedChange={() => toggleOne(job.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.publicCode ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="truncate font-medium text-sm">
                        {job.title || "Unnamed repair"}
                      </p>
                      {job.descriptionRaw && (
                        <p className="truncate text-xs text-muted-foreground">
                          {job.descriptionRaw.slice(0, 80)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="focus:outline-none">
                          <Badge variant="secondary" className={`text-[11px] cursor-pointer hover:ring-2 hover:ring-ring/30 transition-shadow ${STATUS_COLORS[job.status as RepairStatus]}`}>
                            {STATUS_LABELS[job.status as RepairStatus]}
                          </Badge>
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
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[11px] ${PRIORITY_COLORS[job.priority as Priority]}`}>
                      {PRIORITY_LABELS[job.priority as Priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{job.customerName ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {job.locationName ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${LOCATION_COLORS[job.locationName.toLowerCase()] ?? "bg-gray-400"}`} />
                        {job.locationName}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-xs">{job.unitRegistration ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {job.assignedUserName ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${getInitialsColor(job.assignedUserName)}`}>
                          {getInitials(job.assignedUserName)}
                        </span>
                        <span className="hidden lg:inline">{job.assignedUserName}</span>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      job.invoiceStatus === "paid" ? "bg-emerald-100 text-emerald-700" :
                      job.invoiceStatus === "sent" ? "bg-blue-100 text-blue-700" :
                      job.invoiceStatus === "draft" ? "bg-amber-100 text-amber-700" :
                      job.invoiceStatus === "warranty" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {INVOICE_STATUS_LABELS[job.invoiceStatus as InvoiceStatus] ?? job.invoiceStatus}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SmartDate date={job.updatedAt} className="text-xs text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
