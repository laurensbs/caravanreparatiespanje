"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateUnit } from "@/actions/units";
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
import { Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";

interface UnitRow {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  chassisId: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UnitDialogProps {
  unit: UnitRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnitDialog({ unit, open, onOpenChange }: UnitDialogProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleSave = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError("");

    startTransition(async () => {
      try {
        await updateUnit(unit.id, {
          registration: fd.get("registration") || null,
          brand: fd.get("brand") || null,
          model: fd.get("model") || null,
          year: fd.get("year") ? Number(fd.get("year")) : null,
          chassisId: fd.get("chassisId") || null,
          notes: fd.get("notes") || null,
        });
        setEditing(false);
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save");
      }
    });
  }, [unit.id, router]);

  const handleClose = useCallback((v: boolean) => {
    if (!v) setEditing(false);
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg">
              {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unit"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!editing && (
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/units/${unit.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Full page
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
                  <Label htmlFor="u-reg">Registration</Label>
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
                <DetailField label="Registration" value={unit.registration} mono />
                <DetailField label="Brand" value={unit.brand} />
                <DetailField label="Model" value={unit.model} />
                <DetailField label="Year" value={unit.year?.toString()} />
                <DetailField label="Chassis ID" value={unit.chassisId} mono />
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
