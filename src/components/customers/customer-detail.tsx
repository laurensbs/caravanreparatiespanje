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
  RefreshCw, Plus, X as XIcon, Trash2, FileText, Hash, Globe, Check,
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

  const [editingField, setEditingField] = useState<string | null>(null);

  // Inline field editing helpers
  function startEditField(field: string) {
    setEditingField(field);
  }
  async function saveField(field: string, value: string) {
    setSaving(true);
    try {
      await updateCustomer(customer.id, {
        name,
        contactType: field === "contactType" ? (value as "person" | "business") : customer.contactType,
        phone: field === "phone" ? (value || undefined) : (phone || undefined),
        email: field === "email" ? (value || undefined) : (email || undefined),
        mobile: field === "mobile" ? (value || undefined) : (mobile || undefined),
        address: field === "address" ? (value || undefined) : (address || undefined),
        city: field === "city" ? (value || undefined) : (city || undefined),
        postalCode: field === "postalCode" ? (value || undefined) : (postalCode || undefined),
        province: field === "province" ? (value || undefined) : (province || undefined),
        country: field === "country" ? (value || undefined) : (country || undefined),
        vatnumber: field === "vatnumber" ? (value || undefined) : (vatnumber || undefined),
        notes: field === "notes" ? (value || undefined) : (notes || undefined),
      });
      toast.success("Saved");
      setEditingField(null);
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
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" asChild>
            <Link href="/customers"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 group/name">
              {editingField === "name" ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-lg font-extrabold w-64 rounded-lg"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveField("name", name); if (e.key === "Escape") setEditingField(null); }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveField("name", name)} disabled={saving}>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setName(customer.name); setEditingField(null); }}>
                    <XIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-lg font-extrabold tracking-tight">{customer.name}</h1>
                  <button onClick={() => startEditField("name")} className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted" title="Edit name">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                </>
              )}
              <button
                onClick={async () => {
                  const newType = customer.contactType === "business" ? "person" : "business";
                  await saveField("contactType", newType);
                }}
                className="cursor-pointer"
                title="Click to toggle type"
              >
                <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 hover:bg-muted transition-colors">
                  {customer.contactType === "business" ? "Business" : "Person"}
                </Badge>
              </button>
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
        </div>
      </div>

      {/* Sync notice */}
      {customer.holdedContactId && editingField && (
        <HoldedHint variant="sync">
          Changes automatically sync to <strong>Holded</strong>.
        </HoldedHint>
      )}

      {!editingField && <SmartSuggestions suggestions={getCustomerSuggestions(customer, holdedInvoices)} />}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column: Contact + Address — all inline-editable */}
        <Card className="rounded-xl lg:col-span-1">
          <CardContent className="space-y-0 divide-y">
            {/* Contact details */}
            <InlineField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={phone} field="phone"
              editingField={editingField} saving={saving}
              onChange={setPhone} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={mobile} field="mobile"
              editingField={editingField} saving={saving}
              onChange={setMobile} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={email} field="email" type="email"
              editingField={editingField} saving={saving}
              onChange={setEmail} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)}
              href={email ? `mailto:${email}` : undefined} />
            <InlineField icon={<Hash className="h-3.5 w-3.5" />} label="VAT / NIF" value={vatnumber} field="vatnumber"
              editingField={editingField} saving={saving}
              onChange={setVatnumber} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />

            {/* Address section */}
            <div className="pt-3 pb-1">
              <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                <MapPin className="h-3 w-3" /> Address
              </p>
            </div>
            <InlineField icon={null} label="Street" value={address} field="address"
              editingField={editingField} saving={saving}
              onChange={setAddress} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={null} label="Postal code" value={postalCode} field="postalCode"
              editingField={editingField} saving={saving}
              onChange={setPostalCode} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={null} label="City" value={city} field="city"
              editingField={editingField} saving={saving}
              onChange={setCity} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={null} label="Province" value={province} field="province"
              editingField={editingField} saving={saving}
              onChange={setProvince} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />
            <InlineField icon={null} label="Country" value={country} field="country"
              editingField={editingField} saving={saving}
              onChange={setCountry} onSave={saveField} onEdit={startEditField} onCancel={() => setEditingField(null)} />

            {/* Notes */}
            <div className="pt-3 group/notes">
              <div className="flex items-center justify-between mb-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <StickyNote className="h-3 w-3" /> Notes
                </p>
                {editingField !== "notes" && (
                  <button onClick={() => startEditField("notes")} className="opacity-0 group-hover/notes:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted">
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                )}
              </div>
              {editingField === "notes" ? (
                <div className="space-y-1.5">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="text-sm rounded-lg" autoFocus />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-[11px] rounded-lg" onClick={() => saveField("notes", notes)} disabled={saving}>Save</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => { setNotes(customer.notes ?? ""); setEditingField(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer hover:text-foreground transition-colors" onClick={() => startEditField("notes")}>
                  {notes || <span className="italic text-xs">Click to add notes</span>}
                </p>
              )}
            </div>

            {/* Holded link */}
            {customer.holdedContactId && (
              <div className="pt-3">
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
          </CardContent>
        </Card>

        {/* Right column: Units + Repairs */}
        <div className="space-y-5 lg:col-span-2">
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

// ─── Inline editable field row ───

function InlineField({
  icon, label, value, field, type = "text", href,
  editingField, saving,
  onChange, onSave, onEdit, onCancel,
}: {
  icon: React.ReactNode | null;
  label: string;
  value: string;
  field: string;
  type?: string;
  href?: string;
  editingField: string | null;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: (field: string, value: string) => void;
  onEdit: (field: string) => void;
  onCancel: () => void;
}) {
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-20 shrink-0">
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          className="h-7 text-sm rounded-lg flex-1"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") onSave(field, value); if (e.key === "Escape") onCancel(); }}
        />
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onSave(field, value)} disabled={saving}>
          <Check className="h-3 w-3 text-emerald-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={onCancel}>
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 group/row text-sm cursor-pointer hover:bg-muted/30 -mx-3 px-3 rounded-lg transition-colors" onClick={() => onEdit(field)}>
      <span className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {value ? (
          href ? (
            <a href={href} className="font-medium hover:text-primary truncate max-w-[200px]" onClick={(e) => e.stopPropagation()}>{value}</a>
          ) : (
            <span className="font-medium truncate max-w-[200px]">{value}</span>
          )
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
        <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
