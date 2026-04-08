"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer } from "@/actions/customers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft, Save, Phone, Mail, StickyNote, Wrench, Truck,
  Receipt, ExternalLink, Building2, User, MapPin, Pencil,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { toast } from "sonner";
import { HoldedHint } from "@/components/holded-hint";

interface CustomerDetailProps {
  customer: any;
  holdedInvoices: any[];
}

export function CustomerDetail({ customer, holdedInvoices }: CustomerDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [mobile, setMobile] = useState(customer.mobile ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [city, setCity] = useState(customer.city ?? "");
  const [postalCode, setPostalCode] = useState(customer.postalCode ?? "");
  const [province, setProvince] = useState(customer.province ?? "");
  const [country, setCountry] = useState(customer.country ?? "");
  const [vatnumber, setVatnumber] = useState(customer.vatnumber ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      await updateCustomer(customer.id, {
        name,
        contactType: customer.contactType,
        phone: phone || undefined,
        email: email || undefined,
        mobile: mobile || undefined,
        address: address || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        province: province || undefined,
        country: country || undefined,
        vatnumber: vatnumber || undefined,
        notes: notes || undefined,
      });
      toast.success("Contact saved — synced to Holded");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" asChild>
            <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">{customer.name}</h1>
              <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                {customer.contactType === "business" ? "Business" : "Person"}
              </Badge>
              {customer.holdedContactId && (
                <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400">
                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                  Syncs to Holded
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="rounded-lg" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner className="mr-2" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sync notice */}
      {customer.holdedContactId && editing && (
        <HoldedHint variant="sync">
          Changes here automatically sync to <strong>Holded</strong>: name, phone, email, address, VAT number.
        </HoldedHint>
      )}
      {!customer.holdedContactId && editing && (
        <HoldedHint variant="info">
          This contact is not linked to Holded. Add a phone or email and it will be created in Holded on save.
        </HoldedHint>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contact info */}
        <Card>
          <CardContent className="space-y-3">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px]">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Mobile</Label>
                    <Input value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 h-8 text-sm rounded-lg" />
                </div>
                <div>
                  <Label className="text-[11px]">VAT / NIF</Label>
                  <Input value={vatnumber} onChange={(e) => setVatnumber(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                </div>
                <div>
                  <Label className="text-[11px]">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 text-sm rounded-lg" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    {customer.contactType === "business" ? (
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Type</p>
                    <p className="text-sm font-medium">{customer.contactType === "business" ? "Business" : "Person"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Phone className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{customer.phone ?? "—"}</p>
                  </div>
                </div>
                {customer.mobile && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Mobile</p>
                      <p className="text-sm font-medium">{customer.mobile}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{customer.email ?? "—"}</p>
                  </div>
                </div>
                {customer.vatnumber && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">VAT / NIF</p>
                      <p className="text-sm font-medium">{customer.vatnumber}</p>
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div className="flex items-start gap-2.5 pt-2 border-t">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="text-sm whitespace-pre-wrap pt-1">{customer.notes}</p>
                  </div>
                )}
                {customer.holdedContactId && (
                  <div className="pt-2 border-t">
                    <a
                      href={`https://app.holded.com/contacts/${customer.holdedContactId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View in Holded
                    </a>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Address</p>
            </div>
            {editing ? (
              <div className="space-y-2">
                <div>
                  <Label className="text-[11px]">Street</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Postal code</Label>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[11px]">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Province</Label>
                    <Input value={province} onChange={(e) => setProvince(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Country</Label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 h-8 text-sm rounded-lg" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {customer.address || customer.city ? (
                  <div className="text-sm space-y-1">
                    {customer.address && <p className="font-medium">{customer.address}</p>}
                    <p className="text-muted-foreground">
                      {[customer.postalCode, customer.city].filter(Boolean).join(" ")}
                    </p>
                    <p className="text-muted-foreground">
                      {[customer.province, customer.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No address on file</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Units + Repairs stacked */}
        <div className="space-y-4">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Units ({customer.units.length})</p>
              </div>
              {customer.units.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No units linked</p>
              ) : (
                <div className="space-y-1.5">
                  {customer.units.map((unit: any) => (
                    <Link
                      key={unit.id}
                      href={`/units/${unit.id}`}
                      className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[13px] truncate">
                          {[unit.brand, unit.model].filter(Boolean).join(" ") || "Unknown unit"}
                        </p>
                        {unit.registration && (
                          <p className="font-mono text-[11px] text-muted-foreground">{unit.registration}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Repairs ({customer.repairJobs.length})</p>
              </div>
              {customer.repairJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No repair jobs linked</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {customer.repairJobs.map((job: any) => (
                    <Link
                      key={job.id}
                      href={`/repairs/${job.id}`}
                      className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                    >
                      <div className="min-w-0 mr-2">
                        <p className="font-medium text-[13px] truncate">{job.title || "Unnamed"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{job.publicCode}</p>
                      </div>
                      <Badge variant="secondary" className={`${STATUS_COLORS[job.status as RepairStatus]} rounded-full text-[10px] px-2 py-0 shrink-0`}>
                        {STATUS_LABELS[job.status as RepairStatus]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invoices */}
      {holdedInvoices.length > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoices ({holdedInvoices.length})</p>
            </div>
            <HoldedHint variant="readonly" className="mb-3">
              Invoices are from Holded. Click to open in Holded.
            </HoldedHint>
            <div className="space-y-1.5">
              {holdedInvoices.map((inv: any) => (
                <a
                  key={inv.id}
                  href={`https://app.holded.com/documents/invoice/${inv.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border p-2.5 text-sm hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="min-w-0 mr-2">
                    <p className="font-medium text-[13px]">{inv.invoiceNum}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {inv.desc || "No description"}
                      {inv.date && ` · ${new Date(inv.date * 1000).toLocaleDateString("nl-NL")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-medium tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</span>
                    <Badge
                      variant="secondary"
                      className={`rounded-full text-[10px] px-2 py-0 ${
                        inv.status === 1
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                          : inv.status === 2
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400"
                      }`}
                    >
                      {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : "Unpaid"}
                    </Badge>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
