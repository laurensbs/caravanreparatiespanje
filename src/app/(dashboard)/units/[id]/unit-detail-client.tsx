"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Hash, Truck, Calendar, Wrench, StickyNote,
  MapPin, Ruler, Warehouse, Navigation, Tag, Pencil, Check, X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { STATUS_LABELS, UNIT_TYPE_LABELS } from "@/types";
import type { RepairStatus, UnitType } from "@/types";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { addTagToUnit, removeTagFromUnit } from "@/actions/tags";
import { UnitTypeIconBadge } from "@/components/units/unit-type-icon";
import { DashboardPageCanvas } from "@/components/layout/dashboard-surface";

type UnitData = NonNullable<Awaited<ReturnType<typeof import("@/actions/units").getUnitById>>>;

interface Props {
  unit: UnitData;
  allTags?: TagItem[];
}

export function UnitDetailClient({ unit: initialUnit, allTags = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unit = initialUnit;

  const [editingField, setEditingField] = useState<string | null>(null);
  const [showBasics, setShowBasics] = useState(false);
  const [registration, setRegistration] = useState(unit.registration ?? "");
  const [brand, setBrand] = useState(unit.brand ?? "");
  const [model, setModel] = useState(unit.model ?? "");
  const [year, setYear] = useState(unit.year?.toString() ?? "");
  const [chassisId, setChassisId] = useState(unit.chassisId ?? "");
  const [length, setLength] = useState(unit.length ?? "");
  const [storageLocation, setStorageLocation] = useState(unit.storageLocation ?? "");
  const [storageType, setStorageType] = useState(unit.storageType ?? "");
  const [currentPosition, setCurrentPosition] = useState(unit.currentPosition ?? "");
  const [nfcTag, setNfcTag] = useState(unit.nfcTag ?? "");
  const [notes, setNotes] = useState(unit.notes ?? "");

  function saveField(field: string, value: string) {
    startTransition(async () => {
      try {
        const data: Record<string, any> = { customerId: unit.customerId };
        const fields: Record<string, string> = {
          registration, brand, model, chassisId, length,
          storageLocation, storageType, currentPosition, nfcTag, notes,
        };
        fields[field] = value;
        for (const [k, v] of Object.entries(fields)) {
          data[k] = v || undefined;
        }
        data.year = (field === "year" ? value : year) ? parseInt(field === "year" ? value : year) : undefined;

        await updateUnit(unit.id, data);
        toast.success("Saved");
        setEditingField(null);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to save");
      }
    });
  }

  const unitTitle = [unit.brand, unit.model].filter(Boolean).join(" ") || "Unit";
  const unitType = (unit.unitType ?? "unknown") as UnitType;
  const unitTypeLabel = UNIT_TYPE_LABELS[unitType] ?? "Unit";

  return (
    <DashboardPageCanvas>
    <div className="animate-fade-in">
      {/* ─── Header ─── */}
      <div className="mb-6 sm:mb-8">
        <Link href="/units" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground/70 dark:text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/50 transition-colors mb-3">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to units
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <UnitTypeIconBadge unitType={unit.unitType} className="mt-1" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">{unitTypeLabel}</p>
              <h1 className="mt-0.5 text-[26px] font-semibold leading-tight tracking-tight text-foreground dark:text-foreground sm:text-3xl">{unitTitle}</h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[13px] text-muted-foreground dark:text-muted-foreground/70">
                {unit.registration && (
                  <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/90 dark:bg-foreground/[0.08] dark:text-muted-foreground/50">
                    {unit.registration}
                  </span>
                )}
                {unit.customer && (
                  <>
                    {unit.registration && <span className="text-muted-foreground/50 dark:text-muted-foreground">·</span>}
                    <Link href={`/customers/${unit.customer.id}`} className="text-foreground hover:text-foreground dark:hover:text-foreground/90 transition-colors">
                      {unit.customer.name}
                    </Link>
                  </>
                )}
                {storageLocation && (
                  <>
                    <span className="text-muted-foreground/50 dark:text-muted-foreground">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {storageLocation}
                      {storageType && (
                        <span className="text-muted-foreground/70 dark:text-muted-foreground">· {storageType.toLowerCase()}</span>
                      )}
                    </span>
                  </>
                )}
                {unit.repairJobs.length > 0 && (
                  <>
                    <span className="text-muted-foreground/50 dark:text-muted-foreground">·</span>
                    <span>{unit.repairJobs.length} repair{unit.repairJobs.length !== 1 ? "s" : ""}</span>
                  </>
                )}
              </div>
              <div className="mt-2.5">
                <TagPicker
                  allTags={allTags}
                  activeTags={unit.tags ?? []}
                  onAdd={(tagId) => addTagToUnit(unit.id, tagId)}
                  onRemove={(tagId) => removeTagFromUnit(unit.id, tagId)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column — Specifications + Notes */}
        <div className="lg:col-span-5 space-y-6">

          {/* Specifications (merged details + storage) */}
          <div className="bg-card dark:bg-foreground rounded-2xl border border-border/60 dark:border-border shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">Specifications</p>
              <button
                onClick={() => setShowBasics((s) => !s)}
                className="text-[11px] text-muted-foreground/70 hover:text-foreground/90 dark:text-muted-foreground dark:hover:text-muted-foreground/50 transition-colors"
              >
                {showBasics ? "Hide basics" : "Edit basics"}
              </button>
            </div>
            <div className="px-5 pb-4">
              {showBasics && (
                <>
                  <InlineRow icon={Hash} label="License Plate" value={registration} field="registration" mono
                    editingField={editingField} saving={isPending} onChange={setRegistration} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
                  <InlineRow icon={Truck} label="Brand" value={brand} field="brand"
                    editingField={editingField} saving={isPending} onChange={setBrand} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
                  <InlineRow icon={Truck} label="Model" value={model} field="model"
                    editingField={editingField} saving={isPending} onChange={setModel} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
                </>
              )}
              <InlineRow icon={Calendar} label="Year" value={year} field="year" type="number"
                editingField={editingField} saving={isPending} onChange={setYear} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Hash} label="Chassis" value={chassisId} field="chassisId" mono
                editingField={editingField} saving={isPending} onChange={setChassisId} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Ruler} label="Length" value={length} field="length"
                editingField={editingField} saving={isPending} onChange={setLength} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
            </div>

            {/* Storage & Location — same card, subtle divider */}
            <div className="px-5 pt-3 pb-2 border-t border-border/60 dark:border-border flex items-center gap-1.5">
              <Warehouse className="h-3 w-3 text-muted-foreground/70 dark:text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">Storage</p>
            </div>
            <div className="px-5 pb-5">
              <InlineSelectRow icon={MapPin} label="Location" value={storageLocation} field="storageLocation"
                options={["Cruïllas", "Sant Climent", "Peratallada"]} placeholder="Select location..."
                editingField={editingField} saving={isPending} onChange={setStorageLocation} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineSelectRow icon={Warehouse} label="Type" value={storageType} field="storageType"
                options={["Inside", "Outside"]} placeholder="Inside / Outside"
                editingField={editingField} saving={isPending} onChange={setStorageType} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)}
                chip={storageType === "Inside" ? "bg-muted/60 text-foreground dark:bg-foreground/[0.05] dark:text-foreground/80" : storageType === "Outside" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : undefined} />
              <InlineRow icon={Navigation} label="Position" value={currentPosition} field="currentPosition"
                editingField={editingField} saving={isPending} onChange={setCurrentPosition} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Tag} label="NFC Tag" value={nfcTag} field="nfcTag" mono nfcPill
                editingField={editingField} saving={isPending} onChange={setNfcTag} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
            </div>
          </div>

          {/* Notes */}
          <div className="group/notes bg-card dark:bg-foreground rounded-2xl border border-border/60 dark:border-border shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">
                <StickyNote className="h-3 w-3" /> Notes
              </p>
              {editingField !== "notes" && notes && (
                <button
                  onClick={() => setEditingField("notes")}
                  className="opacity-0 group-hover/notes:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted dark:hover:bg-foreground/[0.10]"
                  aria-label="Edit notes"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground/70 dark:text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="px-5 pb-5">
              {editingField === "notes" ? (
                <div className="space-y-2 mt-1">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-sm rounded-xl border-border dark:border-border resize-none" autoFocus />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs rounded-xl px-3" onClick={() => saveField("notes", notes)} disabled={isPending}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-xl" onClick={() => { setNotes(unit.notes ?? ""); setEditingField(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-1 rounded-xl cursor-pointer transition-colors hover:bg-muted/40 dark:hover:bg-foreground/[0.05] px-3 py-2 -mx-3"
                  onClick={() => setEditingField("notes")}
                >
                  {notes ? (
                    <p className="text-sm text-foreground/90 dark:text-muted-foreground/50 whitespace-pre-wrap leading-relaxed">{notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground/70 dark:text-muted-foreground">Click to add notes</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — Repairs */}
        <div className="lg:col-span-7">
          <div className="bg-card dark:bg-foreground rounded-2xl border border-border/60 dark:border-border shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground/70 dark:text-muted-foreground" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 dark:text-muted-foreground">Repairs</p>
              {unit.repairJobs.length > 0 && (
                <span className="tabular-nums text-[11px] font-medium text-foreground/90 dark:text-foreground/90">
                  {unit.repairJobs.length}
                </span>
              )}
            </div>

            {unit.repairJobs.length === 0 ? (
              <div className="px-5 pb-5">
                <div className="rounded-xl border border-dashed border-border dark:border-border bg-muted/40 dark:bg-foreground/[0.05] py-10 text-center">
                  <Wrench className="h-7 w-7 text-muted-foreground/50 dark:text-muted-foreground mx-auto mb-2.5" />
                  <p className="text-sm text-muted-foreground/70 dark:text-muted-foreground">No repairs for this unit</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60 dark:divide-border/60 max-h-[700px] overflow-y-auto">
                {unit.repairJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/40 dark:hover:bg-foreground/[0.04]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground dark:text-foreground truncate transition-colors group-hover:text-foreground dark:group-hover:text-foreground/80">
                        {job.title || "Unnamed"}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70 dark:text-muted-foreground">{job.publicCode}</p>
                    </div>
                    <StatusBadge status={job.status as RepairStatus} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </DashboardPageCanvas>
  );
}

/* ─── Status badge ─── */

const STATUS_BADGE_COLORS: Partial<Record<RepairStatus, string>> = {
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  waiting_approval: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  waiting_customer: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  waiting_parts: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  in_progress: "bg-muted/60 text-foreground dark:bg-foreground/[0.05] dark:text-foreground/80",
  scheduled: "bg-muted/60 text-foreground dark:bg-foreground/[0.05] dark:text-foreground/80",
  quote_needed: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  in_inspection: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  ready_for_check: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  blocked: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  no_damage: "bg-muted/40 text-muted-foreground dark:bg-foreground/[0.08] dark:text-muted-foreground/70",
  archived: "bg-muted/40 text-muted-foreground dark:bg-foreground/[0.08] dark:text-muted-foreground/70",
};

function StatusBadge({ status }: { status: RepairStatus }) {
  const colorClass = STATUS_BADGE_COLORS[status] ?? "bg-muted text-muted-foreground dark:bg-foreground/[0.08] dark:text-muted-foreground/70";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${colorClass}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* ─── Inline editable row ─── */

function InlineRow({ icon: Icon, label, value, field, mono, type, nfcPill, editingField, saving, onChange, onSave, onEdit, onCancel }: {
  icon: any; label: string; value: string; field: string; mono?: boolean; type?: string; nfcPill?: boolean;
  editingField: string | null; saving: boolean;
  onChange: (v: string) => void; onSave: (field: string, value: string) => void;
  onEdit: (f: string) => void; onCancel: () => void;
}) {
  const isEditing = editingField === field;
  return (
    <div className="group/row flex items-center justify-between py-3 border-t border-border/60 dark:border-border first:border-t-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground/70 shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className={`h-7 w-40 text-sm rounded-lg border-border dark:border-border ${mono ? "font-mono text-xs" : ""}`} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSave(field, value); if (e.key === "Escape") onCancel(); }} />
          <button onClick={() => onSave(field, value)} disabled={saving} className="p-1 rounded-lg hover:bg-muted dark:hover:bg-foreground/[0.10] transition-colors"><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></button>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted dark:hover:bg-foreground/[0.10] transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground/70 dark:text-muted-foreground" /></button>
        </div>
      ) : (
        <span
          className={`flex items-center gap-1.5 cursor-pointer transition-colors ${value ? "text-foreground dark:text-foreground hover:text-foreground dark:hover:text-foreground/80" : "text-muted-foreground/50 dark:text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/70"}`}
          onClick={() => onEdit(field)}
        >
          {nfcPill && value ? (
            <span className="bg-muted dark:bg-foreground/[0.08] text-foreground/90 dark:text-muted-foreground/50 rounded-md px-2 py-0.5 text-xs font-mono">{value}</span>
          ) : (
            <span className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 dark:text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}

/* ─── Inline select row ─── */

function InlineSelectRow({ icon: Icon, label, value, field, options, placeholder, chip, editingField, saving, onChange, onSave, onEdit, onCancel }: {
  icon: any; label: string; value: string; field: string; options: string[]; placeholder?: string; chip?: string;
  editingField: string | null; saving: boolean;
  onChange: (v: string) => void; onSave: (field: string, value: string) => void;
  onEdit: (f: string) => void; onCancel: () => void;
}) {
  const isEditing = editingField === field;
  return (
    <div className="group/row flex items-center justify-between py-3 border-t border-border/60 dark:border-border first:border-t-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground dark:text-muted-foreground/70 shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Select value={value} onValueChange={(v) => { onChange(v); onSave(field, v); }}>
            <SelectTrigger className="h-7 w-40 text-sm rounded-lg border-border dark:border-border">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-muted dark:hover:bg-foreground/[0.10] transition-colors"><X className="h-3.5 w-3.5 text-muted-foreground/70 dark:text-muted-foreground" /></button>
        </div>
      ) : (
        <span
          className={`flex items-center gap-1.5 cursor-pointer transition-colors ${value ? "hover:text-foreground dark:hover:text-foreground/80" : "text-muted-foreground/50 dark:text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/70"}`}
          onClick={() => onEdit(field)}
        >
          {chip && value ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}>{value}</span>
          ) : (
            <span className="text-sm font-medium text-foreground dark:text-foreground">{value || "—"}</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/50 dark:text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}
