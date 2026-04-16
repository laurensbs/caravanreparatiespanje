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
  customers: { id: string; name: string }[];
  partsCatalog?: CatalogPart[];
  partCategories?: PartCategory[];
  units?: UnitOption[];
}

// Job type visual config
const JOB_TYPE_CONFIG: Record<JobType, { icon: React.ElementType; color: string; bg: string; descLabel: string; descPlaceholder: string; partsDefault: "expanded" | "collapsed" | "hidden" }> = {
  repair: { icon: Wrench, color: "text-slate-700", bg: "bg-slate-100 border-slate-200", descLabel: "Issue description", descPlaceholder: "Describe the damage or issue...", partsDefault: "expanded" },
  wax: { icon: Sparkles, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", descLabel: "Work description", descPlaceholder: "Any special instructions for the wax job...", partsDefault: "collapsed" },
  maintenance: { icon: Settings, color: "text-sky-600", bg: "bg-sky-50 border-sky-200", descLabel: "Work description", descPlaceholder: "Describe the maintenance needed...", partsDefault: "collapsed" },
  inspection: { icon: ClipboardCheck, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", descLabel: "Notes", descPlaceholder: "Inspection notes and observations...", partsDefault: "hidden" },
};

// Quick statuses for creation — only the common starting ones
const QUICK_STATUSES = [
  { value: "todo", label: "In Workshop" },
  { value: "new", label: "New" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_inspection", label: "In Inspection" },
];

export function NewRepairDialog({ locations, customers, partsCatalog = [], partCategories = [], units = [] }: NewRepairDialogProps) {
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
      <Button onClick={() => handleOpenChange(true)} size="sm" className="h-8 rounded-lg gap-1.5 text-xs font-medium">
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
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-gray-100 dark:border-white/10 shadow-2xl max-h-[82vh] flex flex-col">

              {/* Header */}
              <div className="flex items-start justify-between px-7 pt-7 pb-0">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">New work order</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Create a new job</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors -mt-1 -mr-1"
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
                      <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Work type</Label>
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
                                  : "border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/20 hover:text-gray-700 dark:hover:text-slate-300"
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
                      <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">
                        Title
                      </Label>
                      <Input
                        ref={titleRef}
                        name="title"
                        placeholder={jobType === "wax" ? "e.g. Full wax treatment" : jobType === "inspection" ? "e.g. Annual inspection" : "Brief summary of the work"}
                        className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 shadow-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                      />
                    </div>

                    {/* Status + Priority + Location */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Status</Label>
                        <Select name="status" defaultValue="todo">
                          <SelectTrigger className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm shadow-none">
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
                        <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Priority</Label>
                        <PrioritySelect name="priority" defaultValue="normal" className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm shadow-none" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Location</Label>
                        <LocationSelect name="locationId" locations={locations} className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm shadow-none" />
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-white/5" />

                  {/* ── Section 2: Context ── */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Customer</Label>
                        <CustomerSearch
                          customers={customers}
                          value={customerId ?? undefined}
                          onSelect={handleCustomerSelect}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Unit / Vehicle</Label>
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
                  <div className="border-t border-gray-100 dark:border-white/5" />

                  {/* ── Section 3: Work Details ── */}
                  <div className="space-y-4">
                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">{config.descLabel}</Label>
                      <Textarea
                        name="descriptionRaw"
                        placeholder={config.descPlaceholder}
                        rows={3}
                        className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 py-3 min-h-[100px] shadow-none resize-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                      />
                    </div>

                    {/* Parts — adaptive visibility */}
                    {showPartsSection && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setPartsExpanded(!partsExpanded)}
                          className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors"
                        >
                          {partsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Parts from catalog
                          {selectedParts.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-[#0CC0DF]/10 text-[#0CC0DF] text-[10px] font-semibold">{selectedParts.length}</span>
                          )}
                        </button>

                        {partsExpanded && (
                          <div className="space-y-3">
                            <PartsPicker catalog={partsCatalog} categories={partCategories} value={selectedParts} onChange={setSelectedParts} />

                            {/* Auto-suggested parts */}
                            {suggestedParts.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] text-gray-400 dark:text-slate-500">Suggested:</span>
                                {suggestedParts.map((part) => (
                                  <button
                                    key={part.id}
                                    type="button"
                                    onClick={() => setSelectedParts((prev) => [...prev, { partId: part.id, name: part.name, partNumber: part.partNumber, quantity: 1 }])}
                                    className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-gray-300 dark:border-white/15 text-gray-600 dark:text-slate-300 hover:border-[#0CC0DF]/40 hover:text-[#0CC0DF] transition-colors"
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
                      className="flex items-center gap-2 text-xs font-medium text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-400 transition-colors"
                    >
                      {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      Additional details
                    </button>

                    {showAdvanced && (
                      <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Additional parts (free text)</Label>
                          <Textarea
                            name="partsNeededRaw"
                            placeholder="Any parts not in the catalog..."
                            rows={2}
                            className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 py-3 shadow-none resize-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Internal notes</Label>
                          <Textarea
                            name="notesRaw"
                            placeholder="Notes visible only to staff..."
                            rows={2}
                            className="rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 py-3 shadow-none resize-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Estimated cost (€)</Label>
                            <Input
                              name="estimatedCost"
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 shadow-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-gray-500 dark:text-slate-400">Estimated hours</Label>
                            <Input
                              name="estimatedHours"
                              type="number"
                              step="0.25"
                              placeholder="0"
                              className="h-11 rounded-xl border-gray-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-sm px-4 shadow-none focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/40"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => handleOpenChange(false)}
                      className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="h-10 rounded-xl px-5 text-sm font-medium bg-[#0CC0DF] hover:bg-[#0ab3d0] text-white shadow-sm"
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
