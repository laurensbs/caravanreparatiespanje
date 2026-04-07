"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRepairJob } from "@/actions/repairs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";
import { Plus } from "lucide-react";

interface NewRepairDialogProps {
  locations: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}

export function NewRepairDialog({ locations, customers }: NewRepairDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    if (data.customerId === "none") data.customerId = null;

    try {
      const job = await createRepairJob(data);
      setOpen(false);
      router.push(`/repairs/${job.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create repair job");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New Repair
      </Button>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>New Repair Job</DialogTitle>
          <DialogDescription>Create a new repair job entry</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6 pt-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="dlg-title">Title</Label>
                <Input id="dlg-title" name="title" placeholder="Brief summary of the repair" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="dlg-status">Status</Label>
                <Select name="status" defaultValue="new">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dlg-priority">Priority</Label>
                <Select name="priority" defaultValue="normal">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dlg-location">Location</Label>
                <Select name="locationId" defaultValue="none">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dlg-customer">Customer</Label>
                <Select name="customerId" defaultValue="none">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No customer</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="dlg-desc">Issue Description</Label>
                <Textarea
                  id="dlg-desc"
                  name="descriptionRaw"
                  placeholder="Description of the issue, damage, or work..."
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dlg-parts">Parts Needed</Label>
                <Textarea
                  id="dlg-parts"
                  name="partsNeededRaw"
                  placeholder="List any parts required..."
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dlg-notes">Notes</Label>
                <Textarea id="dlg-notes" name="notesRaw" placeholder="Additional notes..." rows={2} className="mt-1" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dlg-cost">Estimated Cost (€)</Label>
                <Input id="dlg-cost" name="estimatedCost" type="number" step="0.01" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="dlg-hours">Estimated Hours</Label>
                <Input id="dlg-hours" name="estimatedHours" type="number" step="0.25" className="mt-1" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="mr-2" /> : null}
                Create Repair Job
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
