"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updatePartRequestStatus, createPartRequest } from "@/actions/parts";
import { searchRepairJobsForPicker } from "@/actions/repairs";
import { Check, Package, Plus, Search, Loader2, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_DOT: Record<string, string> = {
  requested: "bg-amber-400",
  ordered: "bg-blue-400",
  shipped: "bg-violet-400",
  received: "bg-emerald-400",
  cancelled: "bg-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  ordered: "Ordered",
  shipped: "Shipped",
  received: "Received",
  cancelled: "Cancelled",
};

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "ordered", label: "Ordered" },
  { key: "done", label: "Received" },
  { key: "all", label: "All" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

interface PartRequest {
  id: string;
  repairJobId: string | null;
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
  const [showAdd, setShowAdd] = useState(false);

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
      <>
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06]">
            <Package className="h-5 w-5 text-gray-400 dark:text-white/30" />
          </div>
          <p className="text-sm text-gray-500 dark:text-white/40 mb-4">No part requests yet</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add request
          </button>
        </div>
        <AddRequestDialog open={showAdd} onClose={() => setShowAdd(false)} requestType="part" />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filter + Add */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-white/[0.06] p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all",
                filter === f.key
                  ? "bg-white dark:bg-white/10 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60"
              )}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className={cn(
                  "ml-1.5 text-[11px] tabular-nums",
                  filter === f.key ? "text-gray-400 dark:text-white/40" : "text-gray-400/60 dark:text-white/20"
                )}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 py-12 text-center text-sm text-gray-500 dark:text-white/30">
          No {filter === "pending" ? "pending" : filter === "ordered" ? "ordered" : filter === "done" ? "received" : ""} requests
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => (
            <div
              key={req.id}
              className={cn(
                "group rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 transition-all",
                pending && "opacity-50"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox / status action */}
                <div className="pt-0.5">
                  {req.status === "requested" ? (
                    <button
                      onClick={() => handleStatusChange(req.id, "ordered")}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-amber-300 dark:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors group/check"
                      title="Mark as ordered"
                    >
                      <Package className="h-3.5 w-3.5 text-amber-400 opacity-0 group-hover/check:opacity-100 transition-opacity" />
                    </button>
                  ) : ["ordered", "shipped"].includes(req.status) ? (
                    <button
                      onClick={() => handleStatusChange(req.id, "received")}
                      className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-blue-300 dark:border-blue-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors group/check"
                      title="Mark as received"
                    >
                      <Check className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover/check:opacity-100 transition-opacity" />
                    </button>
                  ) : req.status === "received" ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  ) : null}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("font-semibold text-[15px]", req.status === "received" ? "line-through text-gray-400 dark:text-white/30" : "text-gray-900 dark:text-white")}>
                      {req.partName ?? "—"}
                    </span>
                    {req.quantity > 1 && (
                      <span className="text-xs tabular-nums text-gray-400 dark:text-white/30 font-medium">×{req.quantity}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/repairs/${req.repairJobId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      {req.jobRef || "—"}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                    {req.jobTitle && (
                      <span className="text-xs text-gray-400 dark:text-white/25 truncate max-w-[200px]">{req.jobTitle}</span>
                    )}
                  </div>
                  {req.notes && (
                    <p className="text-xs text-gray-400 dark:text-white/25 mt-1 leading-relaxed">{req.notes}</p>
                  )}
                </div>

                {/* Status pill */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[req.status])} />
                  <span className="text-xs font-medium text-gray-500 dark:text-white/40">
                    {STATUS_LABEL[req.status] ?? req.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <AddRequestDialog open={showAdd} onClose={() => setShowAdd(false)} requestType="part" />
    </div>
  );
}

/* ─── Shared Add Request Dialog ─── */

type RepairOption = {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  customerName: string | null;
  unitRegistration: string | null;
};

export function AddRequestDialog({ open, onClose, requestType }: {
  open: boolean;
  onClose: () => void;
  requestType: "part" | "equipment";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [repairQuery, setRepairQuery] = useState("");
  const [repairResults, setRepairResults] = useState<RepairOption[]>([]);
  const [selectedRepair, setSelectedRepair] = useState<RepairOption | null>(null);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setRepairQuery(q);
    if (q.length < 2) { setRepairResults([]); return; }
    setSearching(true);
    try {
      const results = await searchRepairJobsForPicker(q);
      setRepairResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSubmit = () => {
    if (!selectedRepair || !name.trim()) return;
    startTransition(async () => {
      try {
        await createPartRequest({
          repairJobId: selectedRepair.id,
          partName: name.trim(),
          quantity: parseInt(quantity) || 1,
          notes: notes.trim() || undefined,
          requestType,
        });
        router.refresh();
        toast.success(`${requestType === "equipment" ? "Equipment" : "Part"} request added`);
        handleClose();
      } catch {
        toast.error("Failed to create request");
      }
    });
  };

  const handleClose = () => {
    setName("");
    setNotes("");
    setQuantity("1");
    setRepairQuery("");
    setRepairResults([]);
    setSelectedRepair(null);
    onClose();
  };

  const isValid = selectedRepair && name.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {requestType === "equipment" ? "Add Equipment" : "Add Part Request"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            {requestType === "equipment"
              ? "Request equipment for a repair job"
              : "Request a part — the repair will be set to waiting"}
          </p>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Repair picker */}
          <div>
            <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">
              Repair Job
            </label>
            {selectedRepair ? (
              <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {selectedRepair.publicCode}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-white/50 truncate mt-0.5">{selectedRepair.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedRepair.customerName && (
                      <span className="text-xs text-gray-400 dark:text-white/30">{selectedRepair.customerName}</span>
                    )}
                    {selectedRepair.unitRegistration && (
                      <span className="text-xs font-mono text-gray-400 dark:text-white/30">{selectedRepair.unitRegistration}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRepair(null)}
                  className="ml-3 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 dark:hover:text-white/60 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-white/25" />
                <input
                  value={repairQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search by ref, customer, plate..."
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all placeholder:text-gray-400 dark:placeholder:text-white/20"
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
                )}
                {repairResults.length > 0 && (
                  <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-xl max-h-52 overflow-y-auto">
                    {repairResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedRepair(r); setRepairResults([]); setRepairQuery(""); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors border-b border-gray-100 dark:border-white/[0.06] last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{r.publicCode}</span>
                          <span className="text-sm text-gray-700 dark:text-white/70 truncate">{r.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.customerName && <span className="text-xs text-gray-400 dark:text-white/30">{r.customerName}</span>}
                          {r.unitRegistration && <span className="text-xs font-mono text-gray-400 dark:text-white/30">{r.unitRegistration}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Part name */}
          <div>
            <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">
              {requestType === "equipment" ? "Equipment name" : "Part name"}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={requestType === "equipment" ? "e.g. Heat gun, Rivet tool..." : "e.g. Brake pads, Window seal..."}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all placeholder:text-gray-400 dark:placeholder:text-white/20"
            />
          </div>

          {/* Quantity + Notes row */}
          <div className="flex gap-4">
            {requestType === "part" && (
              <div className="w-24">
                <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all"
                />
              </div>
            )}
            <div className="flex-1">
              <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional details..."
                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all placeholder:text-gray-400 dark:placeholder:text-white/20"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/[0.06] bg-gray-50/50 dark:bg-white/[0.02]">
          <button
            onClick={handleClose}
            className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.06] py-3 text-sm font-semibold text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={cn(
              "flex-1 rounded-xl py-3 text-sm font-semibold transition-all",
              isValid && !isPending
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98]"
                : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/20 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Adding...
              </span>
            ) : (
              "Add Request"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
