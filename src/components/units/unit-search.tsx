"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Truck, X, Plus } from "lucide-react";
import { createUnitInline } from "@/actions/units";
import { toast } from "sonner";

interface Unit {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  customerId: string | null;
}

interface UnitSearchProps {
  units: Unit[];
  value?: string;
  customerId?: string | null;
  onSelect: (unitId: string | null) => void;
}

export function UnitSearch({ units, value, customerId, onSelect }: UnitSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function unitLabel(u: { registration?: string | null; brand?: string | null; model?: string | null }) {
    const parts = [];
    if (u.registration) parts.push(u.registration);
    if (u.brand || u.model) parts.push([u.brand, u.model].filter(Boolean).join(" "));
    return parts.join(" · ") || "Unknown unit";
  }

  useEffect(() => {
    if (value) {
      const u = units.find((u) => u.id === value);
      if (u) setSelectedLabel(unitLabel(u));
    } else {
      setSelectedLabel("");
    }
  }, [value, units]);

  // Auto-open when customer is selected and no unit chosen yet
  useEffect(() => {
    if (customerId && !value) {
      setOpen(true);
      setShowCreate(false);
    }
  }, [customerId, value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Units belonging to the selected customer (owned + unassigned)
  const customerUnits = customerId
    ? units.filter((u) => u.customerId === customerId)
    : [];

  // Filter: prefer units belonging to selected customer, then match on text
  const available = customerId
    ? units.filter((u) => u.customerId === customerId || !u.customerId)
    : units;

  const filtered = query.length >= 1
    ? available
        .filter((u) => {
          const q = query.toLowerCase();
          return (
            u.registration?.toLowerCase().includes(q) ||
            u.brand?.toLowerCase().includes(q) ||
            u.model?.toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : customerId
      ? customerUnits.slice(0, 8)
      : [];

  function handleSelect(unit: Unit) {
    setSelectedLabel(unitLabel(unit));
    setQuery("");
    setOpen(false);
    setShowCreate(false);
    onSelect(unit.id);
  }

  function handleClear() {
    setSelectedLabel("");
    setQuery("");
    onSelect(null);
    inputRef.current?.focus();
  }

  const createFormRef = useRef<HTMLDivElement>(null);

  async function handleCreateUnit() {
    setCreating(true);
    const container = createFormRef.current;
    if (!container) return;
    const get = (name: string) => (container.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value || "";
    try {
      const unit = await createUnitInline({
        registration: get("registration") || undefined,
        brand: get("brand") || undefined,
        model: get("model") || undefined,
        year: get("year") ? Number(get("year")) : undefined,
        customerId: customerId || undefined,
      });
      units.push({
        id: unit.id,
        registration: unit.registration,
        brand: unit.brand,
        model: unit.model,
        year: unit.year,
        customerId: unit.customerId,
      });
      handleSelect({
        id: unit.id,
        registration: unit.registration,
        brand: unit.brand,
        model: unit.model,
        year: unit.year,
        customerId: unit.customerId,
      });
      toast.success("Unit created");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create unit");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selectedLabel ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{selectedLabel}</span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Input
          ref={inputRef}
          type="text"
          placeholder={customerId ? "Select or search unit..." : "Search license plate, brand, model..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setShowCreate(false);
          }}
          onFocus={() => { if (query.length >= 1 || customerId) setOpen(true); }}
        />
      )}

      {open && !showCreate && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg animate-fade-in">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{unitLabel(u)}</span>
              {u.year && <span className="text-[11px] text-muted-foreground ml-auto">{u.year}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-muted transition-colors text-left border-t"
          >
            <Plus className="h-3.5 w-3.5" />
            New unit...
          </button>
        </div>
      )}

      {open && !showCreate && (query.length >= 1 || customerId) && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg animate-fade-in">
          <div className="px-3 py-2 text-sm text-muted-foreground">{customerId ? "No units linked to this customer" : "No units found"}</div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-muted transition-colors text-left border-t"
          >
            <Plus className="h-3.5 w-3.5" />
            Create new unit...
          </button>
        </div>
      )}

      {showCreate && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg p-3 animate-fade-in">
          <p className="text-xs font-semibold mb-2">Quick add unit</p>
          <div ref={createFormRef} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">License Plate</Label>
                <Input name="registration" defaultValue={query} className="h-8 text-xs mt-0.5" autoFocus />
              </div>
              <div>
                <Label className="text-[11px]">Year</Label>
                <Input name="year" type="number" min="1900" max="2100" className="h-8 text-xs mt-0.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Brand</Label>
                <Input name="brand" className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[11px]">Model</Label>
                <Input name="model" className="h-8 text-xs mt-0.5" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" disabled={creating} onClick={handleCreateUnit}>
                {creating ? <Spinner className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
