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
import { confirmDialog } from "@/components/ui/confirm-dialog";

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

  async function handleDelete(supplier: Supplier) {
    const ok = await confirmDialog({
      title: `Delete supplier "${supplier.name}"?`,
      description: "Parts linked to this supplier will be unlinked.",
      tone: "destructive",
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteSupplier(supplier.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-stretch sm:justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={openCreate} className="h-11 w-full touch-manipulation gap-2 sm:h-10 sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-md">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="group relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{s.name}</CardTitle>
                  <div className="flex shrink-0 gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 touch-manipulation" onClick={() => openEdit(s)} aria-label="Edit supplier">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 touch-manipulation text-destructive hover:text-destructive"
                      onClick={() => handleDelete(s)}
                      disabled={isPending}
                      aria-label="Delete supplier"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sup-phone">Phone</Label>
          <Input id="sup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 ..." className="h-11 touch-manipulation" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sup-email">Email</Label>
          <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@..." className="h-11 touch-manipulation" />
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
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={isPending || !name.trim()} className="h-11 w-full touch-manipulation sm:h-10 sm:w-auto">
          {isPending ? "Saving..." : supplier ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
