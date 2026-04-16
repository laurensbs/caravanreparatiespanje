"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { updatePartRequestStatus } from "@/actions/parts";
import { Check, Package, Truck, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  ordered: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  shipped: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
  received: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  cancelled: "bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400",
};

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "ordered", label: "Ordered / Shipped" },
  { key: "done", label: "Received" },
  { key: "all", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

interface PartRequest {
  id: string;
  repairJobId: string;
  partName: string | null;
  partNumber: string | null;
  supplierName: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  jobTitle: string | null;
  jobRef: string | null;
  requestType: string;
}

export function PartRequestsClient({ requests }: { requests: PartRequest[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("pending");
  const [pending, startTransition] = useTransition();

  // Filter out equipment
  const partReqs = requests.filter(r => r.requestType !== "equipment");

  const counts = {
    pending: partReqs.filter(r => r.status === "requested").length,
    ordered: partReqs.filter(r => ["ordered", "shipped"].includes(r.status)).length,
    done: partReqs.filter(r => r.status === "received").length,
    all: partReqs.length,
  };

  const filtered = partReqs.filter(r => {
    if (filter === "pending") return r.status === "requested";
    if (filter === "ordered") return ["ordered", "shipped"].includes(r.status);
    if (filter === "done") return r.status === "received";
    return r.status !== "cancelled";
  });

  function handleStatusChange(id: string, newStatus: "requested" | "ordered" | "shipped" | "received") {
    startTransition(async () => {
      try {
        await updatePartRequestStatus(id, newStatus);
        router.refresh();
        toast.success(newStatus === "received" ? "Marked as received" : `Status → ${newStatus}`);
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  if (partReqs.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
        No part requests yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              filter === f.key
                ? "bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100"
                : "text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {f.label}
            <span className={cn(
              "ml-1.5 text-[10px] tabular-nums",
              filter === f.key ? "text-gray-500" : "text-muted-foreground/60"
            )}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">
          No {filter === "pending" ? "pending" : filter === "ordered" ? "ordered" : filter === "done" ? "received" : ""} part requests.
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {filter !== "done" && (
                    <TableHead className="w-10" />
                  )}
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Part</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Repair</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Supplier</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Qty</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id} className={cn(pending && "opacity-50")}>
                    {filter !== "done" && (
                      <TableCell className="pr-0">
                        {req.status === "requested" ? (
                          <button
                            onClick={() => handleStatusChange(req.id, "ordered")}
                            className="h-5 w-5 rounded border border-amber-300 dark:border-amber-600 flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors group"
                            title="Mark as ordered"
                          >
                            <Package className="h-3 w-3 text-amber-400/0 group-hover:text-amber-500 transition-colors" />
                          </button>
                        ) : ["ordered", "shipped"].includes(req.status) ? (
                          <button
                            onClick={() => handleStatusChange(req.id, "received")}
                            className="h-5 w-5 rounded border border-blue-300 dark:border-blue-600 flex items-center justify-center hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors group"
                            title="Mark as received"
                          >
                            <Check className="h-3 w-3 text-blue-400/0 group-hover:text-emerald-500 transition-colors" />
                          </button>
                        ) : req.status === "received" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : null}
                      </TableCell>
                    )}
                    <TableCell>
                      <p className="font-medium text-sm">{req.partName ?? "—"}</p>
                      {req.partNumber && (
                        <p className="text-[11px] text-muted-foreground">{req.partNumber}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/repairs/${req.repairJobId}`}
                        className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        {req.jobRef || "—"}
                      </Link>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {req.jobTitle}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{req.supplierName ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{req.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={STATUS_COLORS[req.status] ?? ""}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {req.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
