"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Wrench, Loader2 } from "lucide-react";
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

function EquipmentRequestForm({
  name,
  setName,
  notes,
  setNotes,
  pending,
  onCancel,
  onSubmit,
}: {
  name: string;
  setName: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  pending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 space-y-4">
      <div>
        <label className="text-[13px] font-semibold text-gray-700 dark:text-white/60 mb-2 block">
          What do you need?
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Heat gun, Rivet tool, Sealant..."
          className="h-11 w-full touch-manipulation rounded-xl border border-gray-200 bg-white px-4 text-sm transition-all placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:placeholder:text-white/20 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/20 sm:h-auto sm:py-3"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSubmit();
            if (e.key === "Escape") onCancel();
          }}
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
          className="h-11 w-full touch-manipulation rounded-xl border border-gray-200 bg-white px-4 text-sm transition-all placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:placeholder:text-white/20 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/20 sm:h-auto sm:py-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 w-full touch-manipulation rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/50 dark:hover:bg-white/10 sm:min-h-0 sm:flex-1 sm:py-2.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!name.trim() || pending}
          className={cn(
            "min-h-11 w-full touch-manipulation rounded-xl py-3 text-sm font-semibold transition-all sm:min-h-0 sm:flex-1 sm:py-2.5",
            name.trim() && !pending
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-[0.98]"
              : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/20 cursor-not-allowed"
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Add"}
        </button>
      </div>
    </div>
  );
}

export function EquipmentClient({ requests }: { requests: EquipmentRequest[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const active = requests.filter((r) => r.status !== "received" && r.status !== "cancelled");
  const done = requests.filter((r) => r.status === "received");

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

  function cancelAdd() {
    setShowAdd(false);
    setName("");
    setNotes("");
  }

  if (requests.length === 0) {
    if (showAdd) {
      return (
        <EquipmentRequestForm
          name={name}
          setName={setName}
          notes={notes}
          setNotes={setNotes}
          pending={pending}
          onCancel={cancelAdd}
          onSubmit={handleAdd}
        />
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/10 py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.06]">
          <Wrench className="h-5 w-5 text-gray-400 dark:text-white/30" />
        </div>
        <p className="text-sm text-gray-500 dark:text-white/40 mb-4">No equipment requests yet</p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
        >
          <Plus className="h-4 w-4" /> Add request
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showAdd ? (
        <EquipmentRequestForm
          name={name}
          setName={setName}
          notes={notes}
          setNotes={setNotes}
          pending={pending}
          onCancel={cancelAdd}
          onSubmit={handleAdd}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 sm:w-auto sm:py-2.5"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((req) => (
            <div
              key={req.id}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all dark:border-white/[0.08] dark:bg-white/[0.02] sm:flex-row sm:items-start sm:gap-3",
                pending && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3 sm:block sm:shrink-0 sm:pt-0.5">
                <button
                  type="button"
                  onClick={() => handleCheck(req.id)}
                  className="group/check flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border-2 border-gray-300 transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/20 dark:hover:bg-emerald-500/10 sm:h-8 sm:w-8"
                  title="Mark as received"
                >
                  <Check className="h-4 w-4 text-emerald-500 opacity-70 transition-opacity group-hover/check:opacity-100 sm:h-3.5 sm:w-3.5 sm:opacity-0 sm:group-hover/check:opacity-100" />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      req.status === "ordered" ? "bg-blue-400" : req.status === "shipped" ? "bg-violet-400" : "bg-amber-400"
                    )}
                  />
                  <span className="text-xs font-medium capitalize text-gray-400 dark:text-white/30">{req.status}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[15px] font-semibold text-gray-900 dark:text-white">
                  {req.partName ?? "—"}
                </span>
                {req.notes && (
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-400 dark:text-white/25">{req.notes}</p>
                )}
                {req.jobRef && <p className="mt-0.5 text-xs text-blue-500 dark:text-blue-400">{req.jobRef}</p>}
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    req.status === "ordered" ? "bg-blue-400" : req.status === "shipped" ? "bg-violet-400" : "bg-amber-400"
                  )}
                />
                <span className="text-xs font-medium capitalize text-gray-400 dark:text-white/30">{req.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-1">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/20">
            Received ({done.length})
          </p>
          {done.map((req) => (
            <div
              key={req.id}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-gray-50 p-3 transition-all dark:bg-white/[0.02]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 sm:h-6 sm:w-6">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 sm:h-3.5 sm:w-3.5" />
              </div>
              <span className="text-sm text-gray-400 line-through dark:text-white/30">{req.partName ?? "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
