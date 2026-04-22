"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2, Sparkles } from "lucide-react";
import { createServiceRequest, removeServiceRequest } from "@/actions/services";
import { cn } from "@/lib/utils";

export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultPrice: string;
  taxPercent: string;
  active: boolean;
};

export type RepairServiceRequest = {
  id: string;
  serviceId: string | null;
  serviceName: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
  notes: string | null;
};

function fmtEuro(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(isNaN(n) ? 0 : n);
}

export function RepairServicesSection({
  repairJobId,
  requests,
  catalog,
}: {
  repairJobId: string;
  requests: RepairServiceRequest[];
  catalog: CatalogService[];
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [, startTransition] = useTransition();

  const totalExcl = requests.reduce(
    (acc, r) => acc + parseFloat(r.quantity) * parseFloat(r.unitPrice),
    0,
  );

  async function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeServiceRequest(id);
        toast.success("Service removed");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground/70 dark:text-muted-foreground font-semibold">
          Services
        </p>
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground/80 hover:text-foreground rounded-md px-2 py-1 bg-muted/60 dark:bg-foreground/[0.06] hover:bg-muted dark:hover:bg-foreground/[0.10] transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add service
        </button>
      </div>

      {requests.length === 0 && !showPicker ? (
        <p className="text-xs text-muted-foreground italic">No services yet.</p>
      ) : null}

      {requests.length > 0 && (
        <div className="space-y-1.5">
          {requests.map((r) => {
            const lineTotal = parseFloat(r.quantity) * parseFloat(r.unitPrice);
            return (
              <div
                key={r.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/40 dark:bg-card/[0.04] px-3 py-2 text-sm"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="flex-1 truncate font-medium">
                  {r.serviceName}
                  {parseFloat(r.quantity) !== 1 ? (
                    <span className="ml-1 text-muted-foreground">×{r.quantity}</span>
                  ) : null}
                </span>
                <span className="tabular-nums text-[12px] text-muted-foreground">
                  {fmtEuro(r.unitPrice)}
                </span>
                <span className="tabular-nums text-[12px] font-semibold">
                  {fmtEuro(lineTotal)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(r.id)}
                  className="text-muted-foreground/70 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <div className="flex justify-end text-[11px] text-muted-foreground pr-8">
            <span>Subtotal excl. VAT: </span>
            <span className="ml-2 font-semibold tabular-nums">{fmtEuro(totalExcl)}</span>
          </div>
        </div>
      )}

      {showPicker && (
        <div className="mt-2">
          <ServicePicker
            repairJobId={repairJobId}
            catalog={catalog.filter((c) => c.active)}
            onAdded={() => {
              router.refresh();
              setShowPicker(false);
            }}
            onCancel={() => setShowPicker(false)}
          />
        </div>
      )}
    </div>
  );
}

function ServicePicker({
  repairJobId,
  catalog,
  onAdded,
  onCancel,
}: {
  repairJobId: string;
  catalog: CatalogService[];
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? catalog.filter((c) => c.name.toLowerCase().includes(q) || (c.category ?? "").toLowerCase().includes(q))
      : catalog;
    const m = new Map<string, CatalogService[]>();
    for (const c of filtered) {
      const key = c.category ?? "other";
      m.set(key, [...(m.get(key) ?? []), c]);
    }
    return Array.from(m.entries());
  }, [catalog, search]);

  async function handlePick(s: CatalogService) {
    startTransition(async () => {
      try {
        await createServiceRequest({ repairJobId, serviceId: s.id });
        toast.success(`Added "${s.name}"`);
        onAdded();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card dark:bg-card/[0.04] p-3">
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services…"
          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2">
        {grouped.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No matches.</p>
        ) : (
          grouped.map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1">
                {cat}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={pending}
                    onClick={() => handlePick(s)}
                    className={cn(
                      "flex items-center justify-between rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-left text-xs hover:bg-muted/60 dark:hover:bg-foreground/[0.04] transition-colors",
                      pending && "opacity-50",
                    )}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="ml-2 tabular-nums font-semibold text-foreground/80">
                      {fmtEuro(s.defaultPrice)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
        >
          Close
        </button>
      </div>
    </div>
  );
}
