"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUnit } from "@/actions/units";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSearch } from "@/components/customers/customer-search";

interface NewUnitFormProps {
  customers: { id: string; name: string }[];
}

export function NewUnitForm({ customers }: NewUnitFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);

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
        length: fd.get("length") || undefined,
        storageLocation: fd.get("storageLocation") || undefined,
        storageType: fd.get("storageType") || undefined,
        currentPosition: fd.get("currentPosition") || undefined,
        nfcTag: fd.get("nfcTag") || undefined,
        notes: fd.get("notes") || undefined,
        customerId: customerId || undefined,
      });
      router.push(`/units/${unit.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create unit");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Customer</Label>
            <div className="mt-1">
              <CustomerSearch
                customers={customers}
                value={customerId ?? undefined}
                onSelect={setCustomerId}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="registration">License Plate</Label>
            <Input id="registration" name="registration" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="year">Year</Label>
            <Input id="year" name="year" type="number" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="chassisId">Chassis / Internal ID</Label>
            <Input id="chassisId" name="chassisId" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="length">Length (m)</Label>
            <Input id="length" name="length" className="mt-1" placeholder="e.g. 5.05" />
          </div>
          <div>
            <Label htmlFor="storageLocation">Storage Location</Label>
            <Select name="storageLocation">
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select location..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cruïllas">Cruïllas</SelectItem>
                <SelectItem value="Sant Climent">Sant Climent</SelectItem>
                <SelectItem value="Peratallada">Peratallada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="storageType">Storage Type</Label>
            <Select name="storageType">
              <SelectTrigger className="mt-1"><SelectValue placeholder="Inside / Outside" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Inside">Inside</SelectItem>
                <SelectItem value="Outside">Outside</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="currentPosition">Current Position</Label>
            <Input id="currentPosition" name="currentPosition" className="mt-1" placeholder="e.g. 2F17" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="nfcTag">NFC Tag</Label>
            <Input id="nfcTag" name="nfcTag" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} className="mt-1" />
          </div>
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner className="mr-2" /> : null}
          Create Unit
        </Button>
      </div>
    </form>
  );
}
