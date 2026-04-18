"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { JOB_TYPE_LABELS, type JobType } from "@/types";
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
        bootstrappedRef.current = true;
      } catch {
        toast.error("Could not load lists. Close and retry.");
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [open, bootstrapping]);

  const config = JOB_TYPE_CONFIG[jobType];

  // When unit is selected, auto-fill customer
  const handleUnitSelect = useCallback((id: string | null) => {
    setUnitId(id);
    if (id && !customerId) {
      const unit = units.find((u) => u.id === id);
      if (unit?.customerId) setCustomerId(unit.customerId);
    }
  }, [units, customerId]);

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

    if (data.locationId === "none") data.locationId = null;
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
      setTimeout(() => titleRef.current?.focus(), 150);
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

      {/* Custom modal with backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[10vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
            onClick={() => handleOpenChange(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-2xl mx-4 animate-in fade-in-0 zoom-in-[0.98] slide-in-from-bottom-2 duration-200">
            <div className="bg-card dark:bg-card rounded-2xl border border-border/60 dark:border-border shadow-2xl max-h-[82vh] flex flex-col">

              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-0">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground dark:text-white">New work order</h2>
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

              {/* Body */}
              <div className="overflow-y-auto flex-1 overscroll-contain">
                <form ref={formRef} onSubmit={handleSubmit} className="px-7 pb-7 pt-6 space-y-7">
                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
                  )}

                  {/* ── Section 1: Basic Info ── */}
                  <div className="space-y-4">
                    {/* Job Type pills */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Work type</Label>
                      <div className="flex gap-2">
                        {(Object.entries(JOB_TYPE_LABELS) as [JobType, string][]).map(([val, label]) => {
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
                      <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">
                        Title
                      </Label>
                      <Input
                        ref={titleRef}
                        name="title"
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
                          <SelectContent>
                            {QUICK_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Priority</Label>
                        <PrioritySelect name="priority" defaultValue="normal" className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm shadow-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Location</Label>
                        <LocationSelect name="locationId" locations={locations} className="h-11 rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm shadow-none" />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border/60 dark:border-white/5" />

                  {/* ── Section 2: Context ── */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">Customer</Label>
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
                      <Label className="text-xs font-medium text-muted-foreground dark:text-muted-foreground/70">{config.descLabel}</Label>
                      <Textarea
                        name="descriptionRaw"
                        placeholder={config.descPlaceholder}
                        rows={3}
                        className="rounded-xl border-border dark:border-border bg-card dark:bg-card text-sm px-4 py-3 min-h-[100px] shadow-none resize-none focus:ring-ring/30 focus:border-ring"
                      />
                    </div>

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

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60 dark:border-white/5">
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
                      className="h-10 rounded-xl px-5 text-sm font-medium bg-foreground hover:bg-foreground/90 text-background shadow-sm transition-all duration-150 hover:-translate-y-px"
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
