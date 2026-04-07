"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ExternalLink, Phone, Mail, User } from "lucide-react";
import { createSupplier, updateSupplier, deleteSupplier } from "@/actions/parts";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
}

interface SuppliersClientProps {
  suppliers: Supplier[];
}

export function SuppliersClient({ suppliers }: SuppliersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setDialogOpen(true);
  }

  function handleDelete(supplier: Supplier) {
    if (!confirm(`Delete supplier "${supplier.name}"? Parts linked to this supplier will be unlinked.`)) return;
    startTransition(async () => {
      await deleteSupplier(supplier.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            </DialogHeader>
            <SupplierForm
              supplier={editing}
              onDone={() => {
                setDialogOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No suppliers yet. Click &quot;Add Supplier&quot; to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(s)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                {s.contactName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{s.contactName}</span>
                  </div>
                )}
                {s.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <a href={`tel:${s.phone}`} className="hover:text-foreground">{s.phone}</a>
                  </div>
                )}
                {s.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <a href={`mailto:${s.email}`} className="hover:text-foreground">{s.email}</a>
                  </div>
                )}
                {s.website && (
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={s.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {s.website.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}
                {s.notes && (
                  <p className="text-xs text-muted-foreground pt-1 border-t mt-2">{s.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierForm({
  supplier,
  onDone,
}: {
  supplier: Supplier | null;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactName, setContactName] = useState(supplier?.contactName ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [website, setWebsite] = useState(supplier?.website ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      if (supplier) {
        await updateSupplier(supplier.id, {
          name: name.trim(),
          contactName: contactName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await createSupplier({
          name: name.trim(),
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sup-name">Name *</Label>
        <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Obelink" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-contact">Contact Person</Label>
        <Input id="sup-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sup-phone">Phone</Label>
          <Input id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 ..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sup-email">Email</Label>
          <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@..." />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-website">Website</Label>
        <Input id="sup-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sup-notes">Notes</Label>
        <Textarea id="sup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery times, payment terms..." rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Saving..." : supplier ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
