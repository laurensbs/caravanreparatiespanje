"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { STATUS_LABELS, PRIORITY_LABELS, INVOICE_STATUS_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairFilters } from "@/actions/repairs";
import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";

interface Location {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface RepairFiltersBarProps {
  locations: Location[];
  currentFilters: RepairFilters;
  allTags?: TagItem[];
}

export function RepairFiltersBar({ locations, currentFilters, allTags = [] }: RepairFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentFilters.q ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  // Count how many secondary filters are active
  const secondaryFilterKeys = ["locationId", "invoiceStatus", "customerResponseStatus", "tagId", "dateFrom", "dateTo"] as const;
  const activeSecondaryCount = secondaryFilterKeys.filter(k => currentFilters[k]).length;
  const [showMore, setShowMore] = useState(activeSecondaryCount > 0);

  return (
    <div className="space-y-3">
      {/* Primary filters — always visible */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-0 sm:max-w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search repairs..."
              className="w-full pl-9 h-10 text-sm rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card focus:bg-white dark:focus:bg-card placeholder:text-gray-400 dark:placeholder:text-muted-foreground"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

        <Select
          value={currentFilters.status ?? "all"}
          onValueChange={(val) => updateFilter("status", val)}
        >
          <SelectTrigger className="w-36 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.priority ?? "all"}
          onValueChange={(val) => updateFilter("priority", val)}
        >
          <SelectTrigger className="w-28 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={showMore ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="h-10 text-xs rounded-xl gap-1.5"
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters
          {activeSecondaryCount > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
              {activeSecondaryCount}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-xs rounded-xl text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground">
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Secondary filters — collapsible */}
      {showMore && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center pt-3 border-t border-gray-100 dark:border-border">
          <Select
            value={currentFilters.locationId ?? "all"}
            onValueChange={(val) => updateFilter("locationId", val)}
          >
            <SelectTrigger className="w-36 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.invoiceStatus ?? "all"}
            onValueChange={(val) => updateFilter("invoiceStatus", val)}
          >
            <SelectTrigger className="w-36 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
              <SelectValue placeholder="Invoice" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All invoices</SelectItem>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={currentFilters.customerResponseStatus ?? "all"}
            onValueChange={(val) => updateFilter("customerResponseStatus", val)}
          >
            <SelectTrigger className="w-40 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
              <SelectValue placeholder="Response" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All responses</SelectItem>
              {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {allTags.length > 0 && (
            <Select
              value={currentFilters.tagId ?? "all"}
              onValueChange={(val) => updateFilter("tagId", val)}
            >
              <SelectTrigger className="w-36 h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card">
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
            className="w-[130px] h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card"
            value={currentFilters.dateFrom ?? ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
            placeholder="From"
          />
          <Input
            type="date"
            className="w-[130px] h-10 text-xs rounded-xl border-gray-200 dark:border-border bg-white dark:bg-card"
            value={currentFilters.dateTo ?? ""}
            onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
}
