"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Package, Plus } from "lucide-react";
import { searchPartsCatalog, garageRequestPart } from "@/actions/garage";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Multilingual synonym groups for caravan parts search
const PART_SYNONYMS: string[][] = [
  ["tyre", "tire", "tyres", "tires", "band", "banden", "neumático", "neumáticos", "rueda"],
  ["window", "windows", "raam", "ramen", "ventana", "ventanas", "cristal"],
  ["seal", "seals", "afdichting", "afdichtingen", "sello", "sellado", "junta"],
  ["light", "lights", "lamp", "lampen", "luz", "luces", "verlichting", "faro"],
  ["brake", "brakes", "rem", "remmen", "freno", "frenos"],
  ["airco", "air conditioning", "airconditioning", "aire acondicionado", "klimaat", "climate"],
  ["battery", "batterij", "accu", "batería"],
  ["pump", "pomp", "bomba"],
  ["filter", "filtro"],
  ["hose", "slang", "manguera"],
  ["valve", "ventiel", "válvula"],
  ["bolt", "bout", "bouten", "perno", "tornillo"],
  ["cable", "kabel", "kabels", "cable"],
  ["motor", "engine", "motor"],
  ["door", "deur", "deuren", "puerta"],
  ["roof", "dak", "techo", "tejado"],
  ["floor", "vloer", "suelo"],
  ["awning", "luifel", "toldo"],
  ["fridge", "refrigerator", "koelkast", "nevera", "frigorífico"],
  ["heater", "heating", "verwarming", "kachel", "calefacción", "calentador"],
  ["toilet", "wc", "inodoro"],
  ["shower", "douche", "ducha"],
  ["tank", "water tank", "watertank", "tanque", "depósito"],
  ["antenna", "antenne", "antena"],
  ["lock", "slot", "cerradura"],
  ["mirror", "spiegel", "espejo"],
  ["cushion", "kussen", "cojín"],
  ["curtain", "gordijn", "cortina"],
];

/** Expand a search query with synonym matches */
function expandWithSynonyms(query: string): string[] {
  const q = query.toLowerCase().trim();
  const terms = new Set<string>([q]);

  for (const group of PART_SYNONYMS) {
    if (group.some(syn => q.includes(syn) || syn.includes(q))) {
      for (const syn of group) {
        terms.add(syn);
      }
    }
  }

  return Array.from(terms);
}

type SearchResult = {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  stockQuantity: number | null;
  supplierName: string | null;
  supplierId: string | null;
};

interface GaragePartsPickerProps {
  repairJobId: string;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  onAdded?: () => void;
}

export function GaragePartsPicker({ repairJobId, t, onAdded }: GaragePartsPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Calculate dropdown position
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Search with debounce + synonym expansion
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        // Search original query + all synonyms, deduplicate results
        const terms = expandWithSynonyms(query);
        const allResults = await Promise.all(terms.map(term => searchPartsCatalog(term)));
        const seen = new Set<string>();
        const deduped: SearchResult[] = [];
        for (const batch of allResults) {
          for (const r of batch) {
            if (!seen.has(r.id)) {
              seen.add(r.id);
              deduped.push(r);
            }
          }
        }
        setResults(deduped.slice(0, 15));
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
  }, [query, updatePosition]);

  // Update position on scroll/resize
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

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        inputRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Select a catalog part
  function selectPart(part: SearchResult) {
    startTransition(async () => {
      await garageRequestPart(repairJobId, part.name, {
        partId: part.id,
        unitCost: part.defaultCost ?? undefined,
        category: part.category ?? undefined,
      });
      toast.success(t(
        `"${part.name}" requested`,
        `"${part.name}" solicitado`,
        `"${part.name}" aangevraagd`
      ));
      setQuery("");
      setResults([]);
      setIsOpen(false);
      onAdded?.();
      router.refresh();
    });
  }

  // Add custom/freetext part
  function addCustomPart() {
    if (!query.trim()) return;
    startTransition(async () => {
      await garageRequestPart(repairJobId, query.trim());
      toast.success(t(
        `"${query.trim()}" requested`,
        `"${query.trim()}" solicitado`,
        `"${query.trim()}" aangevraagd`
      ));
      setQuery("");
      setResults([]);
      setIsOpen(false);
      onAdded?.();
      router.refresh();
    });
  }

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
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
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, results.length)); // +1 for custom option
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < results.length) {
          selectPart(results[highlightIndex]);
        } else {
          addCustomPart();
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  const showCustomOption = query.trim().length >= 2;

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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden max-h-[360px] flex flex-col">
        {isSearching && results.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("Searching parts…", "Buscando piezas…", "Onderdelen zoeken…")}</span>
          </div>
        ) : results.length === 0 && !isSearching ? (
          <div className="py-6 px-4 text-center">
            <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">
              {t("No parts found", "No se encontraron piezas", "Geen onderdelen gevonden")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("Press Enter to add as custom part", "Presiona Enter para añadir como pieza nueva", "Druk op Enter om toe te voegen")}
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto">
            {results.map((part, i) => (
              <button
                key={part.id}
                type="button"
                onClick={() => selectPart(part)}
                className={`w-full text-left px-4 py-3.5 flex items-start justify-between gap-3 transition-colors duration-100 border-b border-gray-50 last:border-0 ${
                  highlightIndex === i
                    ? "bg-sky-50"
                    : "hover:bg-gray-50 active:bg-sky-50"
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                style={{ minHeight: 56 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {part.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {[
                      part.partNumber,
                      part.category,
                      part.supplierName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {part.defaultCost && (
                    <p className="text-xs font-semibold text-gray-700 tabular-nums">
                      €{parseFloat(part.defaultCost).toFixed(2)}
                    </p>
                  )}
                  {part.stockQuantity != null && part.stockQuantity > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {t("Stock", "Stock", "Voorraad")}: {part.stockQuantity}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Custom part option */}
        {showCustomOption && (
          <button
            type="button"
            onClick={addCustomPart}
            className={`w-full text-left px-4 py-3.5 flex items-center gap-3 border-t border-gray-100 transition-colors duration-100 ${
              highlightIndex === results.length
                ? "bg-sky-50"
                : "hover:bg-gray-50 active:bg-sky-50"
            }`}
            onMouseEnter={() => setHighlightIndex(results.length)}
            style={{ minHeight: 56 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700">
                {t("Add", "Añadir", "Toevoegen")} &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-xs text-gray-400">
                {t("as custom part", "como pieza nueva", "als nieuw onderdeel")}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) {
              setIsOpen(true);
              updatePosition();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t(
            "Search parts (name, number, supplier…)",
            "Buscar piezas (nombre, número, proveedor…)",
            "Zoek onderdelen (naam, nummer, leverancier…)"
          )}
          disabled={isPending}
          className="w-full h-12 pl-11 pr-10 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40 transition-all duration-150 disabled:opacity-50"
        />
        {(query || isPending) && (
          <button
            type="button"
            onClick={() => {
              if (isPending) return;
              setQuery("");
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Portal dropdown */}
      {typeof window !== "undefined" && isOpen && createPortal(dropdown, document.body)}
    </div>
  );
}
