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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-0 sm:max-w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search contacts..."
            className="pl-9 pr-8 h-10 rounded-xl bg-white border-gray-200 text-sm"
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); updateFilter("q", undefined); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={currentFilters.repairStatus ?? "all"}
          onValueChange={(val) => updateFilter("repairStatus", val)}
        >
          <SelectTrigger className="w-56 h-10 rounded-xl bg-white border-gray-200 text-sm text-gray-700">
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
          <SelectTrigger className="w-40 h-10 rounded-xl bg-white border-gray-200 text-sm text-gray-700">
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
            <SelectTrigger className="w-40 h-10 rounded-xl bg-white border-gray-200 text-sm text-gray-700">
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
          className="w-[140px] h-10 text-sm rounded-xl bg-white border-gray-200"
          value={currentFilters.dateFrom ?? ""}
          onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
          placeholder="From"
        />
        <Input
          type="date"
          className="w-[140px] h-10 text-sm rounded-xl bg-white border-gray-200"
          value={currentFilters.dateTo ?? ""}
          onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
          placeholder="To"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
