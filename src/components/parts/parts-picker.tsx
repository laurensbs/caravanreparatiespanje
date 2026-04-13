"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { X, Plus, Search, Package } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ICON_MAP, type PartCategory } from "@/components/parts/parts-client";
import { createPart } from "@/actions/parts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CatalogPart {
  id: string;
  name: string;
  partNumber: string | null;
  defaultCost: string | null;
  orderUrl: string | null;
  category: string | null;
}

export interface SelectedPart {
  partId: string;
  name: string;
  partNumber: string | null;
  quantity: number;
}

interface PartsPickerProps {
  catalog: CatalogPart[];
  categories?: PartCategory[];
  value: SelectedPart[];
  onChange: (parts: SelectedPart[]) => void;
}

export function PartsPicker({ catalog, categories = [], value, onChange }: PartsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const selectedIds = new Set(value.map((p) => p.partId));
    return catalog
      .filter((p) => !selectedIds.has(p.id))
      .filter((p) => {
        if (activeCategory && (p.category ?? "services") !== activeCategory) return false;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.partNumber?.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 20);
  }, [catalog, search, value, activeCategory]);

  function addPart(part: CatalogPart) {
    onChange([
      ...value,
      { partId: part.id, name: part.name, partNumber: part.partNumber, quantity: 1 },
    ]);
    setSearch("");
    setOpen(false);
  }

  function removePart(partId: string) {
    onChange(value.filter((p) => p.partId !== partId));
  }

  function updateQuantity(partId: string, quantity: number) {
    if (quantity < 1) return;
    onChange(value.map((p) => (p.partId === partId ? { ...p, quantity } : p)));
  }

  async function handleCreatePart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      const part = await createPart({
        name: fd.get("name") as string,
        partNumber: (fd.get("partNumber") as string) || undefined,
        defaultCost: (fd.get("defaultCost") as string) || undefined,
        category: (fd.get("category") as string) || undefined,
      });
      catalog.push({
        id: part.id,
        name: part.name,
        partNumber: part.partNumber,
        defaultCost: part.defaultCost,
        orderUrl: null,
        category: part.category,
      });
      onChange([
        ...value,
        { partId: part.id, name: part.name, partNumber: part.partNumber, quantity: 1 },
      ]);
      setShowCreate(false);
      setSearch("");
      setOpen(false);
      toast.success(`Part "${part.name}" created & added`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create part");
    } finally {
      setCreating(false);
    }
  }

  // Build category lookup
  const categoryMap = useMemo(() => {
    const m: Record<string, { label: string; icon: React.ElementType; color: string }> = {};
    for (const cat of categories) {
      m[cat.key] = { label: cat.label, icon: ICON_MAP[cat.icon] ?? Package, color: cat.color };
    }
    return m;
  }, [categories]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((part) => (
            <div
              key={part.partId}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm"
            >
              <span className="flex-1 truncate text-gray-700">
                {part.name}
                {part.partNumber && (
                  <span className="ml-1.5 font-mono text-xs text-gray-400">
                    ({part.partNumber})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-1 text-gray-400 hover:text-gray-700"
                  onClick={() => updateQuantity(part.partId, part.quantity - 1)}
                >
                  −
                </button>
                <span className="w-6 text-center text-xs font-medium text-gray-600">{part.quantity}</span>
                <button
                  type="button"
                  className="rounded px-1 text-gray-400 hover:text-gray-700"
                  onClick={() => updateQuantity(part.partId, part.quantity + 1)}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removePart(part.partId)}
                className="text-gray-300 hover:text-red-400 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start text-gray-400">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add part from catalog
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="p-2.5 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search parts..."
                className="h-8 pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                    !activeCategory
                      ? "bg-gray-900 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100",
                  )}
                >
                  All
                </button>
                {categories.filter(c => c.active).map((cat) => {
                  const Icon = ICON_MAP[cat.icon] ?? Package;
                  const isActive = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setActiveCategory(isActive ? null : cat.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-gray-900 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {showCreate ? (
              <div className="p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900">New part</p>
                <form onSubmit={handleCreatePart} className="space-y-2">
                  <div>
                    <Label className="text-xs text-gray-500">Name *</Label>
                    <Input name="name" required defaultValue={search} className="h-8 text-sm mt-0.5" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Part number</Label>
                      <Input name="partNumber" className="h-8 text-sm mt-0.5" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Cost (€)</Label>
                      <Input name="defaultCost" type="number" step="0.01" className="h-8 text-sm mt-0.5" />
                    </div>
                  </div>
                  {categories.length > 0 && (
                    <div>
                      <Label className="text-xs text-gray-500">Category</Label>
                      <select
                        name="category"
                        defaultValue={activeCategory ?? ""}
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">No category</option>
                        {categories.filter(c => c.active).map((cat) => (
                          <option key={cat.key} value={cat.key}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="h-7 text-xs" disabled={creating}>
                      {creating ? <Spinner className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
                      Create & Add
                    </Button>
                  </div>
                </form>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-3">
                <p className="text-center text-xs text-gray-400 mb-2">
                  {catalog.length === 0 ? "No parts in catalog yet" : "No matching parts"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Create &quot;{search || "new part"}&quot;
                </Button>
              </div>
            ) : (
              <>
                {filtered.map((part) => {
                  const catInfo = part.category ? categoryMap[part.category] : null;
                  const CatIcon = catInfo?.icon ?? null;
                  return (
                    <button
                      key={part.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                      onClick={() => addPart(part)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-gray-900">{part.name}</p>
                        <p className="text-xs text-gray-400">
                          {[
                            part.partNumber,
                            part.defaultCost ? `€${part.defaultCost}` : null,
                            catInfo ? catInfo.label : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No details"}
                        </p>
                      </div>
                      {CatIcon && (
                        <CatIcon className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#0CC0DF] hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New part...
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
