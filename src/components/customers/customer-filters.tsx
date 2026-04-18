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
  /** Kept for back-compat with the page; locations are no longer
   *  rendered as a filter — contacts aren't tied to a location. */
  locations?: Location[];
  currentFilters: CustomerFilters;
  allTags?: { id: string; name: string; color: string | null }[];
}

export function CustomerFiltersBar({ currentFilters, allTags = [] }: CustomerFiltersBarProps) {
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
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts by name, phone, email…"
          className="h-11 w-full touch-manipulation rounded-xl bg-card pl-9 pr-9 text-sm"
          value={searchInput}
          onChange={handleSearchChange}
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => { setSearchInput(""); updateFilter("q", undefined); }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Select
        value={currentFilters.repairStatus ?? "all"}
        onValueChange={(val) => updateFilter("repairStatus", val)}
      >
        <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl bg-card text-sm lg:w-56">
          <SelectValue placeholder="Filter by repairs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All — any repair status</SelectItem>
          {Object.entries(REPAIR_STATUS_OPTIONS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {allTags.length > 0 && (
        <Select
          value={currentFilters.tagId ?? "all"}
          onValueChange={(val) => updateFilter("tagId", val)}
        >
          <SelectTrigger className="h-11 w-full touch-manipulation rounded-xl bg-card text-sm lg:w-44">
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

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation lg:h-9"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
