"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUnits } from "@/actions/units";
import { WorkflowGuide } from "@/components/workflow-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Truck, Loader2 } from "lucide-react";
import { UnitDialog } from "./unit-dialog";
import { NewUnitDialog } from "./new-unit-dialog";

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface UnitRow {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  chassisId: string | null;
  length: string | null;
  storageLocation: string | null;
  storageType: string | null;
  currentPosition: string | null;
  nfcTag: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UnitsClientProps {
  units: UnitRow[];
  total: number;
  page: number;
  limit: number;
  currentQ?: string;
  currentTagId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  allTags: TagItem[];
  customers?: { id: string; name: string }[];
}

export function UnitsClient({ units: initialUnits, total, page, limit, currentQ, currentTagId, currentDateFrom, currentDateTo, allTags, customers = [] }: UnitsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentQ ?? "");
  const [selectedUnit, setSelectedUnit] = useState<UnitRow | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Infinite scroll state
  const [allUnits, setAllUnits] = useState<UnitRow[]>(initialUnits);
  const [scrollLoading, startScrollLoading] = useTransition();
  const [hasMore, setHasMore] = useState(initialUnits.length < total);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when initial data changes (filters changed)
  useEffect(() => {
    setAllUnits(initialUnits);
    pageRef.current = 1;
    setHasMore(initialUnits.length < total);
  }, [initialUnits, total]);

  const filters = { q: currentQ, tagId: currentTagId, dateFrom: currentDateFrom, dateTo: currentDateTo, limit };

  const loadMore = useCallback(() => {
    if (scrollLoading || !hasMore) return;
    startScrollLoading(async () => {
      const nextPage = pageRef.current + 1;
      const { units: more } = await getUnits({ ...filters, page: nextPage });
      setAllUnits(prev => {
        const existingIds = new Set(prev.map(u => u.id));
        const newUnits = (more as UnitRow[]).filter(u => !existingIds.has(u.id));
        return [...prev, ...newUnits];
      });
      pageRef.current = nextPage;
      const loaded = nextPage * (limit ?? 50);
      if (loaded >= total) setHasMore(false);
    });
  }, [scrollLoading, hasMore, filters, total, limit]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/units?${params.toString()}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchInput(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => updateParams({ q: q || undefined }), 300);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Units</h1>
          <p className="text-xs text-muted-foreground">
            {total} unit{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <NewUnitDialog customers={customers} />
      </div>

      <WorkflowGuide page="units" />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search license plate, brand, model..."
              className="w-full pl-8 h-8 text-xs rounded-lg"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

        {allTags.length > 0 && (
          <Select
            value={currentTagId ?? "all"}
            onValueChange={(v) => updateParams({ tagId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    {tag.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />}
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          type="date"
          className="w-[130px] h-8 text-xs rounded-lg"
          value={currentDateFrom ?? ""}
          onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
          placeholder="From"
        />
        <Input
          type="date"
          className="w-[130px] h-8 text-xs rounded-lg"
          value={currentDateTo ?? ""}
          onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
          placeholder="To"
        />

        {(currentQ || currentTagId || currentDateFrom || currentDateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.push("/units");
            }}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card">
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          {allUnits.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Truck className="h-8 w-8 opacity-20" />
                <p className="font-medium text-sm">No units found</p>
                <p className="text-xs">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {allUnits.map((u, idx) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40 cursor-pointer animate-slide-up"
                  style={{ animationDelay: `${idx * 20}ms`, animationFillMode: "backwards" }}
                  onClick={() => setSelectedUnit(u)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm font-medium group-hover:text-primary transition-colors">
                      {u.registration ?? "—"}
                    </span>
                    {u.brand && (
                      <span className="text-xs text-muted-foreground">
                        {u.brand}{u.model ? ` ${u.model}` : ""}{u.year ? ` (${u.year})` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-4">{u.customerName ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            {scrollLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
        )}
        {!hasMore && allUnits.length > 0 && (
          <p className="text-center text-[11px] text-gray-400 py-3">
            {allUnits.length} unit{allUnits.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Unit detail popup */}
      {selectedUnit && (
        <UnitDialog
          unit={selectedUnit}
          open={!!selectedUnit}
          onOpenChange={(open) => { if (!open) setSelectedUnit(null); }}
          allTags={allTags}
        />
      )}
    </div>
  );
}
