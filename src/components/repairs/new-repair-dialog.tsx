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
import { CustomerSearch } from "@/components/customers/customer-search";
import { LocationSelect } from "@/components/repairs/location-select";
import { PartsPicker, type SelectedPart } from "@/components/parts/parts-picker";
import { createPartRequest } from "@/actions/parts";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";

interface CatalogPart {
  id: string;
  name: string;
  partNumber: string | null;
  defaultCost: string | null;
  orderUrl: string | null;
}

interface NewRepairDialogProps {
  locations: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  partsCatalog?: CatalogPart[];
}

export function NewRepairDialog({ locations, customers, partsCatalog = [] }: NewRepairDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);

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
      setCustomerId(null);
      setSelectedParts([]);
      toast.success("Repair job created");
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
                <PrioritySelect name="priority" defaultValue="normal" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="dlg-location">Location</Label>
                <div className="mt-1">
                  <LocationSelect name="locationId" locations={locations} />
                </div>
              </div>
              <div>
                <Label htmlFor="dlg-customer">Customer</Label>
                <div className="mt-1">
                  <CustomerSearch
                    customers={customers}
                    value={customerId ?? undefined}
                    onSelect={setCustomerId}
                  />
                </div>
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
                <Label>Parts from Catalog</Label>
                <div className="mt-1">
                  <PartsPicker catalog={partsCatalog} value={selectedParts} onChange={setSelectedParts} />
                </div>
              </div>
              <div>
                <Label htmlFor="dlg-parts">Additional Parts (free text)</Label>
                <Textarea
                  id="dlg-parts"
                  name="partsNeededRaw"
                  placeholder="Any parts not in the catalog..."
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
