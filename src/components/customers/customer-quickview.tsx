"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExternalLink, Phone, Mail, Wrench, Pencil, Save } from "lucide-react";
import Link from "next/link";
import { SmartDate } from "@/components/ui/smart-date";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerRow {
  id: string;
  name: string;
  contactType: string;
  holdedContactId: string | null;
  repairCount: number;
  phone: string | null;
  email: string | null;
  updatedAt: Date;
}

interface Props {
  customers: CustomerRow[];
}

export function CustomersTableClient({ customers }: Props) {
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  return (
    <>
      <TableBody>
        {customers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-16 text-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Wrench className="h-8 w-8 opacity-20" />
                <p className="font-medium text-sm">No contacts found</p>
                <p className="text-xs">Try adjusting your search or filters</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          customers.map((c, idx) => (
            <TableRow
              key={c.id}
              className="group interactive-row table-row-animate"
              style={{ animationDelay: `${idx * 20}ms` }}
              onClick={() => setSelected(c)}
            >
              <TableCell>
                <span className="font-medium text-[13px] group-hover:text-primary transition-colors">
                  {c.name}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                  {c.contactType === "business" ? "Business" : "Person"}
                </Badge>
                {c.holdedContactId && (
                  <span className="inline-flex items-center text-[10px] text-emerald-600 ml-1" title="Linked to Holded">
                    <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {c.repairCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
                    {c.repairCount}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{c.phone ?? "—"}</TableCell>
              <TableCell className="text-[13px] text-muted-foreground hidden md:table-cell">{c.email ?? "—"}</TableCell>
              <TableCell>
                <SmartDate date={c.updatedAt} className="text-[11px] text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>

      {selected && (
        <CustomerQuickView
          customer={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
    </>
  );
}

function CustomerQuickView({
  customer,
  open,
  onOpenChange,
}: {
  customer: CustomerRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");

  // Reset form when customer changes
  const handleClose = useCallback((v: boolean) => {
    if (!v) {
      setEditing(false);
      setError("");
    }
    onOpenChange(v);
  }, [onOpenChange]);

  // Reset fields when opening a new customer
  useState(() => {
    setName(customer.name);
    setPhone(customer.phone ?? "");
    setEmail(customer.email ?? "");
  });

  function handleSave() {
    setError("");
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, {
          name,
          phone: phone || undefined,
          email: email || undefined,
        });
        toast.success("Saved — synced to Holded");
        setEditing(false);
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-lg">{customer.name}</DialogTitle>
            <div className="flex items-center gap-1">
              {!editing && (
                <Button size="sm" variant="ghost" onClick={() => {
                  setName(customer.name);
                  setPhone(customer.phone ?? "");
                  setEmail(customer.email ?? "");
                  setEditing(true);
                }}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/customers/${customer.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Full page
                </Link>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6 pt-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{error}</div>
          )}

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
              {customer.contactType === "business" ? "Business" : "Person"}
            </Badge>
            {customer.holdedContactId && (
              <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400">
                Syncs to Holded
              </Badge>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px]">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
              </div>
              <div>
                <Label className="text-[11px]">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
              </div>
              <div>
                <Label className="text-[11px]">Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 h-8 text-sm rounded-lg" />
              </div>
              {customer.holdedContactId && (
                <p className="text-[10px] text-emerald-600">Changes will sync to Holded automatically.</p>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="rounded-lg" disabled={isPending} onClick={handleSave}>
                  {isPending ? <Spinner className="mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 text-sm">
              {customer.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <a href={`tel:${customer.phone}`} className="hover:text-foreground transition-colors">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <a href={`mailto:${customer.email}`} className="hover:text-foreground transition-colors truncate">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.repairCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span>{customer.repairCount} repair{customer.repairCount !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t">
            Updated <SmartDate date={customer.updatedAt} className="text-xs" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
