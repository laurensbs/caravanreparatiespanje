"use client";

import { useState, useRef, useCallback, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUnits } from "@/actions/units";
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
import { UnitTypeIconBadge } from "./unit-type-icon";
import { UNIT_TYPE_LABELS } from "@/types";
import type { UnitType } from "@/types";
import { DashboardPageCanvas, DashboardPageHeader } from "@/components/layout/dashboard-surface";

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
  unitType: string | null;
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

  function unitTypeLabel(raw: string | null | undefined): string {
    if (raw === "caravan" || raw === "trailer" || raw === "camper" || raw === "unknown") {
      return UNIT_TYPE_LABELS[raw as UnitType];
    }
    return UNIT_TYPE_LABELS.unknown;
  }

  return (
    <DashboardPageCanvas>
    <div className="space-y-5 sm:space-y-8">
      <DashboardPageHeader
        eyebrow="Fleet"
        title="Units"
        metadata={
          <>
            <span className="tabular-nums">{total}</span>
            <span>unit{total !== 1 ? "s" : ""} registered</span>
          </>
        }
        description={
          <>Icons show vehicle type (caravan, trailer, camper). The same unit is linked from work orders, planning, and the garage.</>
        }
        actions={<NewUnitDialog customers={customers} />}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search license plate, brand, model…"
              className="h-11 w-full touch-manipulation rounded-xl border-border bg-background pl-10 pr-3 text-sm"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

        {allTags.length > 0 && (
          <Select
            value={currentTagId ?? "all"}
            onValueChange={(v) => updateParams({ tagId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl border-border bg-background text-sm lg:w-48">
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

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <Input
            type="date"
            className="h-11 min-w-0 touch-manipulation rounded-xl border-border bg-background text-sm sm:w-[9.5rem]"
            value={currentDateFrom ?? ""}
            onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
            aria-label="Registered from"
          />
          <Input
            type="date"
            className="h-11 min-w-0 touch-manipulation rounded-xl border-border bg-background text-sm sm:w-[9.5rem]"
            value={currentDateTo ?? ""}
            onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
            aria-label="Registered to"
          />
        </div>

        {(currentQ || currentTagId || currentDateFrom || currentDateTo) && (
          <Button
            type="button"
            variant="outline"
            className="h-11 touch-manipulation gap-2 sm:h-10"
            onClick={() => {
              setSearchInput("");
              router.push("/units");
            }}
          >
            <X className="h-4 w-4" /> Clear filters
          </Button>
        )}
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
        <div className="max-h-[min(70vh,calc(100vh-14rem))] overflow-y-auto overscroll-contain sm:max-h-[calc(100vh-16rem)]">
          {allUnits.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Truck className="h-8 w-8 opacity-20" />
                <p className="font-medium text-sm">No units found</p>
                <p className="text-xs">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {allUnits.map((u, idx) => (
                <div
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer touch-manipulation flex-col gap-3 px-4 py-4 transition-colors animate-slide-up hover:bg-muted/45 active:bg-muted/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3.5"
                  style={{ animationDelay: `${idx * 20}ms`, animationFillMode: "backwards" }}
                  onClick={() => setSelectedUnit(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedUnit(u);
                    }
                  }}
                >
                  <div className="flex min-w-0 gap-3 sm:flex-1 sm:items-center">
                    <UnitTypeIconBadge unitType={u.unitType} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
                          {u.registration ?? "—"}
                        </span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                          {unitTypeLabel(u.unitType)}
                        </span>
                      </div>
                      {(u.brand || u.model || u.year) && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                          {[u.brand, u.model].filter(Boolean).join(" ")}
                          {u.year ? ` · ${u.year}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 justify-end border-t border-border/50 pt-2 sm:border-0 sm:pt-0 sm:pl-2">
                    <span className="truncate text-right text-sm text-muted-foreground sm:max-w-[14rem] lg:max-w-[22rem]">
                      {u.customerName ?? <span className="text-muted-foreground/50">No owner</span>}
                    </span>
                  </div>
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
    </DashboardPageCanvas>
  );
}
