"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/actions/customers";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { HoldedHint } from "@/components/holded-hint";

export function NewCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contactType, setContactType] = useState<"person" | "business">("person");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    try {
      const customer = await createCustomer({
        name: fd.get("name"),
        contactType,
        phone: fd.get("phone") || undefined,
        email: fd.get("email") || undefined,
        notes: fd.get("notes") || undefined,
      });
      setOpen(false);
      toast.success("Contact created");
      router.push(`/customers/${customer.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create contact");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-[#0CC0DF] text-white text-sm font-medium rounded-xl px-4 py-2.5 shadow-sm hover:bg-[#0bb0cc] transition-all duration-150"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Contact
      </button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Contact</DialogTitle>
          <DialogDescription>Add a new contact to the system</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-name" className="text-xs">Name *</Label>
              <Input id="dlg-name" name="name" required className="mt-1 h-9 rounded-lg" autoFocus />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={contactType} onValueChange={(v) => setContactType(v as "person" | "business")}>
                <SelectTrigger className="mt-1 h-9 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="person">Person</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="dlg-phone" className="text-xs">Phone</Label>
              <Input id="dlg-phone" name="phone" className="mt-1 h-9 rounded-lg" />
            </div>
            <div>
              <Label htmlFor="dlg-email" className="text-xs">Email</Label>
              <Input id="dlg-email" name="email" type="email" className="mt-1 h-9 rounded-lg" />
            </div>
          </div>
          <div>
            <Label htmlFor="dlg-notes" className="text-xs">Notes</Label>
            <Textarea id="dlg-notes" name="notes" rows={2} className="mt-1 rounded-lg" />
          </div>
          <HoldedHint variant="info">
            Contact is saved locally. If you add phone or email, it will also be created in <strong>Holded</strong> on next sync.
          </HoldedHint>
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
