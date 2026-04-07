"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/actions/customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      const customer = await createCustomer({
        name: fd.get("name"),
        phone: fd.get("phone") || undefined,
        email: fd.get("email") || undefined,
        notes: fd.get("notes") || undefined,
      });
      router.push(`/customers/${customer.id}`);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create customer");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">New Customer</h1>
      <form onSubmit={handleSubmit}>
        {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <Card>
          <CardContent className="grid gap-4 p-6">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required className="mt-1" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" className="mt-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} className="mt-1" />
            </div>
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner className="mr-2" /> : null}
            Create Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
