"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Wrench, X, Loader2 } from "lucide-react";
import { createPartRequest, updatePartRequestStatus } from "@/actions/parts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EquipmentRequest {
  id: string;
  repairJobId: string | null;
  partName: string | null;
  status: string;
  notes: string | null;
  jobTitle: string | null;
  jobRef: string | null;
  customerName?: string | null;
  unitRegistration?: string | null;
}

export function EquipmentClient({ requests }: { requests: EquipmentRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const active = requests.filter(r => r.status !== "received" && r.status !== "cancelled");
  const done = requests.filter(r => r.status === "received");

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createPartRequest({
          partName: name.trim(),
          notes: notes.trim() || undefined,
          requestType: "equipment",
        });
        router.refresh();
        toast.success(`"${name.trim()}" added`);
        setName("");
        setNotes("");
        setShowAdd(false);
      } catch {
        toast.error("Failed to add");
      }
    });
  }

  function handleCheck(id: string) {
    startTransition(async () => {
      try {
        await updatePartRequestStatus(id, "received");
        router.refresh();
      } catch {
        toast.error("Failed to update");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Add button / inline form */}
      {showAdd ? (
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 space-y-4">
          <div>
            <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">
              What do you need?
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heat gun, Rivet tool, Sealant..."
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all placeholder:text-gray-400 dark:placeholder:text-white/20"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
            />
          </div>
          <div>
            <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">
              Notes
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details..."
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:ring-blue-500/20 dark:focus:border-blue-500/40 transition-all placeholder:text-gray-400 dark:placeholder:text-white/20"
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowAdd(false); setName(""); setNotes(""); }}
              className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.06] py-2.5 text-sm font-semibold text-gray-600 dark:text-white/50 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim() || pending}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                name.trim() && !pending
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98]"
                  : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/20 cursor-not-allowed"
              )}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 py-3 text-sm font-medium text-gray-500 dark:text-white/30 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-600 dark:hover:text-white/50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add equipment request
        </button>
      )}

      {/* Active items */}
      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((req) => (
            <div
              key={req.id}
              className={cn(
                "group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 transition-all",
                pending && "opacity-50"
              )}
            >
              <button
                onClick={() => handleCheck(req.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 dark:border-white/20 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors group/check mt-0.5"
                title="Mark as received"
              >
                <Check className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover/check:opacity-100 transition-opacity" />
              </button>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[15px] text-gray-900 dark:text-white">
                  {req.partName ?? "—"}
                </span>
                {req.notes && (
                  <p className="text-xs text-gray-400 dark:text-white/25 mt-0.5 leading-relaxed">{req.notes}</p>
                )}
                {req.jobRef && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{req.jobRef}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn("h-2 w-2 rounded-full", req.status === "ordered" ? "bg-blue-400" : req.status === "shipped" ? "bg-violet-400" : "bg-amber-400")} />
                <span className="text-xs font-medium text-gray-400 dark:text-white/30 capitalize">{req.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {active.length === 0 && done.length === 0 && !showAdd && (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06]">
            <Wrench className="h-5 w-5 text-gray-400 dark:text-white/30" />
          </div>
          <p className="text-sm text-gray-500 dark:text-white/40">No equipment requests yet</p>
        </div>
      )}

      {/* Done items */}
      {done.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/20 px-1 mb-2">
            Received ({done.length})
          </p>
          {done.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] p-3 transition-all"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm text-gray-400 dark:text-white/30 line-through">
                {req.partName ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
