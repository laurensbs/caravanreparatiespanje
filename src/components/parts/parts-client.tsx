"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, ExternalLink, Search,
  Zap, Wrench, SquareStack, Paintbrush, Droplets,
  Snowflake, Warehouse, Truck, Sparkles, Hammer,
  Package, Home, AlertTriangle, CheckCircle,
} from "lucide-react";
import { createPart, updatePart, deletePart, createPartCategory, deletePartCategory } from "@/actions/parts";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

// ─── Icon map (maps DB icon string → component) ───
export const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Wrench, SquareStack, Paintbrush, Droplets,
  Snowflake, Warehouse, Truck, Sparkles, Hammer,
  Package, Home,
};

export interface PartCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  supplierName: string | null;
  supplierId: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  description: string | null;
  orderUrl: string | null;
  stockQuantity: number;
  minStockLevel: number;
  createdAt: Date;
}

interface Supplier {
  id: string;
  name: string;
}

interface PartsClientProps {
  parts: Part[];
  suppliers: Supplier[];
  categories: PartCategory[];
  defaultMarkup?: number;
}

export function PartsClient({ parts, suppliers, categories, defaultMarkup = 25 }: PartsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "low_stock" | "out_of_stock">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  // Build lookup map from DB categories
  const categoryMap = useMemo(() => {
    const m: Record<string, { label: string; icon: React.ElementType; color: string }> = {};
    for (const cat of categories) {
      m[cat.key] = { label: cat.label, icon: ICON_MAP[cat.icon] ?? Package, color: cat.color };
    }
    return m;
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of parts) {
      const cat = p.category ?? "services";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [parts]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (activeCategory && (p.category ?? "services") !== activeCategory) return false;
      if (stockFilter === "out_of_stock" && !(p.minStockLevel > 0 && p.stockQuantity <= 0)) return false;
      if (stockFilter === "low_stock" && !(p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.partNumber?.toLowerCase().includes(q) ?? false) ||
          (p.supplierName?.toLowerCase().includes(q) ?? false) ||
          (p.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [parts, search, activeCategory, stockFilter]);

  function openCreate() {
    setEditingPart(null);
    setDialogOpen(true);
  }

  function openEdit(part: Part) {
    setEditingPart(part);
    setDialogOpen(true);
  }

  async function handleDelete(part: Part) {
    const ok = await confirmDialog({
      title: `Delete "${part.name}"?`,
      description: "This part will be removed from the catalog.",
      tone: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      await deletePart(part.id);
      router.refresh();
    });
  }

  const lowStockCount = parts.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel).length;
  const outOfStockCount = parts.filter((p) => p.minStockLevel > 0 && p.stockQuantity <= 0).length;

  return (
    <div className="space-y-4">
      {/* Category filter buttons — horizontal scroll on narrow screens */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={cn(
            "inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:py-1.5",
            !activeCategory ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 hover:bg-muted"
          )}
        >
          All
          <span className="font-semibold tabular-nums">{parts.length}</span>
        </button>
        {categories.filter(c => c.active).map((cat) => {
          const cnt = categoryCounts[cat.key] ?? 0;
          if (cnt === 0) return null;
          const CatIcon = ICON_MAP[cat.icon] ?? Package;
          return (
            <button
              type="button"
              key={cat.key}
              onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
              className={cn(
                "inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all active:scale-[0.98] sm:py-1.5",
                activeCategory === cat.key ? `${cat.color} shadow-sm` : `bg-muted/60 hover:bg-muted`
              )}
            >
              <CatIcon className="h-3.5 w-3.5" />
              {cat.label}
              <span className="font-semibold tabular-nums">{cnt}</span>
            </button>
          );
        })}
        {/* Add category */}
        {showAddCategory ? (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-card px-2 py-1.5 ring-1 ring-border/50">
            <Input
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              placeholder="Category name..."
              className="h-9 w-36 min-w-[8rem] text-xs touch-manipulation sm:h-7 sm:w-32"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCategoryLabel.trim()) {
                  startTransition(async () => {
                    await createPartCategory({
                      key: newCategoryLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""),
                      label: newCategoryLabel.trim(),
                    });
                    setNewCategoryLabel("");
                    setShowAddCategory(false);
                    router.refresh();
                  });
                }
                if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryLabel(""); }
              }}
            />
            <button
              onClick={() => {
                if (!newCategoryLabel.trim()) return;
                startTransition(async () => {
                  await createPartCategory({
                    key: newCategoryLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, ""),
                    label: newCategoryLabel.trim(),
                  });
                  setNewCategoryLabel("");
                  setShowAddCategory(false);
                  router.refresh();
                });
              }}
              disabled={!newCategoryLabel.trim()}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button onClick={() => { setShowAddCategory(false); setNewCategoryLabel(""); }} className="text-muted-foreground hover:text-foreground">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddCategory(true)}
            className="inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-dashed border-border/50 bg-muted/40 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted/60 active:scale-[0.98] sm:py-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Category
          </button>
        )}
      </div>

      {/* Search + stock filter + add button */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search parts…"
              className="h-11 touch-manipulation pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <div className="flex flex-wrap gap-2">
              {outOfStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === "out_of_stock" ? "all" : "out_of_stock")}
                  className={cn(
                    "inline-flex touch-manipulation items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all sm:py-1",
                    stockFilter === "out_of_stock"
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Out of Stock ({outOfStockCount})
                </button>
              )}
              {lowStockCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStockFilter(stockFilter === "low_stock" ? "all" : "low_stock")}
                  className={cn(
                    "inline-flex touch-manipulation items-center gap-1 rounded-full px-3 py-2 text-xs font-medium transition-all sm:py-1",
                    stockFilter === "low_stock"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 hover:bg-amber-100"
                  )}
                >
                  Low Stock ({lowStockCount})
                </button>
              )}
            </div>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={openCreate} className="h-11 w-full touch-manipulation gap-2 sm:h-10 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Part
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[min(92vh,900px)] gap-0 border-border/60 p-0 dark:border-white/10 sm:max-w-2xl">
            <PartForm
              part={editingPart}
              suppliers={suppliers}
              categories={categories}
              defaultMarkup={defaultMarkup}
              onDone={() => {
                setDialogOpen(false);
                router.refresh();
              }}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} part{filtered.length !== 1 ? "s" : ""}
        {activeCategory ? ` in ${categoryMap[activeCategory]?.label ?? activeCategory}` : ""}
        {search ? ` matching "${search}"` : ""}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || activeCategory ? "No parts match your filters." : "No parts in catalog yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile / tablet: card list */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((part) => {
              const cat = categoryMap[part.category ?? "services"];
              const CatIcon = cat?.icon ?? Package;
              const markup = part.markupPercent ? parseFloat(part.markupPercent) : defaultMarkup;
              const cost = part.defaultCost ? parseFloat(part.defaultCost) : null;
              const ourPrice = cost !== null ? cost * (1 + markup / 100) : null;
              const isLowStock = part.stockQuantity > 0 && part.stockQuantity <= part.minStockLevel;
              const isOutOfStock = part.minStockLevel > 0 && part.stockQuantity <= 0;
              return (
                <div
                  key={part.id}
                  className="rounded-xl border border-border/80 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", cat?.color ?? "bg-muted text-muted-foreground")}>
                        <CatIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{part.name}</p>
                        {part.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{part.description}</p>
                        )}
                        <p className="mt-1 font-mono text-xs text-muted-foreground">{part.partNumber ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 touch-manipulation" onClick={() => openEdit(part)} aria-label="Edit part">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 touch-manipulation text-destructive hover:text-destructive"
                        onClick={() => handleDelete(part)}
                        disabled={isPending}
                        aria-label="Delete part"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3 text-sm">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cost</p>
                      <p className="font-medium tabular-nums">{cost !== null ? `€${cost.toFixed(2)}` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Our price</p>
                      <p className="font-semibold tabular-nums text-foreground">{ourPrice !== null ? `€${ourPrice.toFixed(2)}` : "—"}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {part.minStockLevel > 0 ? (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                        isOutOfStock ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" :
                        isLowStock ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
                        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                      )}>
                        {isOutOfStock || isLowStock ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Stock: {part.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Stock not tracked</span>
                    )}
                    {part.orderUrl ? (
                      <a
                        href={part.orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-primary touch-manipulation hover:bg-muted/50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Order link
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border/80 bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Our Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="hidden xl:table-cell">Order</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((part) => {
                  const cat = categoryMap[part.category ?? "services"];
                  const CatIcon = cat?.icon ?? Package;
                  const markup = part.markupPercent ? parseFloat(part.markupPercent) : defaultMarkup;
                  const cost = part.defaultCost ? parseFloat(part.defaultCost) : null;
                  const ourPrice = cost !== null ? cost * (1 + markup / 100) : null;
                  const isLowStock = part.stockQuantity > 0 && part.stockQuantity <= part.minStockLevel;
                  const isOutOfStock = part.minStockLevel > 0 && part.stockQuantity <= 0;
                  return (
                  <TableRow key={part.id}>
                    <TableCell>
                      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", cat?.color ?? "bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground")}>
                        <CatIcon className="h-3.5 w-3.5" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{part.name}</p>
                      {part.description && (
                        <p className="max-w-xs truncate text-[11px] text-muted-foreground">{part.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{part.partNumber ?? "—"}</TableCell>
                    <TableCell className="text-sm">{cost !== null ? `€${cost.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {ourPrice !== null ? `€${ourPrice.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {part.minStockLevel > 0 ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          isOutOfStock ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" :
                          isLowStock ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" :
                          "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                        )}>
                          {isOutOfStock || isLowStock ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                          {part.stockQuantity}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {part.orderUrl ? (
                        <a
                          href={part.orderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Order
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 touch-manipulation" onClick={() => openEdit(part)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 touch-manipulation text-destructive hover:text-destructive"
                          onClick={() => handleDelete(part)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function PartForm({
  part,
  suppliers,
  categories,
  defaultMarkup,
  onDone,
  onCancel,
}: {
  part: Part | null;
  suppliers: Supplier[];
  categories: PartCategory[];
  defaultMarkup: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(part?.name ?? "");
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? "");
  const [category, setCategory] = useState(part?.category ?? "");
  const [supplierId, setSupplierId] = useState(part?.supplierId ?? "");
  const [defaultCost, setDefaultCost] = useState(part?.defaultCost ?? "");
  const [markupPercent, setMarkupPercent] = useState(part?.markupPercent ?? "");
  const [description, setDescription] = useState(part?.description ?? "");
  const [orderUrl, setOrderUrl] = useState(part?.orderUrl ?? "");
  const [stockQuantity, setStockQuantity] = useState(String(part?.stockQuantity ?? 0));
  const [minStockLevel, setMinStockLevel] = useState(String(part?.minStockLevel ?? 0));
  const [nameError, setNameError] = useState("");

  const effectiveMarkup = markupPercent ? parseFloat(markupPercent) : defaultMarkup;
  const cost = defaultCost ? parseFloat(defaultCost) : NaN;
  const ourPrice = !isNaN(cost) ? cost * (1 + effectiveMarkup / 100) : NaN;

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const isEditing = !!part;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Part name is required");
      return;
    }
    setNameError("");
    startTransition(async () => {
      if (part) {
        await updatePart(part.id, {
          name: name.trim(),
          partNumber: partNumber.trim() || null,
          category: category || null,
          supplierId: supplierId || null,
          defaultCost: defaultCost.trim() || null,
          markupPercent: markupPercent.trim() || null,
          description: description.trim() || null,
          orderUrl: orderUrl.trim() || null,
          stockQuantity: parseInt(stockQuantity) || 0,
          minStockLevel: parseInt(minStockLevel) || 0,
        });
      } else {
        await createPart({
          name: name.trim(),
          partNumber: partNumber.trim() || undefined,
          category: category || undefined,
          supplierId: supplierId || undefined,
          defaultCost: defaultCost.trim() || undefined,
          markupPercent: markupPercent.trim() || undefined,
          description: description.trim() || undefined,
          orderUrl: orderUrl.trim() || undefined,
          stockQuantity: parseInt(stockQuantity) || 0,
          minStockLevel: parseInt(minStockLevel) || 0,
        });
      }
      onDone();
    });
  }

  const fieldInput = "w-full h-11 text-sm rounded-xl border-border dark:border-white/10 bg-card dark:bg-[#0F172A] text-foreground dark:text-slate-100 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground px-4 focus:ring-2 focus:ring-[currentColor]/15 focus:border-[currentColor]/40 transition-all duration-150 shadow-none";
  const fieldLabel = "text-sm font-medium text-foreground/90 dark:text-foreground/80";

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground dark:text-slate-100 tracking-tight">
              {isEditing ? "Edit part" : "Add part"}
            </h2>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground/70 mt-1">
              {isEditing ? "Update this part's details" : "Create a new part and sync it to Holded"}
            </p>
          </div>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="px-6 pb-6 sm:px-8 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* Name (full width) */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className={fieldLabel}>Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(""); }}
            placeholder="e.g. Window seal 60 cm"
            className={cn(fieldInput, nameError && "border-red-300 dark:border-red-500/40 focus:ring-red-200 focus:border-red-400")}
            autoFocus
          />
          {nameError && <p className="text-xs text-red-600 dark:text-red-400">{nameError}</p>}
        </div>

        {/* Part Number + Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="partNumber" className={fieldLabel}>Part number</Label>
            <Input id="partNumber" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g. WS-060" className={fieldInput} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category" className={fieldLabel}>Category</Label>
            <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
              <SelectTrigger className={fieldInput}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.filter(c => c.active).map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] ?? Package;
                  return (
                    <SelectItem key={cat.key} value={cat.key}>
                      <span className="flex items-center gap-1.5">
                        <CatIcon className="h-3.5 w-3.5" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cost + Markup */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cost" className={fieldLabel}>Cost (€)</Label>
            <Input id="cost" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} placeholder="0.00" type="number" step="0.01" min="0" className={fieldInput} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="markup" className={fieldLabel}>Markup %</Label>
            <Input
              id="markup"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
              placeholder={`${defaultMarkup}% (default)`}
              type="number"
              step="1"
              min="0"
              className={fieldInput}
            />
          </div>
        </div>

        {/* Calculated price */}
        {!isNaN(ourPrice) && (
          <div className="flex items-center gap-2 rounded-xl border border-border/60 dark:border-white/[0.06] bg-muted/40/50 dark:bg-card/[0.02] px-4 py-3">
            <span className="text-sm font-medium text-foreground dark:text-slate-100">Our Price: €{ourPrice.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground dark:text-muted-foreground/70">({effectiveMarkup}% markup)</span>
          </div>
        )}

        {/* Stock + Min Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="stock" className={fieldLabel}>Stock quantity</Label>
            <Input id="stock" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} type="number" min="0" placeholder="0" className={fieldInput} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="minStock" className={fieldLabel}>Minimum stock</Label>
            <Input id="minStock" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} type="number" min="0" placeholder="0" className={fieldInput} />
          </div>
        </div>

        {/* Supplier (full width) */}
        <div className="space-y-1.5">
          <Label htmlFor="supplier" className={fieldLabel}>Supplier</Label>
          <SearchableSelect
            options={supplierOptions}
            value={supplierId}
            onValueChange={setSupplierId}
            placeholder="Type to search suppliers..."
            emptyLabel="No supplier"
          />
        </div>

        {/* Order URL (full width) */}
        <div className="space-y-1.5">
          <Label htmlFor="orderUrl" className={fieldLabel}>Order URL</Label>
          <Input id="orderUrl" value={orderUrl} onChange={(e) => setOrderUrl(e.target.value)} placeholder="https://supplier.com/product/..." className={fieldInput} />
        </div>

        {/* Description (full width) */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className={fieldLabel}>Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional internal description"
            rows={3}
            className="w-full min-h-[96px] text-sm rounded-xl border-border dark:border-white/10 bg-card dark:bg-[#0F172A] text-foreground dark:text-slate-100 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground px-4 py-3 focus:ring-2 focus:ring-[currentColor]/15 focus:border-[currentColor]/40 transition-all duration-150 shadow-none resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col-reverse gap-3 border-t border-border/60 px-6 py-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {!isEditing && (
          <p className="hidden text-center text-xs text-muted-foreground/70 dark:text-muted-foreground sm:block sm:text-left">
            New parts are also synced to Holded.
          </p>
        )}
        <div className={cn("flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3", isEditing && "sm:ml-auto")}>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 touch-manipulation rounded-xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? (isEditing ? "Saving…" : "Creating…")
              : (isEditing ? "Save changes" : "Create part")}
          </button>
        </div>
      </div>
    </form>
  );
}
