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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function NewUnitDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      const unit = await createUnit({
        registration: fd.get("registration") || undefined,
        brand: fd.get("brand") || undefined,
        model: fd.get("model") || undefined,
        year: fd.get("year") ? Number(fd.get("year")) : undefined,
        chassisId: fd.get("chassisId") || undefined,
        notes: fd.get("notes") || undefined,
      });
      setOpen(false);
      toast.success("Unit created");
      router.push(`/units/${unit.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create unit");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm" className="rounded-lg">
        <Plus className="mr-2 h-4 w-4" />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-reg" className="text-xs">Registration</Label>
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
