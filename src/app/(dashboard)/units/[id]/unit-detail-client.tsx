"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type UnitData = NonNullable<Awaited<ReturnType<typeof import("@/actions/units").getUnitById>>>;

interface Props {
  unit: UnitData;
  allTags?: TagItem[];
}

export function UnitDetailClient({ unit: initialUnit, allTags = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const unit = initialUnit;

  // Edit state per field
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
        // Send current values for all fields, overriding the one being saved
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
            <Link href="/units"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unit"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {unit.registration && <span className="font-mono">{unit.registration}</span>}
              {unit.customer && (
                <>
                  <span>·</span>
                  <Link href={`/customers/${unit.customer.id}`} className="text-primary hover:underline">{unit.customer.name}</Link>
                </>
              )}
            </div>
            {/* Tags */}
            <div className="mt-1.5">
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column — Details + Storage + Notes */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-0 divide-y">
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
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> Owner</span>
                  <Link href={`/customers/${unit.customer.id}`} className="font-medium text-primary hover:underline text-xs">{unit.customer.name}</Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-0 divide-y">
              <div className="pb-1 pt-0.5">
                <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Warehouse className="h-3 w-3" /> Storage & Location
                </p>
              </div>
              <InlineSelectRow icon={MapPin} label="Location" value={storageLocation} field="storageLocation"
                options={["Cruïllas", "Sant Climent", "Peratallada"]} placeholder="Select location..."
                editingField={editingField} saving={isPending} onChange={setStorageLocation} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineSelectRow icon={Warehouse} label="Type" value={storageType} field="storageType"
                options={["Inside", "Outside"]} placeholder="Inside / Outside"
                editingField={editingField} saving={isPending} onChange={setStorageType} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Navigation} label="Position" value={currentPosition} field="currentPosition"
                editingField={editingField} saving={isPending} onChange={setCurrentPosition} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
              <InlineRow icon={Tag} label="NFC Tag" value={nfcTag} field="nfcTag" mono
                editingField={editingField} saving={isPending} onChange={setNfcTag} onSave={saveField} onEdit={setEditingField} onCancel={() => setEditingField(null)} />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent>
              <div className="group/notes">
                <div className="flex items-center justify-between mb-1">
                  <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <StickyNote className="h-3 w-3" /> Notes
                  </p>
                  {editingField !== "notes" && (
                    <button onClick={() => setEditingField("notes")} className="opacity-0 group-hover/notes:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {editingField === "notes" ? (
                  <div className="space-y-1.5">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-sm rounded-lg" autoFocus />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[11px] rounded-lg" onClick={() => saveField("notes", notes)} disabled={isPending}>Save</Button>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => { setNotes(unit.notes ?? ""); setEditingField(null); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer hover:text-foreground transition-colors" onClick={() => setEditingField("notes")}>
                    {notes || <span className="italic text-xs">Click to add notes</span>}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Repairs */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Repairs ({unit.repairJobs.length})</p>
            </div>
            {unit.repairJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No repairs for this unit</p>
            ) : (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {unit.repairJobs.map((job, idx) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border ring-1 ring-border/50 p-2.5 text-sm hover:bg-muted/50 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all animate-slide-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    <div className="min-w-0 mr-2">
                      <p className="font-medium text-[13px] truncate">{job.title || "Unnamed"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{job.publicCode}</p>
                    </div>
                    <Badge variant="secondary" className={`${STATUS_COLORS[job.status as RepairStatus]} rounded-full text-[10px] px-2 py-0 shrink-0`}>
                      {STATUS_LABELS[job.status as RepairStatus]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InlineRow({ icon: Icon, label, value, field, mono, type, editingField, saving, onChange, onSave, onEdit, onCancel }: {
  icon: any; label: string; value: string; field: string; mono?: boolean; type?: string;
  editingField: string | null; saving: boolean;
  onChange: (v: string) => void; onSave: (field: string, value: string) => void;
  onEdit: (f: string) => void; onCancel: () => void;
}) {
  const isEditing = editingField === field;
  return (
    <div className="group/row flex items-center justify-between py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className={`h-6 w-36 text-xs rounded-md ${mono ? "font-mono" : ""}`} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") onSave(field, value); if (e.key === "Escape") onCancel(); }} />
          <button onClick={() => onSave(field, value)} disabled={saving} className="p-0.5 rounded hover:bg-muted"><Check className="h-3 w-3 text-green-600" /></button>
          <button onClick={onCancel} className="p-0.5 rounded hover:bg-muted"><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      ) : (
        <span className={`flex items-center gap-1 font-medium cursor-pointer hover:text-primary transition-colors ${mono ? "font-mono text-xs" : ""}`} onClick={() => onEdit(field)}>
          {value || "—"}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}

function InlineSelectRow({ icon: Icon, label, value, field, options, placeholder, editingField, saving, onChange, onSave, onEdit, onCancel }: {
  icon: any; label: string; value: string; field: string; options: string[]; placeholder?: string;
  editingField: string | null; saving: boolean;
  onChange: (v: string) => void; onSave: (field: string, value: string) => void;
  onEdit: (f: string) => void; onCancel: () => void;
}) {
  const isEditing = editingField === field;
  return (
    <div className="group/row flex items-center justify-between py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground shrink-0"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1">
          <Select value={value} onValueChange={(v) => { onChange(v); onSave(field, v); }}>
            <SelectTrigger className="h-6 w-36 text-xs rounded-md">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={onCancel} className="p-0.5 rounded hover:bg-muted"><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      ) : (
        <span className="flex items-center gap-1 font-medium cursor-pointer hover:text-primary transition-colors" onClick={() => onEdit(field)}>
          {value || "—"}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity" />
        </span>
      )}
    </div>
  );
}
