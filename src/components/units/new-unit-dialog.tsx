"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUnit } from "@/actions/units";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { UNIT_TYPE_LABELS } from "@/types";
import type { UnitType } from "@/types";
import { toast } from "sonner";
import { CustomerSearch } from "@/components/customers/customer-search";

interface NewUnitDialogProps {
  customers?: { id: string; name: string }[];
}

export function NewUnitDialog({ customers = [] }: NewUnitDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<UnitType>("caravan");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      const unit = await createUnit({
        unitType,
        registration: fd.get("registration") || undefined,
        brand: fd.get("brand") || undefined,
        model: fd.get("model") || undefined,
        year: fd.get("year") ? Number(fd.get("year")) : undefined,
        chassisId: fd.get("chassisId") || undefined,
        length: fd.get("length") || undefined,
        storageLocation: fd.get("storageLocation") || undefined,
        storageType: fd.get("storageType") || undefined,
        currentPosition: fd.get("currentPosition") || undefined,
        nfcTag: fd.get("nfcTag") || undefined,
        notes: fd.get("notes") || undefined,
        customerId: customerId || undefined,
      });
      setOpen(false);
      setCustomerId(null);
      setUnitType("caravan");
      toast.success("Unit created");
      router.push(`/units/${unit.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create unit");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCustomerId(null); setUnitType("caravan"); } }}>
      <Button type="button" onClick={() => setOpen(true)} className="h-11 touch-manipulation gap-2 rounded-xl px-4 shadow-sm">
        <Plus className="h-4 w-4" />
        Add Unit
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Unit</DialogTitle>
          <DialogDescription>Register a new caravan, trailer or camper</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
          )}
          <div>
            <Label className="text-xs">Customer</Label>
            <div className="mt-1">
              <CustomerSearch
                customers={customers}
                value={customerId ?? undefined}
                onSelect={setCustomerId}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Vehicle type</Label>
            <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
              <SelectTrigger className="mt-1 h-10 rounded-lg">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-reg" className="text-xs">License Plate</Label>
              <Input id="dlg-reg" name="registration" className="mt-1 h-9 rounded-lg" autoFocus />
            </div>
            <div>
              <Label htmlFor="dlg-brand" className="text-xs">Brand</Label>
              <Input id="dlg-brand" name="brand" className="mt-1 h-9 rounded-lg" />
            </div>
            <div>
              <Label htmlFor="dlg-model" className="text-xs">Model</Label>
              <Input id="dlg-model" name="model" className="mt-1 h-9 rounded-lg" />
            </div>
            <div>
              <Label htmlFor="dlg-year" className="text-xs">Year</Label>
              <Input id="dlg-year" name="year" type="number" className="mt-1 h-9 rounded-lg" />
            </div>
          </div>
          <div>
            <Label htmlFor="dlg-chassis" className="text-xs">Chassis / Internal ID</Label>
            <Input id="dlg-chassis" name="chassisId" className="mt-1 h-9 rounded-lg" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-length" className="text-xs">Length (m)</Label>
              <Input id="dlg-length" name="length" className="mt-1 h-9 rounded-lg" placeholder="e.g. 5.05" />
            </div>
            <div>
              <Label htmlFor="dlg-storageType" className="text-xs">Storage Type</Label>
              <Input id="dlg-storageType" name="storageType" className="mt-1 h-9 rounded-lg" placeholder="Outside, Inside" />
            </div>
            <div>
              <Label htmlFor="dlg-storageLocation" className="text-xs">Storage Location</Label>
              <Input id="dlg-storageLocation" name="storageLocation" className="mt-1 h-9 rounded-lg" />
            </div>
            <div>
              <Label htmlFor="dlg-currentPosition" className="text-xs">Current Position</Label>
              <Input id="dlg-currentPosition" name="currentPosition" className="mt-1 h-9 rounded-lg" />
            </div>
          </div>
          <div>
            <Label htmlFor="dlg-notes" className="text-xs">Notes</Label>
            <Textarea id="dlg-notes" name="notes" rows={2} className="mt-1 rounded-lg" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving} className="rounded-lg">
              {saving ? <Spinner className="mr-2" /> : null}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
