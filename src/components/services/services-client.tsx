"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createService, updateService, deleteService } from "@/actions/services";
import { cn } from "@/lib/utils";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultPrice: string;
  taxPercent: string;
  holdedProductId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const PRESET_CATEGORIES: { key: string; label: string }[] = [
  { key: "care", label: "Care / Waxing" },
  { key: "cleaning", label: "Cleaning" },
  { key: "maintenance", label: "Maintenance" },
  { key: "inspection", label: "Inspection" },
  { key: "storage", label: "Storage" },
];

function fmtEuro(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(isNaN(n) ? 0 : n);
}

export function ServicesClient({ services: initial }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [search, initial]);

  async function handleDelete(s: ServiceRow) {
    const ok = await confirmDialog({
      title: `Delete "${s.name}"?`,
      description: "Existing repairs that already use this service keep their lines. Future repairs won't see it in the picker.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteService(s.id);
        toast.success("Service deleted");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  async function toggleActive(s: ServiceRow) {
    startTransition(async () => {
      try {
        await updateService(s.id, { active: !s.active });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />
          New service
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={search ? "No matches" : "No services yet"}
          description={search ? "Try a different search term." : "Add your first service to see it here."}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 dark:border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price (excl.)</TableHead>
                <TableHead className="text-right">VAT</TableHead>
                <TableHead>Holded ID</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id} className={cn(!s.active && "opacity-50")}>
                  <TableCell className="font-medium">
                    <div>{s.name}</div>
                    {s.description ? (
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtEuro(s.defaultPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                    {s.taxPercent}%
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {s.holdedProductId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 transition-colors",
                        s.active
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800"
                          : "bg-muted text-muted-foreground ring-border hover:bg-muted/80",
                      )}
                    >
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showNew && <ServiceDialog onClose={() => setShowNew(false)} onSaved={() => router.refresh()} />}
      {editing && (
        <ServiceDialog
          service={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ServiceDialog({
  service,
  onClose,
  onSaved,
}: {
  service?: ServiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [category, setCategory] = useState(service?.category ?? "");
  const [price, setPrice] = useState(service ? String(parseFloat(service.defaultPrice)) : "");
  const [tax, setTax] = useState(service ? String(parseFloat(service.taxPercent)) : "21");
  const [holdedProductId, setHoldedProductId] = useState(service?.holdedProductId ?? "");
  const [pending, start] = useTransition();

  async function handleSave() {
    const trimmed = name.trim();
    const priceNum = parseFloat(price);
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price");
      return;
    }
    start(async () => {
      try {
        if (service) {
          await updateService(service.id, {
            name: trimmed,
            description: description.trim() || null,
            category: category.trim() || null,
            defaultPrice: priceNum,
            taxPercent: parseFloat(tax) || 21,
            holdedProductId: holdedProductId.trim() || null,
          });
          toast.success("Service updated");
        } else {
          await createService({
            name: trimmed,
            description: description.trim() || null,
            category: category.trim() || null,
            defaultPrice: priceNum,
            taxPercent: parseFloat(tax) || 21,
            holdedProductId: holdedProductId.trim() || null,
          });
          toast.success("Service created");
        }
        onSaved();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="service-category-options"
                placeholder="e.g. cleaning"
              />
              <datalist id="service-category-options">
                {PRESET_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <Label>Price excl. VAT (€)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="175"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VAT %</Label>
              <Input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Holded product ID (optional)</Label>
              <Input
                value={holdedProductId}
                onChange={(e) => setHoldedProductId(e.target.value)}
                placeholder="Leave empty to skip"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
