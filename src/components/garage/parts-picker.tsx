"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import { Search, X, Loader2, Package, Plus, Zap, Wrench, Paintbrush, Droplets, Snowflake, Warehouse, Truck, Sparkles, Hammer, Home, SquareStack } from "lucide-react";
import { searchPartsCatalog, garageRequestPart } from "@/actions/garage";
import { hapticSuccess } from "@/lib/haptic";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// Icon map (matches admin parts page)
const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Wrench, SquareStack, Paintbrush, Droplets, Snowflake, Warehouse, Truck, Sparkles, Hammer, Package, Home,
};

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
  ["sink", "lavabo", "spoelbak", "fregadero"],
  ["fuse", "zekering", "fusible"],
  ["socket", "stopcontact", "enchufe", "mechero"],
  ["awning rail", "rail", "riel", "riel toldo"],
  ["gas", "gás", "gasfles", "bombona", "propane", "propaan"],
  ["step", "step", "opstap", "escalón", "escalerilla"],
  ["stabiliser", "stabilizer", "uitzetter", "pata", "patas"],
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
  /** Gekoppeld aan een taak — requests verschijnen gegroepeerd per taak. */
  repairTaskId?: string | null;
  /** Verbergt categorie-pills + gereedschap-knop (compacte taak-context). */
  taskScoped?: boolean;
  t: (en: string, es?: string | null, nl?: string | null) => string;
  onAdded?: () => void;
  partCategories?: { id: string; key: string; label: string; icon: string; color: string; sortOrder: number; active: boolean }[];
  workerName?: string;
}

