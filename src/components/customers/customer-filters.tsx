"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
}

export function CustomerFiltersBar({ locations, currentFilters }: CustomerFiltersBarProps) {
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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <div className="relative flex-1 min-w-0 sm:max-w-64">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          className="pl-9 pr-8"
          value={searchInput}
          onChange={handleSearchChange}
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => { setSearchInput(""); updateFilter("q", undefined); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select
        value={currentFilters.repairStatus ?? "all"}
        onValueChange={(val) => updateFilter("repairStatus", val)}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Repair status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All customers</SelectItem>
          {Object.entries(REPAIR_STATUS_OPTIONS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentFilters.locationId ?? "all"}
        onValueChange={(val) => updateFilter("locationId", val)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
