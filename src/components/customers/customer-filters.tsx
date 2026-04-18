"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import type { CustomerFilters } from "@/actions/customers";

interface Location {
  id: string;
  name: string;
}

const REPAIR_STATUS_OPTIONS: Record<string, string> = {
  open: "Has Open Repairs",
  in_progress: "In Progress / Scheduled",
  waiting: "Waiting (Parts / Customer / Approval)",
  completed: "No Active Repairs",
  no_repairs: "No Repairs",
};

interface CustomerFiltersBarProps {
  locations: Location[];
  currentFilters: CustomerFilters;
  allTags?: { id: string; name: string; color: string | null }[];
}

export function CustomerFiltersBar({ locations, currentFilters, allTags = [] }: CustomerFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentFilters.q ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function updateFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchInput(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => updateFilter("q", q || undefined), 300);
  }

  function clearFilters() {
    setSearchInput("");
    router.push(pathname);
  }

  const hasActiveFilters = Object.entries(currentFilters).some(
    ([key, val]) => key !== "page" && key !== "limit" && val
  );

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            className="h-11 touch-manipulation rounded-xl border-border bg-background pl-9 pr-9 text-sm"
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); updateFilter("q", undefined); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={currentFilters.repairStatus ?? "all"}
          onValueChange={(val) => updateFilter("repairStatus", val)}
        >
          <SelectTrigger className="h-11 w-full min-w-0 touch-manipulation rounded-xl border-border bg-background text-sm lg:w-56">
            <SelectValue placeholder="Repair status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All contacts</SelectItem>
            {Object.entries(REPAIR_STATUS_OPTIONS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.locationId ?? "all"}
          onValueChange={(val) => updateFilter("locationId", val)}
        >
          <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl border-border bg-background text-sm lg:w-44">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {allTags.length > 0 && (
          <Select
            value={currentFilters.tagId ?? "all"}
            onValueChange={(val) => updateFilter("tagId", val)}
          >
            <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl border-border bg-background text-sm lg:w-44">
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
            value={currentFilters.dateFrom ?? ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
            aria-label="Updated from"
          />
          <Input
            type="date"
            className="h-11 min-w-0 touch-manipulation rounded-xl border-border bg-background text-sm sm:w-[9.5rem]"
            value={currentFilters.dateTo ?? ""}
            onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
            aria-label="Updated to"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground touch-manipulation lg:h-auto lg:justify-start lg:border-0 lg:px-0 lg:hover:bg-transparent"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
