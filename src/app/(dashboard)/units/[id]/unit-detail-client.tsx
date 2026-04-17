"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Hash, Truck, Calendar, User, Wrench, StickyNote,
  MapPin, Ruler, Warehouse, Navigation, Tag, Pencil, Check, X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { addTagToUnit, removeTagFromUnit } from "@/actions/tags";
import { UnitTypeIconBadge } from "@/components/units/unit-type-icon";

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="mb-8">
        <Link href="/units" className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Units
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <UnitTypeIconBadge unitType={unit.unitType} className="mt-1" />
            <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{unitTitle}</h1>
            <div className="flex items-center gap-3 mt-1.5">
              {unit.registration && (
                <span className="font-mono text-sm text-gray-500 dark:text-gray-400">{unit.registration}</span>
              )}
              {unit.customer && (
                <>
                  {unit.registration && <span className="text-gray-300 dark:text-gray-600">·</span>}
                  <Link href={`/customers/${unit.customer.id}`} className="text-sm text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors">
                    {unit.customer.name}
                  </Link>
                </>
              )}
              {storageLocation && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                    <MapPin className="h-3 w-3" />
                    {storageLocation}
                  </span>
                </>
              )}
              {unit.repairJobs.length > 0 && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{unit.repairJobs.length} repair{unit.repairJobs.length !== 1 ? "s" : ""}</span>
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

        {/* Left column — Info + Storage + Notes */}
        <div className="lg:col-span-5 space-y-6">

          {/* Unit Info */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 pt-5 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Unit Details</p>
            </div>
            <div className="px-5 pb-5">
              <InlineRow icon={Hash} label="License Plate" value={registration} field="registration" mono
                editingField={editingField} saving={isPending} onChange={setRegistration} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Truck} label="Brand" value={brand} field="brand"
                editingField={editingField} saving={isPending} onChange={setBrand} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Truck} label="Model" value={model} field="model"
                editingField={editingField} saving={isPending} onChange={setModel} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Calendar} label="Year" value={year} field="year" type="number"
                editingField={editingField} saving={isPending} onChange={setYear} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Hash} label="Chassis" value={chassisId} field="chassisId" mono
                editingField={editingField} saving={isPending} onChange={setChassisId} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Ruler} label="Length" value={length} field="length"
                editingField={editingField} saving={isPending} onChange={setLength} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              {unit.customer && (
                <div className="group/row flex items-center justify-between py-3 border-t border-gray-50 dark:border-gray-800">
                  <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"><User className="h-3.5 w-3.5" /> Owner</span>
                  <Link href={`/customers/${unit.customer.id}`} className="text-sm font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 transition-colors">{unit.customer.name}</Link>
                </div>
              )}
            </div>
          </div>

          {/* Storage & Location */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 pt-5 pb-1">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <Warehouse className="h-3 w-3" /> Storage & Location
              </p>
            </div>
            <div className="px-5 pb-5">
              <InlineSelectRow icon={MapPin} label="Location" value={storageLocation} field="storageLocation"
                options={["Cruïllas", "Sant Climent", "Peratallada"]} placeholder="Select location..."
                editingField={editingField} saving={isPending} onChange={setStorageLocation} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineSelectRow icon={Warehouse} label="Type" value={storageType} field="storageType"
                options={["Inside", "Outside"]} placeholder="Inside / Outside"
                editingField={editingField} saving={isPending} onChange={setStorageType} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)}
                chip={storageType === "Inside" ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400" : storageType === "Outside" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : undefined} />
              <InlineRow icon={Navigation} label="Position" value={currentPosition} field="currentPosition"
                editingField={editingField} saving={isPending} onChange={setCurrentPosition} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Tag} label="NFC Tag" value={nfcTag} field="nfcTag" mono nfcPill
                editingField={editingField} saving={isPending} onChange={setNfcTag} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 pt-5 pb-1">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <StickyNote className="h-3 w-3" /> Notes
                </p>
                {editingField !== "notes" && (
                  <button onClick={() => setEditingField("notes")} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                    <Pencil className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  </button>
                )}
              </div>
            </div>
            <div className="px-5 pb-5 group">
              {editingField === "notes" ? (
                <div className="space-y-2 mt-2">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-sm rounded-xl border-gray-200 dark:border-gray-700 resize-none" autoFocus />
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-xs rounded-xl px-3" onClick={() => saveField("notes", notes)} disabled={isPending}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-xl" onClick={() => { setNotes(unit.notes ?? ""); setEditingField(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="mt-2 min-h-[60px] rounded-xl cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 px-3 py-2.5 -mx-3"
                  onClick={() => setEditingField("notes")}
                >
                  {notes ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{notes}</p>
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">Click to add notes</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column — Repairs */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-center gap-2.5">
                <Wrench className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Repairs</p>
                {unit.repairJobs.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-medium px-1.5">
                    {unit.repairJobs.length}
                  </span>
                )}
              </div>
            </div>

            <div className="px-5 pb-5">
              {unit.repairJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30 py-10 text-center">
                  <Wrench className="h-7 w-7 text-gray-300 dark:text-gray-600 mx-auto mb-2.5" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No repairs for this unit</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto">
                  {unit.repairJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/repairs/${job.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-150 cursor-pointer group"
                    >
                      <div className="min-w-0 mr-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">{job.title || "Unnamed"}</p>
                        <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{job.publicCode}</p>
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
    </div>
  );
}

/* ─── Status badge ─── */

const STATUS_BADGE_COLORS: Partial<Record<RepairStatus, string>> = {
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  waiting_approval: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  waiting_customer: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  waiting_parts: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  in_progress: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  scheduled: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  quote_needed: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  in_inspection: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  ready_for_check: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  blocked: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  no_damage: "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  archived: "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function StatusBadge({ status }: { status: RepairStatus }) {
  const colorClass = STATUS_BADGE_COLORS[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
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
    <div className="group/row flex items-center justify-between py-3 border-t border-gray-50 dark:border-gray-800 first:border-t-0">
      <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className={`h-7 w-40 text-sm rounded-lg border-gray-200 dark:border-gray-700 ${mono ? "font-mono text-xs" : ""}`} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSave(field, value); if (e.key === "Escape") onCancel(); }} />
          <button onClick={() => onSave(field, value)} disabled={saving} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></button>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /></button>
        </div>
      ) : (
        <span
          className={`flex items-center gap-1.5 cursor-pointer transition-colors ${value ? "text-gray-900 dark:text-gray-100 hover:text-sky-700 dark:hover:text-sky-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"}`}
          onClick={() => onEdit(field)}
        >
          {nfcPill && value ? (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md px-2 py-0.5 text-xs font-mono">{value}</span>
          ) : (
            <span className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value || "—"}</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
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
    <div className="group/row flex items-center justify-between py-3 border-t border-gray-50 dark:border-gray-800 first:border-t-0">
      <span className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Select value={value} onValueChange={(v) => { onChange(v); onSave(field, v); }}>
            <SelectTrigger className="h-7 w-40 text-sm rounded-lg border-gray-200 dark:border-gray-700">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" /></button>
        </div>
      ) : (
        <span
          className={`flex items-center gap-1.5 cursor-pointer transition-colors ${value ? "hover:text-sky-700 dark:hover:text-sky-400" : "text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400"}`}
          onClick={() => onEdit(field)}
        >
          {chip && value ? (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${chip}`}>{value}</span>
          ) : (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value || "—"}</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}
