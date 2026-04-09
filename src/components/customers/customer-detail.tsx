"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, deleteCustomer } from "@/actions/customers";
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
  RefreshCw, Plus, X as XIcon, Trash2, FileText,
} from "lucide-react";
import Link from "next/link";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { toast } from "sonner";
import { HoldedHint } from "@/components/holded-hint";
import { SmartSuggestions, getCustomerSuggestions } from "@/components/smart-suggestions";
import { CompactProgressTracker } from "@/components/repair-progress";
import { createUnit, updateUnit } from "@/actions/units";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { addTagToCustomer, removeTagFromCustomer } from "@/actions/tags";

interface CustomerDetailProps {
  customer: any;
  holdedInvoices: any[];
  holdedQuotes: any[];
  allTags?: TagItem[];
  customerTags?: TagItem[];
}

export function CustomerDetail({ customer, holdedInvoices, holdedQuotes = [], allTags = [], customerTags = [] }: CustomerDetailProps) {
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
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({ registration: "", brand: "", model: "", year: "" });
  const [unitSaving, setUnitSaving] = useState(false);
  const [addingUnit, setAddingUnit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteFromHolded, setDeleteFromHolded] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [holdedTab, setHoldedTab] = useState<"invoices" | "quotes">("invoices");

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
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" asChild>
            <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight">{customer.name}</h1>
              <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                {customer.contactType === "business" ? "Business" : "Person"}
              </Badge>
              {customer.holdedContactId && (
                <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400">
                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                  Syncs to Holded
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info"}
            </p>
            {allTags.length > 0 && (
              <div className="mt-1">
                <TagPicker
                  allTags={allTags}
                  activeTags={customerTags}
                  onAdd={(tagId) => addTagToCustomer(customer.id, tagId)}
                  onRemove={(tagId) => removeTagFromCustomer(customer.id, tagId)}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {!editing ? (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="rounded-xl" onClick={handleSave} disabled={saving}>
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

      {!editing && <SmartSuggestions suggestions={getCustomerSuggestions(customer, holdedInvoices)} />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Contact info */}
        <Card className="rounded-xl">
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold">Contact Info</p>
            </div>
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
        <Card className="rounded-xl">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold">Address</p>
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
        <div className="space-y-5">
          <Card className="rounded-xl">
            <CardContent>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold">Units ({customer.units.length})</p>
                </div>
                {!addingUnit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => {
                      setAddingUnit(true);
                      setEditingUnitId(null);
                      setUnitForm({ registration: "", brand: "", model: "", year: "" });
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              {/* Add new unit form */}
              {addingUnit && (
                <div className="mb-3 border rounded-lg p-2.5 bg-muted/30 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Registration</Label>
                      <Input value={unitForm.registration} onChange={(e) => setUnitForm(f => ({ ...f, registration: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" placeholder="XX-999-X" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Year</Label>
                      <Input value={unitForm.year} onChange={(e) => setUnitForm(f => ({ ...f, year: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" placeholder="2020" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Brand</Label>
                      <Input value={unitForm.brand} onChange={(e) => setUnitForm(f => ({ ...f, brand: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Model</Label>
                      <Input value={unitForm.model} onChange={(e) => setUnitForm(f => ({ ...f, model: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Button
                      size="sm"
                      className="h-6 text-[11px] rounded-lg flex-1"
                      disabled={unitSaving}
                      onClick={async () => {
                        setUnitSaving(true);
                        try {
                          await createUnit({
                            registration: unitForm.registration || undefined,
                            brand: unitForm.brand || undefined,
                            model: unitForm.model || undefined,
                            year: unitForm.year ? parseInt(unitForm.year) : undefined,
                            customerId: customer.id,
                          });
                          toast.success("Unit added");
                          setAddingUnit(false);
                          router.refresh();
                        } catch { toast.error("Failed to add unit"); }
                        finally { setUnitSaving(false); }
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setAddingUnit(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {customer.units.length === 0 && !addingUnit ? (
                <p className="text-sm text-muted-foreground italic">No units linked</p>
              ) : (
                <div className="space-y-1.5">
                  {customer.units.map((unit: any) => (
                    editingUnitId === unit.id ? (
                      <div key={unit.id} className="border rounded-lg p-2.5 bg-muted/30 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Registration</Label>
                            <Input value={unitForm.registration} onChange={(e) => setUnitForm(f => ({ ...f, registration: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Year</Label>
                            <Input value={unitForm.year} onChange={(e) => setUnitForm(f => ({ ...f, year: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Brand</Label>
                            <Input value={unitForm.brand} onChange={(e) => setUnitForm(f => ({ ...f, brand: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Model</Label>
                            <Input value={unitForm.model} onChange={(e) => setUnitForm(f => ({ ...f, model: e.target.value }))} className="mt-0.5 h-7 text-xs rounded-lg" />
                          </div>
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          <Button
                            size="sm"
                            className="h-6 text-[11px] rounded-lg flex-1"
                            disabled={unitSaving}
                            onClick={async () => {
                              setUnitSaving(true);
                              try {
                                await updateUnit(unit.id, {
                                  registration: unitForm.registration || undefined,
                                  brand: unitForm.brand || undefined,
                                  model: unitForm.model || undefined,
                                  year: unitForm.year ? parseInt(unitForm.year) : undefined,
                                  customerId: customer.id,
                                });
                                toast.success("Unit updated");
                                setEditingUnitId(null);
                                router.refresh();
                              } catch { toast.error("Failed to update"); }
                              finally { setUnitSaving(false); }
                            }}
                          >
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setEditingUnitId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={unit.id}
                        className="flex items-center gap-2 rounded-lg border p-2.5 text-sm hover:bg-muted/50 transition-colors group"
                      >
                        <Link href={`/units/${unit.id}`} className="min-w-0 flex-1">
                          <p className="font-medium text-[13px] truncate">
                            {[unit.brand, unit.model].filter(Boolean).join(" ") || "No details yet"}
                          </p>
                          {unit.registration && (
                            <p className="font-mono text-[11px] text-muted-foreground">{unit.registration}</p>
                          )}
                        </Link>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                          title="Edit unit"
                          onClick={() => {
                            setEditingUnitId(unit.id);
                            setAddingUnit(false);
                            setUnitForm({
                              registration: unit.registration ?? "",
                              brand: unit.brand ?? "",
                              model: unit.model ?? "",
                              year: unit.year?.toString() ?? "",
                            });
                          }}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold">Repairs ({customer.repairJobs.length})</p>
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
                      <div className="min-w-0 mr-2 flex-1">
                        <p className="font-medium text-[13px] truncate">{job.title || "Unnamed"}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{job.publicCode}</p>
                      </div>
                      <CompactProgressTracker
                        data={{
                          status: job.status,
                          invoiceStatus: job.invoiceStatus ?? "not_invoiced",
                          holdedQuoteId: job.holdedQuoteId,
                          holdedQuoteNum: job.holdedQuoteNum,
                          holdedInvoiceId: job.holdedInvoiceId,
                          holdedInvoiceNum: job.holdedInvoiceNum,
                        }}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Holded Documents — Invoices & Quotes */}
      {(holdedInvoices.length > 0 || holdedQuotes.length > 0) && (
        <Card className="rounded-xl">
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold">Holded Documents</p>
              <div className="ml-auto flex gap-1">
                <Button
                  variant={holdedTab === "invoices" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2.5 rounded-lg"
                  onClick={() => setHoldedTab("invoices")}
                >
                  Invoices ({holdedInvoices.length})
                </Button>
                <Button
                  variant={holdedTab === "quotes" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[11px] px-2.5 rounded-lg"
                  onClick={() => setHoldedTab("quotes")}
                >
                  Quotes ({holdedQuotes.length})
                </Button>
              </div>
            </div>
            <HoldedHint variant="readonly" className="mb-3">
              Documents are synced from Holded. Click to view PDF.
            </HoldedHint>

            {holdedTab === "invoices" && (
              <div className="space-y-1.5">
                {holdedInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">No invoices</p>
                ) : (
                  holdedInvoices.map((inv: any) => {
                    const isDraft = inv.status === 0 && inv.draft === 1;
                    const Wrapper = isDraft ? "div" as const : "a" as const;
                    return (
                      <Wrapper
                        key={inv.id}
                        {...(!isDraft ? { href: `/api/holded/pdf?type=invoice&id=${inv.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors ${isDraft ? "opacity-60" : "hover:bg-muted/50 active:bg-muted cursor-pointer"}`}
                      >
                        <div className="min-w-0 mr-2">
                          <p className="font-medium text-[13px]">{inv.docNumber || "Draft"}</p>
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
                            {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : isDraft ? "Draft" : "Unpaid"}
                          </Badge>
                          {!isDraft && <FileText className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </Wrapper>
                    );
                  })
                )}
              </div>
            )}

            {holdedTab === "quotes" && (
              <div className="space-y-1.5">
                {holdedQuotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">No quotes</p>
                ) : (
                  holdedQuotes.map((q: any) => {
                    const isDraft = q.draft === 1;
                    const Wrapper = isDraft ? "div" as const : "a" as const;
                    return (
                      <Wrapper
                        key={q.id}
                        {...(!isDraft ? { href: `/api/holded/pdf?type=estimate&id=${q.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors ${isDraft ? "opacity-60" : "hover:bg-muted/50 active:bg-muted cursor-pointer"}`}
                      >
                        <div className="min-w-0 mr-2">
                          <p className="font-medium text-[13px]">{q.docNumber || "Draft"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {q.desc || "No description"}
                            {q.date && ` · ${new Date(q.date * 1000).toLocaleDateString("nl-NL")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</span>
                          <Badge
                            variant="secondary"
                            className={`rounded-full text-[10px] px-2 py-0 ${
                              q.status === 1
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400"
                                : isDraft
                                ? "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950 dark:text-slate-400"
                                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400"
                            }`}
                          >
                            {q.status === 1 ? "Accepted" : isDraft ? "Draft" : "Sent"}
                          </Badge>
                          {!isDraft && <FileText className="h-3 w-3 text-muted-foreground" />}
                        </div>
                      </Wrapper>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{customer.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the customer from the admin. Linked repairs and units will be unlinked.</p>
          {customer.holdedContactId && (
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="delete-holded"
                  checked={deleteFromHolded}
                  onCheckedChange={(c) => { setDeleteFromHolded(!!c); if (!c) setDeletePassword(""); }}
                />
                <label htmlFor="delete-holded" className="text-sm leading-tight cursor-pointer">
                  Also delete from Holded
                </label>
              </div>
              {deleteFromHolded && (
                <Input
                  type="password"
                  placeholder="Enter admin password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting || (deleteFromHolded && !deletePassword)}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteCustomer(customer.id, deleteFromHolded, deleteFromHolded ? deletePassword : undefined);
                  toast.success("Customer deleted");
                  router.push("/customers");
                } catch (e: any) {
                  toast.error(e?.message ?? "Failed to delete");
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Spinner className="mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
