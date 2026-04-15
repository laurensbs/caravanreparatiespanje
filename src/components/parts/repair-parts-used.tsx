"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import {
  Search,
  X,
  Loader2,
  Package,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  searchParts,
  createPartRequest,
  createPart,
  createPartCategory,
  updatePartRequest,
  updatePartRequestStatus,
  removePartRequest,
  suggestPartsForJob,
} from "@/actions/parts";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { ICON_MAP, type PartCategory } from "@/components/parts/parts-client";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type SearchResult = {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  stockQuantity: number | null;
  minStockLevel: number | null;
  supplierName: string | null;
  supplierId: string | null;
};

export interface PartRequestRow {
  id: string;
  partId: string | null;
  partName: string;
  partNumber: string | null;
  category: string | null;
  supplierName: string | null;
  supplierId: string | null;
  quantity: number;
  unitCost: string | null;
  totalCost: string | null;
  sellPrice: string | null;
  markupPercent: string | null;
  status: string;
  orderReference: string | null;
  expectedDelivery: Date | string | null;
  receivedDate: Date | string | null;
  notes: string | null;
  stockQuantity: number | null;
}

interface RepairPartsUsedProps {
  repairJobId: string;
  partRequests: PartRequestRow[];
  defaultMarkup: number;
  partCategories?: PartCategory[];
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function RepairPartsUsed({
  repairJobId,
  partRequests: initialRequests,
  defaultMarkup,
  partCategories = [],
}: RepairPartsUsedProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showPicker, setShowPicker] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewPart, setShowNewPart] = useState(false);
  const [newPartName, setNewPartName] = useState("");
  const [newPartCategory, setNewPartCategory] = useState<string | null>(null);
  const [showNewPartCategory, setShowNewPartCategory] = useState(false);
  const [newPartCategoryName, setNewPartCategoryName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const partRequests = initialRequests;
  const activeRequests = partRequests.filter((p) => p.status !== "cancelled");
  const receivedCount = partRequests.filter((p) => p.status === "received").length;
  const totalCount = activeRequests.length;

  // ── Position calculation ──
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // ── Load smart suggestions on first open ──
  useEffect(() => {
    if (showPicker && !suggestionsLoaded) {
      setSuggestionsLoaded(true);
      suggestPartsForJob(repairJobId).then(setSuggestions).catch(() => {});
    }
  }, [showPicker, suggestionsLoaded, repairJobId]);

  // ── Debounced server search ──
  useEffect(() => {
    if (query.length < 2 && !selectedCategory) {
      setResults([]);
      if (query.length === 0 && suggestions.length > 0) {
        setIsOpen(true);
      } else if (query.length === 0) {
        setIsOpen(false);
      }
      return;
    }

    setIsSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchParts(query, selectedCategory ?? undefined);
        setResults(data);
        setIsOpen(true);
        setHighlightIndex(-1);
        updatePosition();
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query, selectedCategory, updatePosition, suggestions.length]);

  // ── Reposition on scroll/resize ──
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => updatePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [isOpen, updatePosition]);

  // ── Close on outside click ──
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // ── Select catalog part ──
  function selectPart(part: SearchResult) {
    startTransition(async () => {
      try {
        const baseCost = part.defaultCost ? parseFloat(part.defaultCost) : 0;
        const markup = part.markupPercent
          ? parseFloat(part.markupPercent)
          : defaultMarkup;
        const sellPrice = baseCost > 0 ? baseCost * (1 + markup / 100) : 0;

        await createPartRequest({
          repairJobId,
          partId: part.id,
          partName: part.name,
          unitCost: baseCost > 0 ? String(baseCost) : undefined,
          sellPrice: sellPrice > 0 ? String(Math.round(sellPrice * 100) / 100) : undefined,
          markupPercent: markup > 0 ? String(markup) : undefined,
          supplierId: part.supplierId ?? undefined,
        });
        toast.success(`"${part.name}" added`);
        setQuery("");
        setResults([]);
        setIsOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to add part");
      }
    });
  }

  // ── Add custom part ──
  function addCustomPart() {
    if (!query.trim()) return;
    startTransition(async () => {
      try {
        await createPartRequest({
          repairJobId,
          partName: query.trim(),
        });
        toast.success(`"${query.trim()}" added as custom part`);
        setQuery("");
        setResults([]);
        setIsOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to add part");
      }
    });
  }

  // ── Add custom part to catalog too ──
  function addToCatalog() {
    if (!query.trim()) return;
    startTransition(async () => {
      try {
        const newPart = await createPart({
          name: query.trim(),
          stockQuantity: 0,
          minStockLevel: 0,
        });
        await createPartRequest({
          repairJobId,
          partId: newPart.id,
          partName: newPart.name,
        });
        toast.success(`"${newPart.name}" added to catalog & job`);
        setQuery("");
        setResults([]);
        setIsOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to add part");
      }
    });
  }

  // ── Keyboard nav ──
  function handleKeyDown(e: React.KeyboardEvent) {
    const totalItems =
      (query.length >= 2 ? results.length : suggestions.length) +
      (query.trim().length >= 2 ? 1 : 0); // +1 for custom option

    if (!isOpen && query.length >= 2) {
      if (e.key === "ArrowDown") {
        setIsOpen(true);
        updatePosition();
        return;
      }
    }
    if (!isOpen) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        addCustomPart();
      }
      if (e.key === "Escape") {
        setShowPicker(false);
        setQuery("");
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, totalItems - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const items = query.length >= 2 ? results : suggestions;
        if (highlightIndex >= 0 && highlightIndex < items.length) {
          selectPart(items[highlightIndex]);
        } else {
          addCustomPart();
        }
        break;
      }
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  // ── Update quantity ──
  function handleQuantityChange(id: string, delta: number) {
    const pr = partRequests.find((p) => p.id === id);
    if (!pr) return;
    const newQty = Math.max(1, pr.quantity + delta);
    startTransition(async () => {
      await updatePartRequest(id, { quantity: newQty });
      router.refresh();
    });
  }

  // ── Remove part request ──
  function handleRemove(id: string) {
    startTransition(async () => {
      await removePartRequest(id);
      router.refresh();
    });
  }

  // ── Status change ──
  function handleStatusChange(
    id: string,
    newStatus: "requested" | "ordered" | "shipped" | "received" | "cancelled"
  ) {
    startTransition(async () => {
      await updatePartRequestStatus(id, newStatus);
      router.refresh();
    });
  }

  // Which items to show in dropdown
  const displayItems = (query.length >= 2 || selectedCategory) ? results : suggestions;
  const showSuggestionsHeader = query.length < 2 && !selectedCategory && suggestions.length > 0;
  const showCustomOption = query.trim().length >= 2;

  // ── Portal dropdown ──
  const dropdown = isOpen && (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
    >
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden max-h-[360px] flex flex-col">
        {/* Loading */}
        {isSearching && results.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Searching parts…</span>
          </div>
        ) : displayItems.length === 0 && !isSearching && query.length >= 2 ? (
          /* No results */
          <div className="py-6 px-4 text-center">
            <Package className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No parts found
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Try another name or add as custom part
            </p>
          </div>
        ) : displayItems.length > 0 ? (
          <div className="overflow-y-auto">
            {showSuggestionsHeader && (
              <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500">
                  Suggested for this job
                </span>
              </div>
            )}
            {displayItems.map((part, i) => {
              const cost = part.defaultCost
                ? parseFloat(part.defaultCost)
                : null;
              const isLow =
                part.stockQuantity != null &&
                part.minStockLevel != null &&
                part.stockQuantity > 0 &&
                part.stockQuantity <= part.minStockLevel;
              const isOut =
                part.minStockLevel != null &&
                part.minStockLevel > 0 &&
                (part.stockQuantity ?? 0) <= 0;

              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => selectPart(part)}
                  className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors duration-100 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 ${
                    highlightIndex === i
                      ? "bg-[#0CC0DF]/5 dark:bg-[#0CC0DF]/10"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.04] active:bg-sky-50 dark:active:bg-sky-500/10"
                  }`}
                  onMouseEnter={() => setHighlightIndex(i)}
                  style={{ minHeight: 56 }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {part.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                      {[part.partNumber, part.category, part.supplierName]
                        .filter(Boolean)
                        .join(" · ") || "No details"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2.5">
                    {cost !== null && (
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">
                        €{cost.toFixed(2)}
                      </span>
                    )}
                    {part.minStockLevel != null && part.minStockLevel > 0 && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isOut
                            ? "bg-red-500"
                            : isLow
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        title={
                          isOut
                            ? "Out of stock"
                            : isLow
                            ? "Low stock"
                            : `${part.stockQuantity} in stock`
                        }
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Custom part actions */}
        {showCustomOption && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 flex items-center gap-3 bg-gray-50/50 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={addCustomPart}
              disabled={isPending}
              className={`text-xs font-medium disabled:opacity-50 transition-colors ${
                highlightIndex === results.length
                  ? "text-[#0CC0DF]"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              onMouseEnter={() => setHighlightIndex(results.length)}
            >
              Use &ldquo;{query.trim()}&rdquo; as custom part
            </button>
            <span className="text-gray-200 dark:text-gray-700 text-xs">·</span>
            <button
              type="button"
              onClick={addToCatalog}
              disabled={isPending}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium disabled:opacity-50 transition-colors"
            >
              Add to catalog
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="pt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">
          Parts
          {totalCount > 0 && (
            <span
              className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                receivedCount === totalCount
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
              }`}
            >
              {receivedCount}/{totalCount}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {!showPicker && !showNewPart && (
            <button
              onClick={() => {
                setShowPicker(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium flex items-center gap-0.5 transition-all duration-150"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
          {!showPicker && !showNewPart && (
            <button
              onClick={() => setShowNewPart(true)}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium flex items-center gap-0.5 transition-all duration-150"
            >
              <Package className="h-3 w-3" /> New
            </button>
          )}
        </div>
      </div>

      {/* Search picker */}
      {showPicker && (
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(-1);
              }}
              onFocus={() => {
                if (query.length >= 2 || suggestions.length > 0) {
                  setIsOpen(true);
                  updatePosition();
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search parts (name, number, supplier…)"
              disabled={isPending}
              autoFocus
              className="w-full h-9 pl-9 pr-9 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0CC0DF]/15 focus:border-[#0CC0DF]/40 transition-all duration-150 disabled:opacity-50"
            />
            {isPending ? (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHighlightIndex(-1);
                  inputRef.current?.focus();
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowPicker(false);
                  setQuery("");
                  setResults([]);
                  setIsOpen(false);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {partCategories.filter(c => c.active).map((cat) => {
              const Icon = ICON_MAP[cat.icon] ?? Package;
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(isActive ? null : cat.key);
                    setHighlightIndex(-1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "bg-gray-50 text-gray-500 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {cat.label}
                </button>
              );
            })}
            {showNewCategory ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const trimmed = newCategoryName.trim();
                  if (!trimmed) return;
                  try {
                    await createPartCategory({ key: trimmed, label: trimmed });
                    toast.success(`Category "${trimmed}" created`);
                    setNewCategoryName("");
                    setShowNewCategory(false);
                    router.refresh();
                  } catch { toast.error("Failed to create category"); }
                }}
                className="inline-flex items-center"
              >
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="h-6 w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-2 text-[10px] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") { setShowNewCategory(false); setNewCategoryName(""); } }}
                />
                <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryName(""); }} className="ml-0.5 p-0.5 rounded text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewCategory(true)}
                className="inline-flex items-center gap-0.5 h-6 px-2 rounded-md text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 border border-dashed border-gray-200 dark:border-gray-700 transition-all duration-150"
              >
                <Plus className="h-2.5 w-2.5" /> Filter
              </button>
            )}
          </div>

          {/* Portal */}
          {typeof window !== "undefined" &&
            isOpen &&
            createPortal(dropdown, document.body)}
        </div>
      )}

      {/* New part inline form */}
      {showNewPart && (
        <form
          className="mb-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const trimmed = newPartName.trim();
            if (!trimmed) return;
            startTransition(async () => {
              try {
                const newPart = await createPart({ name: trimmed, category: newPartCategory ?? undefined, stockQuantity: 0, minStockLevel: 0 });
                await createPartRequest({ repairJobId, partId: newPart.id, partName: newPart.name });
                toast.success(`"${trimmed}" created & added`);
                setNewPartName("");
                setNewPartCategory(null);
                setShowNewPart(false);
                router.refresh();
              } catch { toast.error("Failed to create part"); }
            });
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              placeholder="New part name..."
              className="flex-1 h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0CC0DF]/15 focus:border-[#0CC0DF]/40"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") { setShowNewPart(false); setNewPartName(""); setNewPartCategory(null); } }}
            />
            <button
              type="submit"
              disabled={isPending || !newPartName.trim()}
              className="h-9 px-3 text-xs font-medium rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Create & Add
            </button>
            <button
              type="button"
              onClick={() => { setShowNewPart(false); setNewPartName(""); setNewPartCategory(null); }}
              className="h-9 px-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Category pills for new part */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-0.5">Category:</span>
            {partCategories.filter(c => c.active).map((cat) => {
              const Icon = ICON_MAP[cat.icon] ?? Package;
              const isActive = newPartCategory === cat.key;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewPartCategory(isActive ? null : cat.key)}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "bg-gray-50 text-gray-500 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {cat.label}
                </button>
              );
            })}
            {showNewPartCategory ? (
              <span className="inline-flex items-center">
                <input
                  type="text"
                  value={newPartCategoryName}
                  onChange={(e) => setNewPartCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="h-6 w-28 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-2 text-[10px] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === "Escape") { setShowNewPartCategory(false); setNewPartCategoryName(""); }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = newPartCategoryName.trim();
                      if (!trimmed) return;
                      try {
                        await createPartCategory({ key: trimmed, label: trimmed });
                        toast.success(`Category "${trimmed}" created`);
                        setNewPartCategory(trimmed);
                        setNewPartCategoryName("");
                        setShowNewPartCategory(false);
                        router.refresh();
                      } catch { toast.error("Failed to create category"); }
                    }
                  }}
                />
                <button type="button" onClick={() => { setShowNewPartCategory(false); setNewPartCategoryName(""); }} className="ml-0.5 p-0.5 rounded text-gray-400 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewPartCategory(true)}
                className="inline-flex items-center gap-0.5 h-6 px-2 rounded-md text-[10px] font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 border border-dashed border-gray-200 dark:border-gray-700 transition-all duration-150"
              >
                <Plus className="h-2.5 w-2.5" /> New
              </button>
            )}
          </div>
        </form>
      )}

      {/* Parts list */}
      {partRequests.length > 0 ? (
        <div className="space-y-2">
          {partRequests.map((pr) => (
            <PartRequestCard
              key={pr.id}
              pr={pr}
              isPending={isPending}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────
// Part Request Card
// ──────────────────────────────────────────────

function PartRequestCard({
  pr,
  isPending,
  onQuantityChange,
  onRemove,
  onStatusChange,
}: {
  pr: PartRequestRow;
  isPending: boolean;
  onQuantityChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onStatusChange: (
    id: string,
    s: "requested" | "ordered" | "shipped" | "received" | "cancelled"
  ) => void;
}) {
  const isCustom = !pr.partId;
  const unitCost = pr.unitCost ? parseFloat(pr.unitCost) : null;
  const sellPrice = pr.sellPrice ? parseFloat(pr.sellPrice) : null;
  const lineTotal = unitCost !== null ? unitCost * pr.quantity : null;
  const lineSell = sellPrice !== null ? sellPrice * pr.quantity : null;

  return (
    <div
      className={`rounded-xl border transition-all duration-150 ${
        pr.status === "cancelled"
          ? "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01] opacity-60"
          : "border-gray-100 dark:border-gray-800 bg-white dark:bg-white/[0.03] hover:border-gray-200 dark:hover:border-gray-700"
      }`}
    >
      <div className="px-3.5 py-3">
        {/* Top row: name + status */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {pr.partName}
              </p>
              {isCustom && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
                  Custom
                </span>
              )}
            </div>
            {(pr.partNumber || pr.category || pr.supplierName) && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {[pr.partNumber, pr.category, pr.supplierName]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <PartStatusPicker
            value={pr.status}
            onChange={(v) => onStatusChange(pr.id, v)}
            disabled={isPending}
          />
        </div>

        {/* Bottom row: quantity + pricing + remove */}
        <div className="flex items-center justify-between gap-2">
          {/* Quantity stepper */}
          <div className="flex items-center gap-0 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => onQuantityChange(pr.id, -1)}
              disabled={isPending || pr.quantity <= 1}
              className="h-7 w-7 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="h-7 w-8 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums bg-gray-50 dark:bg-white/5 border-x border-gray-200 dark:border-gray-700">
              {pr.quantity}
            </span>
            <button
              type="button"
              onClick={() => onQuantityChange(pr.id, 1)}
              disabled={isPending}
              className="h-7 w-7 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-3 text-xs tabular-nums">
            {unitCost !== null && (
              <span className="text-gray-500 dark:text-gray-400">
                €{unitCost.toFixed(2)}
                {pr.quantity > 1 && (
                  <span className="text-gray-400 dark:text-gray-500 ml-1">
                    × {pr.quantity}
                  </span>
                )}
              </span>
            )}
            {lineSell !== null && (
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                €{lineSell.toFixed(2)}
              </span>
            )}
            {lineTotal !== null && lineSell === null && (
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                €{lineTotal.toFixed(2)}
              </span>
            )}
          </div>

          {/* Remove */}
          <button
            type="button"
            onClick={() => onRemove(pr.id)}
            disabled={isPending}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 transition-all"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Part Status Picker (styled like other pickers)
// ──────────────────────────────────────────────

const PART_STATUSES = [
  { value: "requested", label: "Requested", icon: "⏳" },
  { value: "ordered", label: "Ordered", icon: "📋" },
  { value: "shipped", label: "Shipped", icon: "🚚" },
  { value: "received", label: "Received", icon: "✓" },
  { value: "cancelled", label: "Cancelled", icon: "✗" },
] as const;

const PART_STATUS_COLORS: Record<string, { pill: string; accent: string }> = {
  requested: { pill: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400", accent: "text-amber-500" },
  ordered: { pill: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400", accent: "text-blue-500" },
  shipped: { pill: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400", accent: "text-indigo-500" },
  received: { pill: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400", accent: "text-emerald-500" },
  cancelled: { pill: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500", accent: "text-gray-400" },
};

function PartStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (s: "requested" | "ordered" | "shipped" | "received" | "cancelled") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const current = PART_STATUSES.find((s) => s.value === value) ?? PART_STATUSES[0];
  const colors = PART_STATUS_COLORS[value] ?? PART_STATUS_COLORS.requested;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-semibold transition-all duration-150 disabled:opacity-50",
          colors.pill
        )}
      >
        {current.icon} {current.label}
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl bg-white dark:bg-[#1A1F2E] border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden">
          {PART_STATUSES.map((s) => {
            const isActive = s.value === value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  onChange(s.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                  isActive
                    ? "bg-gray-50 dark:bg-white/5 font-medium text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
                )}
              >
                <span className="w-4 text-center">{s.icon}</span>
                <span className="flex-1 text-left">{s.label}</span>
                {isActive && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
