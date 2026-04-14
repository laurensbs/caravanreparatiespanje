"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { STATUS_LABELS, PRIORITY_LABELS, INVOICE_STATUS_LABELS, CUSTOMER_RESPONSE_LABELS, JOB_TYPE_LABELS } from "@/types";
import type { RepairStatus, JobType } from "@/types";
import type { RepairFilters } from "@/actions/repairs";
import { useState, useRef, useMemo } from "react";

interface Location {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface DatasetFacets {
  invoiceStatuses: string[];
  responseStatuses: string[];
  priorities: string[];
  locationIds: string[];
  tagIds: string[];
  hasDateVariation: boolean;
}

interface RepairFiltersBarProps {
  locations: Location[];
  currentFilters: RepairFilters;
  allTags?: TagItem[];
  datasetFacets?: DatasetFacets;
}

export function RepairFiltersBar({ locations, currentFilters, allTags = [], datasetFacets }: RepairFiltersBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentFilters.q ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [panelOpen, setPanelOpen] = useState(false);

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

  function removeFilter(key: string) {
    updateFilter(key, undefined);
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

  // Advanced filter keys (everything inside the panel)
  const advancedFilterKeys = ["priority", "locationId", "invoiceStatus", "customerResponseStatus", "tagId", "dateFrom", "dateTo"] as const;
  const advancedCount = advancedFilterKeys.filter(k => currentFilters[k]).length;

  // Context-aware filter relevance — hide filters with no variation in dataset
  const filterRelevance = useMemo(() => {
    if (!datasetFacets) return { priority: true, location: true, invoice: true, response: true, tags: true, date: true };
    return {
      priority: datasetFacets.priorities.length > 1 || !!currentFilters.priority,
      location: datasetFacets.locationIds.length > 1 || !!currentFilters.locationId,
      invoice: datasetFacets.invoiceStatuses.length > 1 || !!currentFilters.invoiceStatus,
      response: datasetFacets.responseStatuses.length > 1 || !!currentFilters.customerResponseStatus,
      tags: (datasetFacets.tagIds.length > 0 && allTags.length > 0) || !!currentFilters.tagId,
      date: datasetFacets.hasDateVariation || !!currentFilters.dateFrom || !!currentFilters.dateTo,
    };
  }, [datasetFacets, currentFilters, allTags]);

  // Build active filter pills
  const activePills = useMemo(() => {
    const pills: { key: string; label: string; value: string }[] = [];

    if (currentFilters.status) {
      pills.push({ key: "status", label: "Status", value: STATUS_LABELS[currentFilters.status as RepairStatus] ?? currentFilters.status });
    }
    if (currentFilters.jobType) {
      pills.push({ key: "jobType", label: "Type", value: JOB_TYPE_LABELS[currentFilters.jobType as JobType] ?? currentFilters.jobType });
    }
    if (currentFilters.priority) {
      pills.push({ key: "priority", label: "Priority", value: PRIORITY_LABELS[currentFilters.priority as keyof typeof PRIORITY_LABELS] ?? currentFilters.priority });
    }
    if (currentFilters.locationId) {
      const loc = locations.find(l => l.id === currentFilters.locationId);
      pills.push({ key: "locationId", label: "Location", value: loc?.name ?? "Selected" });
    }
    if (currentFilters.invoiceStatus) {
      pills.push({ key: "invoiceStatus", label: "Invoice", value: INVOICE_STATUS_LABELS[currentFilters.invoiceStatus as keyof typeof INVOICE_STATUS_LABELS] ?? currentFilters.invoiceStatus });
    }
    if (currentFilters.customerResponseStatus) {
      pills.push({ key: "customerResponseStatus", label: "Response", value: CUSTOMER_RESPONSE_LABELS[currentFilters.customerResponseStatus as keyof typeof CUSTOMER_RESPONSE_LABELS] ?? currentFilters.customerResponseStatus });
    }
    if (currentFilters.tagId) {
      const tag = allTags.find(t => t.id === currentFilters.tagId);
      pills.push({ key: "tagId", label: "Tag", value: tag?.name ?? "Selected" });
    }
    if (currentFilters.dateFrom || currentFilters.dateTo) {
      const from = currentFilters.dateFrom ? new Date(currentFilters.dateFrom).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
      const to = currentFilters.dateTo ? new Date(currentFilters.dateTo).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
      const val = from && to ? `${from} – ${to}` : from ? `From ${from}` : `Until ${to}`;
      // We'll use dateFrom as the key, clearing both
      pills.push({ key: "dateRange", label: "Date", value: val });
    }
    if (currentFilters.q) {
      pills.push({ key: "q", label: "Search", value: `"${currentFilters.q}"` });
    }
    return pills;
  }, [currentFilters, locations, allTags]);

  function removePill(key: string) {
    if (key === "dateRange") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("dateFrom");
      params.delete("dateTo");
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    } else if (key === "q") {
      setSearchInput("");
      removeFilter("q");
    } else {
      removeFilter(key);
    }
  }

  return (
    <div className="space-y-3">
      {/* Layer 1: Quick filter bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {/* Search — visually dominant */}
        <div className="relative flex-1 min-w-0 sm:max-w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
          <Input
            placeholder="Search work orders..."
            className="w-full pl-10 pr-4 h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-[#0CC0DF]/40 focus:border-[#0CC0DF]/40 shadow-none"
            value={searchInput}
            onChange={handleSearchChange}
          />
        </div>

        {/* Status */}
        <Select
          value={currentFilters.status ?? "all"}
          onValueChange={(val) => updateFilter("status", val)}
        >
          <SelectTrigger className="w-[140px] h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type */}
        <Select
          value={currentFilters.jobType ?? "all"}
          onValueChange={(val) => updateFilter("jobType", val)}
        >
          <SelectTrigger className="w-[130px] h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filters button → opens advanced panel */}
        <Popover open={panelOpen} onOpenChange={setPanelOpen}>
          <PopoverTrigger asChild>
            <button
              className={`inline-flex items-center gap-2 h-11 px-4 text-sm font-medium rounded-xl border transition-all duration-150 whitespace-nowrap ${
                advancedCount > 0
                  ? "border-[#0CC0DF]/30 bg-[#0CC0DF]/5 text-gray-900 dark:text-slate-100 dark:border-[#0CC0DF]/20 dark:bg-[#0CC0DF]/10"
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {advancedCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[11px] font-semibold rounded-full bg-[#0CC0DF] text-white">
                  {advancedCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={10}
            className="w-[720px] rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#0F172A] shadow-xl dark:shadow-black/50 p-0 z-40"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/[0.06]">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-slate-100 tracking-tight">Advanced Filters</h3>
              {advancedCount > 0 && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    for (const key of advancedFilterKeys) params.delete(key);
                    params.delete("page");
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                >
                  Reset filters
                </button>
              )}
            </div>

            {/* Panel body */}
            <div className="px-6 pb-6 pt-5 space-y-6">
              {/* Row 1: Priority + Location (always show) */}
              {(filterRelevance.priority || filterRelevance.location) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filterRelevance.priority && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Priority</Label>
                  <Select
                    value={currentFilters.priority ?? "all"}
                    onValueChange={(val) => updateFilter("priority", val)}
                  >
                    <SelectTrigger className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All priorities</SelectItem>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
                {filterRelevance.location && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Location</Label>
                  <Select
                    value={currentFilters.locationId ?? "all"}
                    onValueChange={(val) => updateFilter("locationId", val)}
                  >
                    <SelectTrigger className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All locations</SelectItem>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
              </div>
              )}

              {/* Row 2: Invoice + Response */}
              {(filterRelevance.invoice || filterRelevance.response) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filterRelevance.invoice && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Invoice</Label>
                  <Select
                    value={currentFilters.invoiceStatus ?? "all"}
                    onValueChange={(val) => updateFilter("invoiceStatus", val)}
                  >
                    <SelectTrigger className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
                      <SelectValue placeholder="All invoices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All invoices</SelectItem>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
                {filterRelevance.response && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Response</Label>
                  <Select
                    value={currentFilters.customerResponseStatus ?? "all"}
                    onValueChange={(val) => updateFilter("customerResponseStatus", val)}
                  >
                    <SelectTrigger className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
                      <SelectValue placeholder="All responses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All responses</SelectItem>
                      {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
              </div>
              )}

              {/* Row 3: Tags + Date range */}
              {(filterRelevance.tags || filterRelevance.date) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filterRelevance.tags && allTags.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Tag</Label>
                    <Select
                      value={currentFilters.tagId ?? "all"}
                      onValueChange={(val) => updateFilter("tagId", val)}
                    >
                      <SelectTrigger className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none">
                        <SelectValue placeholder="All tags" />
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
                  </div>
                )}
                {filterRelevance.date && (
                <div className={(filterRelevance.tags && allTags.length > 0) ? "space-y-1.5" : "sm:col-span-2 space-y-1.5"}>
                  <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Date range</Label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">From</span>
                      <Input
                        type="date"
                        className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none"
                        value={currentFilters.dateFrom ?? ""}
                        onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
                      />
                    </div>
                    <span className="hidden sm:block text-gray-300 dark:text-slate-600 text-xs mt-5">–</span>
                    <div className="flex-1 space-y-1">
                      <span className="text-[11px] text-gray-400 dark:text-slate-500">To</span>
                      <Input
                        type="date"
                        className="w-full h-11 text-sm rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-gray-700 dark:text-slate-200 shadow-none"
                        value={currentFilters.dateTo ?? ""}
                        onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
                      />
                    </div>
                  </div>
                </div>
                )}
              </div>
              )}

              {/* All filters hidden hint */}
              {!filterRelevance.priority && !filterRelevance.location && !filterRelevance.invoice && !filterRelevance.response && !filterRelevance.tags && !filterRelevance.date && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No additional filters available for this selection.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter pills */}
      {activePills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activePills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => removePill(pill.key)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-slate-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-200 dark:hover:bg-white/[0.12] group"
            >
              <span className="text-gray-400 dark:text-slate-500">{pill.label}:</span>
              {pill.value}
              <X className="h-3 w-3 text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors" />
            </button>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors px-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
