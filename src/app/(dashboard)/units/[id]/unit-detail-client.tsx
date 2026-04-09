"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft, Hash, Truck, Calendar, User, Wrench, StickyNote,
  MapPin, Ruler, Warehouse, Navigation, Tag, Pencil, Save, X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";

type UnitData = NonNullable<Awaited<ReturnType<typeof import("@/actions/units").getUnitById>>>;

interface Props {
  unit: UnitData;
}

export function UnitDetailClient({ unit: initialUnit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const unit = initialUnit;

  // Edit state
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

  function resetFields() {
    setRegistration(unit.registration ?? "");
    setBrand(unit.brand ?? "");
    setModel(unit.model ?? "");
    setYear(unit.year?.toString() ?? "");
    setChassisId(unit.chassisId ?? "");
    setLength(unit.length ?? "");
    setStorageLocation(unit.storageLocation ?? "");
    setStorageType(unit.storageType ?? "");
    setCurrentPosition(unit.currentPosition ?? "");
    setNfcTag(unit.nfcTag ?? "");
    setNotes(unit.notes ?? "");
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUnit(unit.id, {
          registration: registration || undefined,
          brand: brand || undefined,
          model: model || undefined,
          year: year ? parseInt(year) : undefined,
          chassisId: chassisId || undefined,
          length: length || undefined,
          storageLocation: storageLocation || undefined,
          storageType: storageType || undefined,
          currentPosition: currentPosition || undefined,
          nfcTag: nfcTag || undefined,
          notes: notes || undefined,
          customerId: unit.customerId,
        });
        toast.success("Unit updated");
        setEditing(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to save");
      }
    });
  }

  const hasStorage = unit.storageLocation || unit.storageType || unit.currentPosition || unit.nfcTag;

  return (
    <div className="space-y-4 animate-fade-in">
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
          </div>
        </div>
        {!editing ? (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { resetFields(); setEditing(true); }}>
            <Pencil className="h-3 w-3 mr-1.5" /> Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { resetFields(); setEditing(false); }}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs rounded-lg" disabled={isPending} onClick={handleSave}>
              {isPending ? <Spinner className="mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column — Details + Storage */}
        <div className="space-y-4">
          <Card>
            <CardContent>
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Registration</Label>
                      <Input value={registration} onChange={(e) => setRegistration(e.target.value)} className="mt-1 h-8 text-sm rounded-lg font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Year</Label>
                      <Input value={year} onChange={(e) => setYear(e.target.value)} type="number" className="mt-1 h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Brand</Label>
                      <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Model</Label>
                      <Input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Chassis</Label>
                      <Input value={chassisId} onChange={(e) => setChassisId(e.target.value)} className="mt-1 h-8 text-sm rounded-lg font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Length</Label>
                      <Input value={length} onChange={(e) => setLength(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" placeholder="e.g. 7.5m" />
                    </div>
                  </div>

                  {/* Storage fields in edit mode */}
                  <div className="border-t pt-3">
                    <p className="text-[11px] font-semibold mb-2 flex items-center gap-1.5">
                      <Warehouse className="h-3 w-3 text-muted-foreground" /> Storage & Location
                    </p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Location</Label>
                          <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Type</Label>
                          <Input value={storageType} onChange={(e) => setStorageType(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Position</Label>
                          <Input value={currentPosition} onChange={(e) => setCurrentPosition(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">NFC Tag</Label>
                          <Input value={nfcTag} onChange={(e) => setNfcTag(e.target.value)} className="mt-1 h-8 text-sm rounded-lg font-mono" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes in edit mode */}
                  <div className="border-t pt-3">
                    <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 text-sm rounded-lg min-h-[80px]" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <Row icon={Hash} label="Registration" value={unit.registration} mono />
                  <Row icon={Truck} label="Brand" value={unit.brand} />
                  <Row icon={Truck} label="Model" value={unit.model} />
                  <Row icon={Calendar} label="Year" value={unit.year?.toString()} />
                  <Row icon={Hash} label="Chassis" value={unit.chassisId} mono small />
                  {unit.length && <Row icon={Ruler} label="Length" value={`${unit.length}m`} />}
                  {unit.customer && (
                    <div className="flex items-center justify-between border-t pt-2 mt-2">
                      <span className="flex items-center gap-2 text-muted-foreground"><User className="h-3.5 w-3.5" /> Owner</span>
                      <Link href={`/customers/${unit.customer.id}`} className="font-medium text-primary hover:underline text-xs">{unit.customer.name}</Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Storage card (view mode only — edit is inline above) */}
          {!editing && hasStorage && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Storage & Location</p>
                </div>
                <div className="space-y-2 text-sm">
                  {unit.storageLocation && <Row icon={MapPin} label="Storage" value={unit.storageLocation} />}
                  {unit.storageType && <Row icon={Warehouse} label="Type" value={unit.storageType} />}
                  {unit.currentPosition && <Row icon={Navigation} label="Position" value={unit.currentPosition} />}
                  {unit.nfcTag && <Row icon={Tag} label="NFC Tag" value={unit.nfcTag} mono small />}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes card (view mode only) */}
          {!editing && unit.notes && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Notes</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{unit.notes}</p>
              </CardContent>
            </Card>
          )}
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
                {unit.repairJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/repairs/${job.id}`}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
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

function Row({ icon: Icon, label, value, mono, small }: {
  icon: any; label: string; value?: string | null; mono?: boolean; small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</span>
      <span className={`font-medium ${mono ? "font-mono" : ""} ${small ? "text-xs" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
