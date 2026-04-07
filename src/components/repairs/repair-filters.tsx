"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { STATUS_LABELS, PRIORITY_LABELS, INVOICE_STATUS_LABELS, CUSTOMER_RESPONSE_LABELS } from "@/types";
import type { RepairFilters } from "@/actions/repairs";
import { useState, useRef } from "react";

interface Location {
  id: string;
  name: string;
}

interface RepairFiltersBarProps {
  locations: Location[];
  currentFilters: RepairFilters;
}

export function RepairFiltersBar({ locations, currentFilters }: RepairFiltersBarProps) {
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

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-0 sm:max-w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-full pl-8 h-8 text-xs rounded-lg"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

        <Select
          value={currentFilters.status ?? "all"}
          onValueChange={(val) => updateFilter("status", val)}
        >
          <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
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
          <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentFilters.locationId ?? "all"}
          onValueChange={(val) => updateFilter("locationId", val)}
        >
          <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
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
          <SelectTrigger className="w-36 h-8 text-xs rounded-lg">
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
          <SelectTrigger className="w-40 h-8 text-xs rounded-lg">
            <SelectValue placeholder="Response" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All responses</SelectItem>
            {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs rounded-lg text-muted-foreground hover:text-foreground">
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
