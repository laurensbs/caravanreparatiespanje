"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Search, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CatalogPart {
  id: string;
  name: string;
  partNumber: string | null;
  defaultCost: string | null;
  orderUrl: string | null;
}

export interface SelectedPart {
  partId: string;
  name: string;
  partNumber: string | null;
  quantity: number;
}

interface PartsPickerProps {
  catalog: CatalogPart[];
  value: SelectedPart[];
  onChange: (parts: SelectedPart[]) => void;
}

export function PartsPicker({ catalog, value, onChange }: PartsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const selectedIds = new Set(value.map((p) => p.partId));
    return catalog
      .filter((p) => !selectedIds.has(p.id))
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.partNumber?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 20);
  }, [catalog, search, value]);

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

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="space-y-1.5">
          {value.map((part) => (
            <div
              key={part.partId}
              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
            >
              <span className="flex-1 truncate">
                {part.name}
                {part.partNumber && (
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    ({part.partNumber})
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded px-1 text-muted-foreground hover:text-foreground"
                  onClick={() => updateQuantity(part.partId, part.quantity - 1)}
                >
                  −
                </button>
                <span className="w-6 text-center text-xs font-medium">{part.quantity}</span>
                <button
                  type="button"
                  className="rounded px-1 text-muted-foreground hover:text-foreground"
                  onClick={() => updateQuantity(part.partId, part.quantity + 1)}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => removePart(part.partId)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start text-muted-foreground">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add part from catalog
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search parts..."
                className="h-8 pl-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                {catalog.length === 0 ? "No parts in catalog yet" : "No matching parts"}
              </p>
            ) : (
              filtered.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onClick={() => addPart(part)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{part.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[part.partNumber, part.defaultCost ? `€${part.defaultCost}` : null]
                        .filter(Boolean)
                        .join(" · ") || "No details"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