export function GaragePartsPicker({
  repairJobId,
  repairTaskId,
  taskScoped = false,
  t,
  onAdded,
  partCategories,
  workerName,
}: GaragePartsPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [equipmentName, setEquipmentName] = useState("");

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

  // Search with debounce + synonym expansion + category filter
  useEffect(() => {
    if (query.length < 2 && !selectedCategory) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (query.length >= 2) {
          // Search original query + all synonyms, deduplicate results
          const terms = expandWithSynonyms(query);
          const allResults = await Promise.all(terms.map(term => searchPartsCatalog(term, selectedCategory ?? undefined)));
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
        } else if (selectedCategory) {
          // Category only — show all parts in this category
          const data = await searchPartsCatalog("", selectedCategory);
          setResults(data);
        }
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
  }, [query, selectedCategory, updatePosition]);

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
    hapticSuccess();
    startTransition(async () => {
      await garageRequestPart(repairJobId, part.name, {
        partId: part.id,
        unitCost: part.defaultCost ?? undefined,
        category: part.category ?? undefined,
        workerName,
        repairTaskId: repairTaskId ?? undefined,
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
  function addCustomPart(name?: string) {
    const partName = name || query.trim();
    if (!partName) return;
    hapticSuccess();
    startTransition(async () => {
      await garageRequestPart(repairJobId, partName, {
        workerName,
        repairTaskId: repairTaskId ?? undefined,
      });
      toast.success(t(
        `"${partName}" requested`,
        `"${partName}" solicitado`,
        `"${partName}" aangevraagd`
      ));
      setQuery("");
      setCustomName("");
      setShowCustomForm(false);
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
      <div className="bg-stone-900 rounded-2xl border border-white/[0.08] shadow-xl overflow-hidden max-h-[50vh] flex flex-col">
        {isSearching && results.length === 0 ? (
          <div className="flex items-center justify-center gap-3 py-10 text-white/30">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-base">{t("Searching parts…", "Buscando piezas…", "Onderdelen zoeken…")}</span>
          </div>
        ) : results.length === 0 && !isSearching ? (
          <div className="py-10 px-6 text-center">
            <Package className="h-10 w-10 text-white/15 mx-auto mb-3" />
            <p className="text-base font-medium text-white/50">
              {t("No parts found", "No se encontraron piezas", "Geen onderdelen gevonden")}
            </p>
            <p className="text-sm text-white/25 mt-1">
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
                className={`w-full text-left px-5 py-4 flex items-start justify-between gap-3 transition-colors duration-100 border-b border-white/[0.04] last:border-0 ${
                  highlightIndex === i
                    ? "bg-white/[0.06]"
                    : "hover:bg-white/[0.04] active:bg-white/[0.06]"
                }`}
                onMouseEnter={() => setHighlightIndex(i)}
                style={{ minHeight: 64 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-white/90 truncate">
                    {part.name}
                  </p>
                  <p className="text-sm text-white/40 mt-0.5 truncate">
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
                    <p className="text-sm font-semibold text-white/70 tabular-nums">
                      €{parseFloat(part.defaultCost).toFixed(2)}
                    </p>
                  )}
                  {part.stockQuantity != null && part.stockQuantity > 0 && (
                    <p className="text-xs text-white/25 mt-0.5">
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
            onClick={() => addCustomPart()}
            className={`w-full text-left px-5 py-4 flex items-center gap-3 border-t border-white/[0.06] transition-colors duration-100 ${
              highlightIndex === results.length
                ? "bg-white/[0.06]"
                : "hover:bg-white/[0.04] active:bg-white/[0.06]"
            }`}
            onMouseEnter={() => setHighlightIndex(results.length)}
            style={{ minHeight: 64 }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
              <Plus className="h-5 w-5 text-white/40" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-medium text-white/70">
                {t("Add", "Añadir", "Toevoegen")} &ldquo;{query.trim()}&rdquo;
              </p>
              <p className="text-sm text-white/30">
                {t("as custom part", "como pieza nueva", "als nieuw onderdeel")}
              </p>
            </div>
          </button>
        )}
      </div>
    </div>
  );

  const activeCategories = (partCategories ?? []).filter(c => c.active).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      {/* Category filter pills */}
      {!taskScoped && activeCategories.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeCategories.map((cat) => {
            const CatIcon = ICON_MAP[cat.icon] ?? Package;
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(isSelected ? null : cat.key);
                  setHighlightIndex(-1);
                }}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${
                  isSelected
                    ? cat.color
                    : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08] border border-white/[0.06]"
                }`}
              >
                <CatIcon className="h-4 w-4" />
                {cat.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-white/[0.03] border border-dashed border-white/[0.12] text-white/40 hover:border-white/20 transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            {t("New", "Nuevo", "Nieuw")}
          </button>
          {!taskScoped ? (
            <button
              type="button"
              onClick={() => setShowEquipmentForm(!showEquipmentForm)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium bg-violet-400/10 text-violet-400 border border-violet-400/20 hover:bg-violet-400/20 transition-all active:scale-[0.97]"
            >
              <Wrench className="h-4 w-4" />
              {t("Equipment", "Herramienta", "Gereedschap")}
            </button>
          ) : null}
        </div>
      )}

      {taskScoped ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] leading-snug text-white/40">
            {t(
              "Search below, pick a catalog line, or type a name and press Enter — requests stay under this task.",
              "Busca abajo, elige del catálogo o escribe y pulsa Enter — el pedido queda ligado a esta tarea.",
              "Zoek hieronder, kies uit de catalogus of typ een naam en druk Enter — aanvraag blijft bij deze taak.",
            )}
          </p>
          {!showCustomForm ? (
            <button
              type="button"
              onClick={() => setShowCustomForm(true)}
              className="self-start rounded-lg border border-dashed border-white/[0.12] px-2.5 py-1 text-[11px] font-semibold text-white/50 hover:border-white/25 hover:text-white/75"
            >
              {t("Or type a new part name…", "O escribir nombre nuevo…", "Of typ een nieuwe naam…")}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Custom part request form */}
      {showCustomForm && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customName.trim()) {
                e.preventDefault();
                addCustomPart(customName.trim());
              }
              if (e.key === "Escape") setShowCustomForm(false);
            }}
            placeholder={t(
              "Part name or description…",
              "Nombre o descripción de la pieza…",
              "Naam of beschrijving onderdeel…"
            )}
            autoFocus
            disabled={isPending}
            className="flex-1 h-12 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => addCustomPart(customName.trim())}
            disabled={!customName.trim() || isPending}
            className="h-12 px-5 rounded-xl bg-white/10 text-white text-sm font-medium transition-all active:scale-[0.97] hover:bg-white/15 disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("Request", "Solicitar", "Aanvragen")
            )}
          </button>
        </div>
      )}

      {/* Equipment request form */}
      {!taskScoped && showEquipmentForm ? (
        <div className="flex items-center gap-2">
          <div className="h-12 w-12 rounded-xl bg-violet-400/10 flex items-center justify-center shrink-0">
            <Wrench className="h-5 w-5 text-violet-400" />
          </div>
          <input
            type="text"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && equipmentName.trim()) {
                e.preventDefault();
                startTransition(async () => {
                  await garageRequestPart(repairJobId, equipmentName.trim(), {
                    requestType: "equipment",
                    workerName,
                    repairTaskId: repairTaskId ?? undefined,
                  });
                  toast.success(t(
                    `"${equipmentName.trim()}" requested`,
                    `"${equipmentName.trim()}" solicitado`,
                    `"${equipmentName.trim()}" aangevraagd`
                  ));
                  setEquipmentName("");
                  setShowEquipmentForm(false);
                  onAdded?.();
                  router.refresh();
                });
              }
              if (e.key === "Escape") setShowEquipmentForm(false);
            }}
            placeholder={t(
              "Tool or equipment name…",
              "Nombre de herramienta…",
              "Gereedschap of apparaat…"
            )}
            autoFocus
            disabled={isPending}
            className="flex-1 h-12 px-4 rounded-xl border border-violet-400/20 bg-white/[0.04] text-base text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-violet-400/20 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => {
              if (!equipmentName.trim()) return;
              startTransition(async () => {
                await garageRequestPart(repairJobId, equipmentName.trim(), {
                  requestType: "equipment",
                  workerName,
                  repairTaskId: repairTaskId ?? undefined,
                });
                toast.success(t(
                  `"${equipmentName.trim()}" requested`,
                  `"${equipmentName.trim()}" solicitado`,
                  `"${equipmentName.trim()}" aangevraagd`
                ));
                setEquipmentName("");
                setShowEquipmentForm(false);
                onAdded?.();
                router.refresh();
              });
            }}
            disabled={!equipmentName.trim() || isPending}
            className="h-12 px-5 rounded-xl bg-violet-500 text-white text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("Request", "Solicitar", "Aanvragen")
            )}
          </button>
        </div>
      ) : null}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/20 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.length >= 2 || selectedCategory) {
              setIsOpen(true);
              updatePosition();
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t(
            "Search parts (name, number, supplier…)",
            "Buscar piezas (nombre, número, proveedor…)",
            "Search onderdelen (naam, nummer, leverancier…)"
          )}
          disabled={isPending}
          className="w-full h-14 pl-12 pr-12 rounded-2xl border border-white/[0.08] bg-white/[0.04] text-base text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all duration-150 disabled:opacity-50"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
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
