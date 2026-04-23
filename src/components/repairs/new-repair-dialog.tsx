"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createRepairJob } from "@/actions/repairs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { CustomerSearch } from "@/components/customers/customer-search";
import { LocationSelect } from "@/components/repairs/location-select";
import { PartsPicker, type SelectedPart } from "@/components/parts/parts-picker";
import { UnitSearch } from "@/components/units/unit-search";
import { createPartRequest } from "@/actions/parts";
import { createServiceRequest } from "@/actions/services";
import { JOB_TYPE_LABELS, SELECTABLE_JOB_TYPES, type JobType } from "@/types";
import { Plus, X, Wrench, Sparkles, Settings, ClipboardCheck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";
import { cn } from "@/lib/utils";

interface CatalogPart {
  id: string;
  name: string;
  partNumber: string | null;
  defaultCost: string | null;
  orderUrl: string | null;
  category: string | null;
}

interface UnitOption {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  customerId: string | null;
  storageLocation?: string | null;
}

interface CatalogServiceOption {
  id: string;
  name: string;
  category: string | null;
  defaultPrice: string;
  active: boolean;
}

import type { PartCategory } from "@/components/parts/parts-client";

interface NewRepairDialogProps {
  locations: { id: string; name: string }[];
  /** Optional: when omitted, the dialog lazy-loads on first open. */
  customers?: { id: string; name: string }[];
  partsCatalog?: CatalogPart[];
  partCategories?: PartCategory[];
  units?: UnitOption[];
}

// Job type visual config
const JOB_TYPE_CONFIG: Record<JobType, { icon: React.ElementType; color: string; bg: string; descLabel: string; descPlaceholder: string; partsDefault: "expanded" | "collapsed" | "hidden" }> = {
  repair: { icon: Wrench, color: "text-foreground/80", bg: "bg-muted border-border", descLabel: "Issue description", descPlaceholder: "Describe the damage or issue...", partsDefault: "expanded" },
  wax: { icon: Sparkles, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", descLabel: "Work description", descPlaceholder: "Any special instructions for the wax job...", partsDefault: "collapsed" },
  maintenance: { icon: Settings, color: "text-foreground/80", bg: "bg-muted/60 border-border", descLabel: "Work description", descPlaceholder: "Describe the maintenance needed...", partsDefault: "collapsed" },
  inspection: { icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", descLabel: "Notes", descPlaceholder: "Inspection notes and observations...", partsDefault: "hidden" },
  service: { icon: Sparkles, color: "text-sky-600", bg: "bg-sky-50 border-sky-200", descLabel: "Service description", descPlaceholder: "Which services apply? (waxing, cleaning, ozon, etc.)", partsDefault: "collapsed" },
};

// Quick statuses for creation — only the common starting ones
const QUICK_STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "new", label: "New" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_inspection", label: "In Inspection" },
];

export function NewRepairDialog({
  locations,
  customers: initialCustomers,
  partsCatalog: initialPartsCatalog,
  partCategories: initialPartCategories,
  units: initialUnits,
}: NewRepairDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [servicesCatalog, setServicesCatalog] = useState<CatalogServiceOption[]>([]);
  const [locationId, setLocationId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [jobType, setJobType] = useState<JobType>("repair");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Lazy bootstrap: if the caller didn't preload the supporting lists,
  // fetch them the first time the dialog is opened. Keeps the dashboard
  // free from having to SELECT every customer/unit/part on every visit.
  const [customers, setCustomers] = useState(initialCustomers ?? []);
  const [units, setUnits] = useState<UnitOption[]>(initialUnits ?? []);
  const [partsCatalog, setPartsCatalog] = useState<CatalogPart[]>(initialPartsCatalog ?? []);
  const [partCategories, setPartCategories] = useState<PartCategory[]>(initialPartCategories ?? []);
  const [bootstrapping, setBootstrapping] = useState(false);
  const bootstrappedRef = useRef(Boolean(initialCustomers));

  useEffect(() => {
    if (!open || bootstrappedRef.current || bootstrapping) return;
    setBootstrapping(true);
    (async () => {
      try {
        const { getNewRepairDialogData } = await import(
          "@/actions/new-repair-dialog-data"
        );
        const data = await getNewRepairDialogData();
        setCustomers(data.customers);
        setUnits(data.units);
        setPartsCatalog(data.partsCatalog);
        setPartCategories(data.partCategories as unknown as PartCategory[]);
        if (Array.isArray(data.servicesCatalog)) {
          setServicesCatalog(data.servicesCatalog);
        }
        bootstrappedRef.current = true;
      } catch {
        toast.error("Could not load lists. Close and retry.");
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [open, bootstrapping]);

  const config = JOB_TYPE_CONFIG[jobType];

  // When unit is selected, auto-fill customer and (if still empty)
  // the Location dropdown by matching the unit's `storageLocation`
  // string against the available location names.
  const handleUnitSelect = useCallback((id: string | null) => {
    setUnitId(id);
    if (!id) return;
    const unit = units.find((u) => u.id === id);
    if (!unit) return;
    if (unit.customerId && !customerId) {
      setCustomerId(unit.customerId);
    }
    // Auto-vul de Location-dropdown op basis van de unit's
    // `storageLocation` string (Cruïllas / Peratallada / Sant Climent)
    // door 'm te matchen tegen de namen in de locations-tabel.
    if (locationId === "none" && unit.storageLocation) {
      const needle = unit.storageLocation.toLowerCase().trim();
      const match = locations.find(
        (l) => l.name.toLowerCase().trim() === needle || l.name.toLowerCase().includes(needle),
      );
      if (match) setLocationId(match.id);
    }
  }, [units, customerId, locationId, locations]);

  // When customer changes, clear unit if it doesn't belong
  const handleCustomerSelect = useCallback((id: string | null) => {
    setCustomerId(id);
    if (id && unitId) {
      const unit = units.find((u) => u.id === unitId);
      if (unit && unit.customerId && unit.customerId !== id) {
        setUnitId(null);
      }
    }
  }, [units, unitId]);

  // When job type changes, adapt parts visibility
  useEffect(() => {
    const p = JOB_TYPE_CONFIG[jobType].partsDefault;
    setPartsExpanded(p === "expanded");
  }, [jobType]);

  // ESC key + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-suggest parts based on title/description keywords
  const suggestedParts = useMemo(() => {
    if (!formRef.current) return [];
    const title = (formRef.current.querySelector("[name=title]") as HTMLInputElement)?.value?.toLowerCase() ?? "";
    const desc = (formRef.current.querySelector("[name=descriptionRaw]") as HTMLTextAreaElement)?.value?.toLowerCase() ?? "";
    const text = `${title} ${desc}`;
    if (text.trim().length < 3) return [];

    const selectedIds = new Set(selectedParts.map((p) => p.partId));
    const keywords: [string, string[]][] = [
      ["tyre", ["tyre", "tire", "wheel", "band"]],
      ["seal", ["seal", "rubber", "afdicht"]],
      ["window", ["window", "glass", "raam", "ruit"]],
      ["brake", ["brake", "rem"]],
      ["light", ["light", "lamp", "led"]],
      ["lock", ["lock", "slot", "deur"]],
    ];

    const matchedParts: CatalogPart[] = [];
    for (const [, triggers] of keywords) {
      if (triggers.some((t) => text.includes(t))) {
        for (const part of partsCatalog) {
          if (!selectedIds.has(part.id) && !matchedParts.find((m) => m.id === part.id)) {
            const pName = part.name.toLowerCase();
            if (triggers.some((t) => pName.includes(t))) {
              matchedParts.push(part);
            }
          }
        }
      }
    }
    return matchedParts.slice(0, 3);
  }, [selectedParts, partsCatalog]);

  function resetForm() {
    setCustomerId(null);
    setUnitId(null);
    setSelectedParts([]);
    setSelectedServiceIds([]);
    setLocationId("none");
    setTitle("");
    setJobType("repair");
    setShowAdvanced(false);
    setPartsExpanded(true);
    setError("");
    setSaving(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string" && value.trim()) {
        data[key] = value.trim();
      }
    }

    data.locationId = locationId === "none" ? null : locationId;
    data.title = title.trim();
    data.customerId = customerId;
    data.unitId = unitId;
    data.jobType = jobType;

    try {
      const job = await createRepairJob(data);
      // Create part requests for selected catalog parts
      await Promise.all(
        selectedParts.map((p) =>
          createPartRequest({
            repairJobId: job.id,
            partId: p.partId,
            partName: p.name,
            quantity: p.quantity,
          })
        )
      );
      // Create service requests from the services picked in the Service
      // work-type tab. Runs in parallel; errors bubble up but the job
      // itself has already been persisted so worst case the user adds
      // them manually from the repair-detail.
      if (selectedServiceIds.length > 0) {
        await Promise.all(
          selectedServiceIds.map((id) =>
            createServiceRequest({ repairJobId: job.id, serviceId: id }),
          ),
        );
      }
      setOpen(false);
      resetForm();
      toast.success("Work order created");
      router.push(`/repairs/${job.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create work order");
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      // Focus title after animation
      setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 150);
    } else {
      resetForm();
    }
  }

  const showPartsSection = jobType !== "inspection";

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        size="sm"
        className="h-10 w-full touch-manipulation gap-1.5 rounded-lg text-xs font-medium sm:h-8 sm:w-auto"
      >
        <Plus className="h-3.5 w-3.5" />
        New Work Order
      </Button>

      {/*
        Responsive dialog shell.

        Mobile/tablet (< sm): full-screen sheet. Header and footer are
        sticky so the "Create work order" button is always reachable,
        and the scroll container (the <form>) lives between them. Body
        padding respects iOS safe-area insets so nothing hides behind
        the home indicator or a bottom tab bar.

        Desktop (>= sm): centered modal constrained to 85vh. Same
        internal header/scroll/footer pattern — just inside a rounded
        card floating over the backdrop.
      */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] flex items-stretch justify-center p-0 sm:items-center sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
            onClick={() => handleOpenChange(false)}
          />

          {/* Modal card: full-screen op mobiel, gecentreerd met max-h op
              sm+ zodat de sticky footer altijd zichtbaar blijft. */}
          <div
            className={cn(
              "relative z-10 flex min-h-0 w-full flex-col overflow-hidden bg-card text-foreground shadow-2xl dark:bg-card",
              "h-[100dvh] max-h-[100dvh]",
              "sm:h-auto sm:max-h-[min(92vh,920px)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border/60 dark:sm:border-border",
              "animate-in fade-in-0 sm:zoom-in-[0.98] slide-in-from-bottom-2 duration-200",
            )}
          >
              {/* Sticky header */}
              <div
                className="flex items-start justify-between border-b border-border/60 dark:border-white/5 bg-card/95 backdrop-blur px-5 sm:px-7 pb-4 sm:border-b-0"
                style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
              >
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-foreground dark:text-white">New work order</h2>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground/70 mt-0.5">Create a new job</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-lg p-1.5 text-muted-foreground/70 hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-foreground/80 hover:bg-muted dark:hover:bg-card/5 transition-colors -mt-1 -mr-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <form ref={formRef} onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 pt-5 sm:pt-6 pb-6 space-y-7">
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
                  )}

                  {/* ── Section 1: Basic Info ── */}
                  <div className="space-y-4">
                    {/* Job Type pills */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Work type</Label>
                      <div className="flex gap-2">
                        {SELECTABLE_JOB_TYPES.map((val) => {
                          const label = JOB_TYPE_LABELS[val];
                          const c = JOB_TYPE_CONFIG[val];
                          const Icon = c.icon;
                          const active = jobType === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setJobType(val)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all",
                                active
                                  ? `${c.bg} ${c.color} shadow-sm`
                                  : "border-border dark:border-border text-muted-foreground dark:text-muted-foreground/70 hover:border-foreground/20 dark:hover:border-white/20 hover:text-foreground/90 dark:hover:text-foreground/80"
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <Label
                        required
                        hint="short and clear"
                        className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70"
                      >
                        Title
                      </Label>
                      <Input
                        ref={titleRef}
                        name="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={jobType === "wax" ? "e.g. Full wax treatment" : jobType === "inspection" ? "e.g. Annual inspection" : "Brief summary of the work"}
                        className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 shadow-none focus:ring-ring/30 focus:border-ring"
                      />
                    </div>

                    {/* Status + Priority + Location */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Status</Label>
                        <Select name="status" defaultValue="todo">
                          <SelectTrigger className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[80]">
                            {QUICK_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Priority</Label>
                        <PrioritySelect name="priority" defaultValue="normal" className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm shadow-none" contentClassName="z-[80]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Location</Label>
                        <LocationSelect
                          value={locationId}
                          onValueChange={setLocationId}
                          locations={locations}
                          className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm shadow-none"
                          contentClassName="z-[80]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/60 dark:border-white/5" />

                  {/* ── Section 2: Context ── */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label required className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Customer</Label>
                        <CustomerSearch
                          customers={customers}
                          value={customerId ?? undefined}
                          onSelect={handleCustomerSelect}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Unit / Vehicle</Label>
                        <UnitSearch
                          units={units}
                          value={unitId ?? undefined}
                          customerId={customerId}
                          onSelect={handleUnitSelect}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/60 dark:border-white/5" />

                  {/* ── Section 3: Work Details ── */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label
                        hint="describe the issue"
                        className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70"
                      >
                        {config.descLabel}
                      </Label>
                      <Textarea
                        name="descriptionRaw"
                        placeholder={config.descPlaceholder}
                        rows={3}
                        className="rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 py-3 min-h-[100px] shadow-none resize-none focus:ring-ring/30 focus:border-ring"
                      />
                    </div>

                    {/* Services — only visible on the Service work-type */}
                    {jobType === "service" && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">
                          Services{selectedServiceIds.length > 0 ? ` · ${selectedServiceIds.length} selected` : ""}
                        </Label>
                        {servicesCatalog.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No services in catalog yet. Add some in /services.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {servicesCatalog.map((s) => {
                              const active = selectedServiceIds.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedServiceIds((prev) =>
                                      active ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                                    );
                                    // Vul de titel automatisch met de service-naam
                                    // bij de eerste selectie als het titelveld nog
                                    // leeg is — scheelt de admin een tikje typen.
                                    if (!active && !title.trim()) {
                                      setTitle(s.name);
                                    }
                                  }}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                                    active
                                      ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                      : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground/90 dark:hover:border-white/20",
                                  )}
                                >
                                  <span className="truncate max-w-[18rem]">{s.name}</span>
                                  <span className="tabular-nums text-[11px] opacity-70">
                                    €{parseFloat(s.defaultPrice).toFixed(0)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Parts — adaptive visibility */}
                    {showPartsSection && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setPartsExpanded(!partsExpanded)}
                          className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground/90 dark:hover:text-foreground/80 transition-colors"
                        >
                          {partsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Parts from catalog
                          {selectedParts.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.06] text-foreground text-[10px] font-semibold">{selectedParts.length}</span>
                          )}
                        </button>

                        {partsExpanded && (
                          <div className="space-y-3">
                            <PartsPicker catalog={partsCatalog} categories={partCategories} value={selectedParts} onChange={setSelectedParts} />

                            {/* Auto-suggested parts */}
                            {suggestedParts.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-muted-foreground/70 dark:text-muted-foreground">Suggested:</span>
                                {suggestedParts.map((part) => (
                                  <button
                                    key={part.id}
                                    type="button"
                                    onClick={() => setSelectedParts((prev) => [...prev, { partId: part.id, name: part.name, partNumber: part.partNumber, quantity: 1 }])}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-foreground/20 dark:border-white/15 text-muted-foreground dark:text-foreground/80 hover:border-foreground/30 hover:text-foreground transition-colors"
                                  >
                                    + {part.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Advanced section — collapsed by default */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground/70 dark:text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/70 transition-colors"
                    >
                      {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Additional details
                    </button>

                    {showAdvanced && (
                      <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Additional parts (free text)</Label>
                          <Textarea
                            name="partsNeededRaw"
                            placeholder="Any parts not in the catalog..."
                            rows={2}
                            className="rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 py-3 shadow-none resize-none focus:ring-ring/30 focus:border-ring"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Internal notes</Label>
                          <Textarea
                            name="notesRaw"
                            placeholder="Notes visible only to staff..."
                            rows={2}
                            className="rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 py-3 shadow-none resize-none focus:ring-ring/30 focus:border-ring"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Estimated cost (€)</Label>
                            <Input
                              name="estimatedCost"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 shadow-none focus:ring-ring/30 focus:border-ring"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Estimated hours</Label>
                            <Input
                              name="estimatedHours"
                              type="number"
                              step="0.25"
                              placeholder="0"
                              className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 shadow-none focus:ring-ring/30 focus:border-ring"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Sticky footer — always reachable, even on small screens.
                    Safe-area inset keeps the primary button clear of the iOS
                    home indicator and any in-page bottom nav. */}
                <div
                  className="flex items-center justify-between gap-3 border-t border-border/60 dark:border-white/5 bg-card/95 backdrop-blur px-5 sm:px-7 pt-3"
                  style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenChange(false)}
                    className="text-sm text-muted-foreground dark:text-muted-foreground/70 hover:text-foreground/90 dark:hover:text-foreground/80 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="h-11 rounded-xl px-5 text-sm font-medium bg-foreground hover:bg-foreground/90 text-background shadow-sm transition-all duration-150"
                  >
                    {saving ? (
                      <>
                        <Spinner className="mr-2 h-3.5 w-3.5" />
                        Creating...
                      </>
                    ) : (
                      "Create work order"
                    )}
                  </Button>
                </div>
              </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
