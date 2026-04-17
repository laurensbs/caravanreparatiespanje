"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
import { getUnitTags, addTagToUnit, removeTagFromUnit } from "@/actions/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { UnitTypeIconBadge } from "./unit-type-icon";
import { UNIT_TYPE_LABELS } from "@/types";
import type { UnitType } from "@/types";

interface UnitRow {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  unitType?: string | null;
  chassisId: string | null;
  length: string | null;
  storageLocation: string | null;
  storageType: string | null;
  currentPosition: string | null;
  nfcTag: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UnitDialogProps {
  unit: UnitRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTags?: TagItem[];
}

export function UnitDialog({ unit, open, onOpenChange, allTags = [] }: UnitDialogProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [unitTags, setUnitTags] = useState<TagItem[]>([]);
  const [editUnitType, setEditUnitType] = useState<UnitType>("unknown");

  useEffect(() => {
    if (open && allTags.length > 0) {
      getUnitTags(unit.id).then(setUnitTags);
    }
  }, [open, unit.id, allTags.length]);

  useEffect(() => {
    const u = unit.unitType;
    if (u === "caravan" || u === "trailer" || u === "camper" || u === "unknown") setEditUnitType(u);
    else setEditUnitType("unknown");
  }, [open, unit.id, unit.unitType]);

  const handleSave = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");

    startTransition(async () => {
      try {
        await updateUnit(unit.id, {
          unitType: editUnitType,
          registration: fd.get("registration") || null,
          brand: fd.get("brand") || null,
          model: fd.get("model") || null,
          year: fd.get("year") ? Number(fd.get("year")) : null,
          chassisId: fd.get("chassisId") || null,
          length: fd.get("length") || null,
          storageLocation: fd.get("storageLocation") || null,
          storageType: fd.get("storageType") || null,
          currentPosition: fd.get("currentPosition") || null,
          nfcTag: fd.get("nfcTag") || null,
          notes: fd.get("notes") || null,
        });
        setEditing(false);
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save");
      }
    });
  }, [unit.id, router, editUnitType]);

  const handleClose = useCallback((v: boolean) => {
    if (!v) setEditing(false);
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pb-0 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:pr-8">
            <div className="flex min-w-0 items-start gap-3">
              <UnitTypeIconBadge unitType={unit.unitType} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unit"}
                </DialogTitle>
                <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
                  {unit.registration ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!editing && (
                <Button type="button" size="sm" variant="outline" className="h-9 touch-manipulation text-xs" onClick={() => setEditing(true)}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                </Button>
              )}
              <Button type="button" size="sm" variant="default" className="h-9 touch-manipulation text-xs" asChild>
                <Link href={`/units/${unit.id}`}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Full page
                </Link>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-6rem)]">
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4 px-6 pb-6 pt-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="u-type">Vehicle type</Label>
                  <Select value={editUnitType} onValueChange={(v) => setEditUnitType(v as UnitType)}>
                    <SelectTrigger id="u-type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {UNIT_TYPE_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="u-reg">License Plate</Label>
                  <Input id="u-reg" name="registration" defaultValue={unit.registration ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="u-brand">Brand</Label>
                  <Input id="u-brand" name="brand" defaultValue={unit.brand ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="u-model">Model</Label>
                  <Input id="u-model" name="model" defaultValue={unit.model ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="u-year">Year</Label>
                  <Input id="u-year" name="year" type="number" defaultValue={unit.year ?? ""} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="u-chassis">Chassis ID</Label>
                  <Input id="u-chassis" name="chassisId" defaultValue={unit.chassisId ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="u-length">Length (m)</Label>
                  <Input id="u-length" name="length" defaultValue={unit.length ?? ""} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="u-storageLocation">Storage Location</Label>
                  <Select name="storageLocation" defaultValue={unit.storageLocation ?? ""}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cruïllas">Cruïllas</SelectItem>
                      <SelectItem value="Sant Climent">Sant Climent</SelectItem>
                      <SelectItem value="Peratallada">Peratallada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="u-storageType">Storage Type</Label>
                  <Select name="storageType" defaultValue={unit.storageType ?? ""}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Inside / Outside" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inside">Inside</SelectItem>
                      <SelectItem value="Outside">Outside</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="u-currentPosition">Current Position</Label>
                  <Input id="u-currentPosition" name="currentPosition" defaultValue={unit.currentPosition ?? ""} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="u-nfcTag">NFC Tag</Label>
                  <Input id="u-nfcTag" name="nfcTag" defaultValue={unit.nfcTag ?? ""} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="u-notes">Notes</Label>
                  <Textarea id="u-notes" name="notes" rows={3} className="mt-1" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending && <Spinner className="mr-2" />}
                  Save
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 px-6 pb-6 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailField
                  label="Type"
                  value={
                    unit.unitType && unit.unitType in UNIT_TYPE_LABELS
                      ? UNIT_TYPE_LABELS[unit.unitType as UnitType]
                      : UNIT_TYPE_LABELS.unknown
                  }
                />
                <DetailField label="License Plate" value={unit.registration} mono />
                <DetailField label="Brand" value={unit.brand} />
                <DetailField label="Model" value={unit.model} />
                <DetailField label="Year" value={unit.year?.toString()} />
                <DetailField label="Chassis ID" value={unit.chassisId} mono />
                <DetailField label="Length" value={unit.length ? `${unit.length}m` : null} />
                <DetailField label="Storage" value={unit.storageLocation} />
                <DetailField label="Storage Type" value={unit.storageType} />
                <DetailField label="Position" value={unit.currentPosition} />
                {unit.nfcTag && <DetailField label="NFC Tag" value={unit.nfcTag} mono />}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Customer</p>
                  {unit.customerName ? (
                    <Link href={`/customers/${unit.customerId}`} className="text-sm font-medium hover:underline">
                      {unit.customerName}
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
              </div>
              {allTags.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                  <TagPicker
                    allTags={allTags}
                    activeTags={unitTags}
                    onAdd={async (tagId) => { await addTagToUnit(unit.id, tagId); setUnitTags(await getUnitTags(unit.id)); }}
                    onRemove={async (tagId) => { await removeTagFromUnit(unit.id, tagId); setUnitTags(await getUnitTags(unit.id)); }}
                  />
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                Updated {new Date(unit.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""} ${!value ? "text-muted-foreground" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}
