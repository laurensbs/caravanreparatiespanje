"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRepairJob } from "@/actions/repairs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/types";

interface RepairFormProps {
  locations: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}

export function RepairForm({ locations, customers }: RepairFormProps) {
  const router = useRouter();
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

    // Convert "none" sentinel values to null
    if (data.locationId === "none") data.locationId = null;
    if (data.customerId === "none") data.customerId = null;

    try {
      const job = await createRepairJob(data);
      router.push(`/repairs/${job.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create repair job");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Basic Information</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Brief summary of the repair" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
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
            <Label htmlFor="priority">Priority</Label>
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
            <Label htmlFor="locationId">Location</Label>
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
            <Label htmlFor="customerId">Customer</Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="descriptionRaw">Issue Description</Label>
            <Textarea
              id="descriptionRaw"
              name="descriptionRaw"
              placeholder="Full description of the issue, damage, or requested work..."
              rows={5}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="partsNeededRaw">Parts Needed</Label>
            <Textarea
              id="partsNeededRaw"
              name="partsNeededRaw"
              placeholder="List any parts required..."
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notesRaw">Notes</Label>
            <Textarea id="notesRaw" name="notesRaw" placeholder="Additional notes..." rows={3} className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cost & Time</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="estimatedCost">Estimated Cost (€)</Label>
            <Input id="estimatedCost" name="estimatedCost" type="number" step="0.01" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="estimatedHours">Estimated Hours</Label>
            <Input id="estimatedHours" name="estimatedHours" type="number" step="0.25" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner className="mr-2" /> : null}
          Create Repair Job
        </Button>
      </div>
    </form>
  );
}
