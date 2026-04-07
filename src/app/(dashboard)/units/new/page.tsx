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

export default function NewUnitPage() {
  const router = useRouter();
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
      router.push(`/units/${unit.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create unit");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">New Unit</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <Card>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="registration">Registration / License</Label>
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
    </div>
  );
}
