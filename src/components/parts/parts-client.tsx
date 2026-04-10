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
  DialogHeader,
  DialogTitle,
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
import { createPart, updatePart, deletePart } from "@/actions/parts";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

// ─── Category config ───
export const PART_CATEGORIES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  elektra: { label: "Elektra", icon: Zap, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" },
  chassis: { label: "Chassis", icon: Wrench, color: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400" },
  ramen: { label: "Ramen & Dakluiken", icon: SquareStack, color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  carrosserie: { label: "Carrosserie", icon: Paintbrush, color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400" },
  sanitair: { label: "Sanitair & Gas", icon: Droplets, color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  klimaat: { label: "Klimaat", icon: Snowflake, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400" },
  stalling: { label: "Stalling", icon: Warehouse, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  transport: { label: "Transport", icon: Truck, color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" },
  reiniging: { label: "Reiniging", icon: Sparkles, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  diensten: { label: "Diensten", icon: Hammer, color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" },
  materiaal: { label: "Materiaal", icon: Package, color: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400" },
  interieur: { label: "Interieur", icon: Home, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
};

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
  defaultMarkup?: number;
}

export function PartsClient({ parts, suppliers, defaultMarkup = 25 }: PartsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "low_stock" | "out_of_stock">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of parts) {
      const cat = p.category ?? "diensten";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [parts]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (activeCategory && (p.category ?? "diensten") !== activeCategory) return false;
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

  function handleDelete(part: Part) {
    if (!confirm(`Delete "${part.name}"?`)) return;
    startTransition(async () => {
      await deletePart(part.id);
      router.refresh();
    });
  }

  const lowStockCount = parts.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel).length;
  const outOfStockCount = parts.filter((p) => p.minStockLevel > 0 && p.stockQuantity <= 0).length;

  return (
    <div className="space-y-4">
      {/* Category filter buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all hover:shadow-md active:scale-95 cursor-pointer ring-1 ring-border/50",
            !activeCategory ? "bg-primary text-primary-foreground ring-primary shadow-md" : "bg-card hover:bg-muted/60"
          )}
        >
          All
          <span className="font-bold tabular-nums">{parts.length}</span>
        </button>
        {Object.entries(PART_CATEGORIES).map(([key, { label, icon: Icon, color }]) => {
          const cnt = categoryCounts[key] ?? 0;
          if (cnt === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(activeCategory === key ? null : key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all hover:shadow-md active:scale-95 cursor-pointer ring-1",
                activeCategory === key ? `${color} ring-2 shadow-md` : `ring-border/50 bg-card hover:bg-muted/60`
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span className="font-bold tabular-nums">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Search + stock filter + add button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search parts..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <div className="flex gap-1.5">
              {outOfStockCount > 0 && (
                <button
                  onClick={() => setStockFilter(stockFilter === "out_of_stock" ? "all" : "out_of_stock")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                    stockFilter === "out_of_stock"
                      ? "bg-red-600 text-white"
                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 hover:bg-red-200"
                  )}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Out of Stock ({outOfStockCount})
                </button>
              )}
              {lowStockCount > 0 && (
                <button
                  onClick={() => setStockFilter(stockFilter === "low_stock" ? "all" : "low_stock")}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                    stockFilter === "low_stock"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 hover:bg-amber-200"
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
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Part
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPart ? "Edit Part" : "Add Part"}</DialogTitle>
            </DialogHeader>
            <PartForm
              part={editingPart}
              suppliers={suppliers}
              defaultMarkup={defaultMarkup}
              onDone={() => {
                setDialogOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} part{filtered.length !== 1 ? "s" : ""}
        {activeCategory ? ` in ${PART_CATEGORIES[activeCategory]?.label ?? activeCategory}` : ""}
        {search ? ` matching "${search}"` : ""}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search || activeCategory ? "No parts match your filters." : "No parts in catalog yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Our Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="hidden lg:table-cell">Order</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((part) => {
                const cat = PART_CATEGORIES[part.category ?? "diensten"];
                const CatIcon = cat?.icon ?? Package;
                const markup = part.markupPercent ? parseFloat(part.markupPercent) : defaultMarkup;
                const cost = part.defaultCost ? parseFloat(part.defaultCost) : null;
                const ourPrice = cost !== null ? cost * (1 + markup / 100) : null;
                const isLowStock = part.stockQuantity > 0 && part.stockQuantity <= part.minStockLevel;
                const isOutOfStock = part.minStockLevel > 0 && part.stockQuantity <= 0;
                return (
                <TableRow key={part.id}>
                  <TableCell>
                    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", cat?.color ?? "bg-gray-100 text-gray-600")}>
                      <CatIcon className="h-3.5 w-3.5" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{part.name}</p>
                    {part.description && (
                      <p className="text-[11px] text-muted-foreground truncate max-w-xs">{part.description}</p>
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
                        isOutOfStock ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" :
                        isLowStock ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" :
                        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                      )}>
                        {isOutOfStock || isLowStock ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                        {part.stockQuantity}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {part.orderUrl ? (
                      <a
                        href={part.orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(part)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
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
      )}
    </div>
  );
}

function PartForm({
  part,
  suppliers,
  defaultMarkup,
  onDone,
}: {
  part: Part | null;
  suppliers: Supplier[];
  defaultMarkup: number;
  onDone: () => void;
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

  const effectiveMarkup = markupPercent ? parseFloat(markupPercent) : defaultMarkup;
  const cost = defaultCost ? parseFloat(defaultCost) : NaN;
  const ourPrice = !isNaN(cost) ? cost * (1 + effectiveMarkup / 100) : NaN;

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Window Seal 60cm" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="partNumber">Part Number</Label>
          <Input id="partNumber" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g. WS-060" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {Object.entries(PART_CATEGORIES).map(([key, { label, icon: Icon }]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cost">Part Cost (€)</Label>
          <Input id="cost" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} placeholder="0.00" type="number" step="0.01" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="markup">Markup %</Label>
          <Input
            id="markup"
            value={markupPercent}
            onChange={(e) => setMarkupPercent(e.target.value)}
            placeholder={`${defaultMarkup}% (default)`}
            type="number"
            step="1"
            min="0"
          />
        </div>
      </div>
      {!isNaN(ourPrice) && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">Our Price: €{ourPrice.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">({effectiveMarkup}% markup)</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stock">Stock Quantity</Label>
          <Input id="stock" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} type="number" min="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStock">Min. Stock Level</Label>
          <Input id="minStock" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} type="number" min="0" placeholder="0 = no tracking" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="supplier">Supplier</Label>
        <SearchableSelect
          options={supplierOptions}
          value={supplierId}
          onValueChange={setSupplierId}
          placeholder="Type to search suppliers..."
          emptyLabel="No supplier"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="orderUrl">Order URL</Label>
        <Input id="orderUrl" value={orderUrl} onChange={(e) => setOrderUrl(e.target.value)} placeholder="https://supplier.com/product/..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Saving..." : part ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
