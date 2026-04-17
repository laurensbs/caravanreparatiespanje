"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, deleteCustomer } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft, Save, Phone, Mail, StickyNote, Wrench, Truck,
  Receipt, ExternalLink, Building2, User, MapPin, Pencil,
  RefreshCw, Plus, X as XIcon, Trash2, FileText, Hash, Globe, Check,
  Link2,
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
import { syncCustomerHoldedRepairLinks } from "@/actions/holded";

interface CustomerDetailProps {
  customer: any;
  holdedInvoices: any[];
  holdedQuotes: any[];
  allTags?: TagItem[];
  customerTags?: TagItem[];
  canSyncHoldedRepairLinks?: boolean;
}

export function CustomerDetail({
  customer,
  holdedInvoices,
  holdedQuotes = [],
  allTags = [],
  customerTags = [],
  canSyncHoldedRepairLinks = false,
}: CustomerDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [holdedLinkSyncing, setHoldedLinkSyncing] = useState(false);

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

  async function runHoldedRepairLinkSync() {
    if (holdedLinkSyncing) return;
    setHoldedLinkSyncing(true);
    try {
      const res = await syncCustomerHoldedRepairLinks(customer.id);
      const n = res.invoicesLinked.length + res.quotesLinked.length;
      const seq = res.invoicesLinkedBySequentialFallback;
      if (res.errors.length > 0) {
        toast.error(res.errors.join("; "));
      } else if (n === 0) {
        toast.message("Geen nieuwe koppelingen — documenten staan mogelijk al op een werkorder of er is geen betrouwbare match.");
      } else {
        toast.success(
          `${n} document${n === 1 ? "" : "en"} gekoppeld aan werkorders${seq > 0 ? ` (${seq} via datumvolgorde)` : ""}.`,
        );
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Koppelen mislukt");
    } finally {
      setHoldedLinkSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 group/name">
              {editingField === "name" ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 text-xl font-semibold text-gray-900 w-64 rounded-xl border-gray-200"
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
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-foreground">{customer.name}</h1>
                  <button onClick={() => startEditField("name")} className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100 dark:hover:bg-accent" title="Edit name">
                    <Pencil className="h-3 w-3 text-gray-400" />
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
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground text-[10px] font-medium px-2.5 py-0.5 hover:bg-gray-200 dark:hover:bg-accent transition-colors">
                  {customer.contactType === "business" ? "Business" : "Person"}
                </span>
              </button>
              {customer.holdedContactId && (
                <span className="inline-flex items-center rounded-full text-[10px] font-medium px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <RefreshCw className="h-2.5 w-2.5 mr-1" />
                  Syncs to Holded
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
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
          <button className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Sync notice */}
      {customer.holdedContactId && editingField && (
        <HoldedHint variant="sync">
          Changes automatically sync to <strong>Holded</strong>.
        </HoldedHint>
      )}

      {!editingField && <SmartSuggestions suggestions={getCustomerSuggestions(customer, holdedInvoices)} />}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column: Contact + Address — all inline-editable */}
        <div className="space-y-5 lg:col-span-1">
        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
          <div className="p-5 space-y-0.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-2">
              <User className="h-3.5 w-3.5" /> Contact
            </p>
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
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
          <div className="p-5 space-y-0.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider mb-2">
              <MapPin className="h-3.5 w-3.5" /> Address
            </p>
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
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
          <div className="p-5">
            <div className="group/notes">
              <div className="flex items-center justify-between mb-2">
                <p className="flex items-center gap-2 text-xs font-semibold text-gray-400 dark:text-muted-foreground uppercase tracking-wider">
                  <StickyNote className="h-3.5 w-3.5" /> Notes
                </p>
                {editingField !== "notes" && (
                  <button onClick={() => startEditField("notes")} className="opacity-0 group-hover/notes:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100 dark:hover:bg-accent">
                    <Pencil className="h-2.5 w-2.5 text-gray-400" />
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
                <p className="text-sm text-gray-500 dark:text-muted-foreground whitespace-pre-wrap cursor-pointer hover:text-gray-900 dark:hover:text-foreground transition-colors" onClick={() => startEditField("notes")}>
                  {notes || <span className="italic text-xs">Click to add notes</span>}
                </p>
              )}
            </div>
          </div>
        </div>

            {/* Holded link */}
            {customer.holdedContactId && (
              <a
                href={`https://app.holded.com/contacts/${customer.holdedContactId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-gray-400 hover:text-[#0CC0DF] transition-colors rounded-xl border border-dashed border-gray-200 dark:border-border py-2.5 hover:border-[#0CC0DF]/30 hover:bg-gray-50 dark:hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View in Holded
              </a>
            )}
        </div>

        {/* Right column: Units + Repairs */}
        <div className="space-y-4 lg:col-span-2">
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-muted">
                    <Truck className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Units</p>
                    <p className="text-[11px] text-gray-500">{customer.units.length} linked</p>
                  </div>
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
                <div className="mb-3 border border-gray-100 dark:border-border rounded-xl p-3 bg-gray-50/50 dark:bg-muted/50 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">License Plate</Label>
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
                <p className="text-sm text-gray-400 italic">No units linked</p>
              ) : (
                <div className="space-y-1.5">
                  {customer.units.map((unit: any) => (
                    editingUnitId === unit.id ? (
                      <div key={unit.id} className="border border-gray-100 dark:border-border rounded-xl p-3 bg-gray-50/50 dark:bg-muted/50 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">License Plate</Label>
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
                        className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-border px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-accent transition-colors group"
                      >
                        <Link href={`/units/${unit.id}`} className="min-w-0 flex-1">
                          <p className="font-medium text-[13px] truncate">
                            {[unit.brand, unit.model].filter(Boolean).join(" ") || "No details yet"}
                          </p>
                          {unit.registration && (
                            <p className="font-mono text-[11px] text-gray-400">{unit.registration}</p>
                          )}
                        </Link>
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-accent"
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
                          <Pencil className="h-3 w-3 text-gray-400" />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-muted">
                  <Wrench className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Repairs</p>
                  <p className="text-[11px] text-gray-500">{customer.repairJobs.length} total</p>
                </div>
              </div>
              {customer.repairJobs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No repair jobs linked</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {customer.repairJobs.map((job: any) => (
                    <Link
                      key={job.id}
                      href={`/repairs/${job.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-border px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-accent transition-colors"
                    >
                      <div className="min-w-0 mr-2 flex-1">
                        <p className="font-medium text-[13px] truncate">{job.title || "Unnamed"}</p>
                        <p className="font-mono text-[11px] text-gray-400">{job.publicCode}</p>
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
              {canSyncHoldedRepairLinks && customer.holdedContactId && customer.repairJobs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl gap-2 text-[13px]"
                    disabled={holdedLinkSyncing}
                    onClick={runHoldedRepairLinkSync}
                  >
                    {holdedLinkSyncing ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    Koppel Holded-facturen en -offertes aan werkorders
                  </Button>
                  <p className="text-[11px] text-gray-500 dark:text-muted-foreground mt-1.5 leading-snug">
                    Gebruikt hetzelfde zoeken als de achtergrond-sync. Bij gelijk aantal open werkorders en facturen kan ook
                    datumvolgorde helpen.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holded Documents — Invoices & Quotes */}
      {(holdedInvoices.length > 0 || holdedQuotes.length > 0) && (
        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-gray-100 dark:border-border">
          <div className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 dark:bg-muted">
                <Receipt className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-foreground">Holded Documents</p>
                <p className="text-[11px] text-gray-500">{holdedInvoices.length + holdedQuotes.length} documents</p>
              </div>
              <div className="ml-auto flex gap-1 bg-gray-100 dark:bg-muted rounded-lg p-0.5">
                <button
                  type="button"
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    holdedTab === "invoices"
                      ? "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-sm"
                      : "text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground"
                  }`}
                  onClick={() => setHoldedTab("invoices")}
                >
                  Invoices ({holdedInvoices.length})
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    holdedTab === "quotes"
                      ? "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-sm"
                      : "text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground"
                  }`}
                  onClick={() => setHoldedTab("quotes")}
                >
                  Quotes ({holdedQuotes.length})
                </button>
              </div>
            </div>
            <HoldedHint variant="readonly" className="mb-4">
              Documents are synced from Holded. Click to view PDF.
            </HoldedHint>

            {holdedTab === "invoices" && (
              <div className="space-y-1.5">
                {holdedInvoices.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-2">No invoices</p>
                ) : (
                  holdedInvoices.map((inv: any) => {
                    const isDraft = inv.status === 0 && inv.draft === 1;
                    const Wrapper = isDraft ? "div" as const : "a" as const;
                    return (
                      <Wrapper
                        key={inv.id}
                        {...(!isDraft ? { href: `/api/holded/pdf?type=invoice&id=${inv.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`flex items-center justify-between rounded-xl border border-gray-100 dark:border-border px-4 py-3 text-sm transition-colors ${isDraft ? "opacity-60" : "hover:bg-gray-50 dark:hover:bg-accent cursor-pointer"}`}
                      >
                        <div className="min-w-0 mr-2">
                          <p className="font-medium text-[13px]">{inv.docNumber || "Draft"}</p>
                          <p className="text-[11px] text-gray-500 dark:text-muted-foreground truncate">
                            {inv.desc || "No description"}
                            {inv.date && ` · ${new Date(inv.date * 1000).toLocaleDateString("nl-NL")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium tabular-nums">€{inv.total?.toFixed(2) ?? "0.00"}</span>
                          <span
                            className={`inline-flex items-center rounded-full text-[10px] font-medium px-2 py-0.5 ${
                              inv.status === 1
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                : inv.status === 2
                                ? "bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                : "bg-red-50 text-red-700 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                            }`}
                          >
                            {inv.status === 1 ? "Paid" : inv.status === 2 ? "Partial" : isDraft ? "Draft" : "Unpaid"}
                          </span>
                          {!isDraft && <FileText className="h-3 w-3 text-gray-400" />}
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
                  <p className="text-sm text-gray-400 italic py-2">No quotes</p>
                ) : (
                  holdedQuotes.map((q: any) => {
                    const isDraft = q.draft === 1;
                    const Wrapper = isDraft ? "div" as const : "a" as const;
                    return (
                      <Wrapper
                        key={q.id}
                        {...(!isDraft ? { href: `/api/holded/pdf?type=estimate&id=${q.id}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                        className={`flex items-center justify-between rounded-xl border border-gray-100 dark:border-border px-4 py-3 text-sm transition-colors ${isDraft ? "opacity-60" : "hover:bg-gray-50 dark:hover:bg-accent cursor-pointer"}`}
                      >
                        <div className="min-w-0 mr-2">
                          <p className="font-medium text-[13px]">{q.docNumber || "Draft"}</p>
                          <p className="text-[11px] text-gray-500 dark:text-muted-foreground truncate">
                            {q.desc || "No description"}
                            {q.date && ` · ${new Date(q.date * 1000).toLocaleDateString("nl-NL")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-medium tabular-nums">€{q.total?.toFixed(2) ?? "0.00"}</span>
                          <span
                            className={`inline-flex items-center rounded-full text-[10px] font-medium px-2 py-0.5 ${
                              q.status === 1
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                : isDraft
                                ? "bg-gray-50 text-gray-600 border border-gray-200 dark:bg-muted dark:text-muted-foreground dark:border-border"
                                : "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20"
                            }`}
                          >
                            {q.status === 1 ? "Accepted" : isDraft ? "Draft" : "Sent"}
                          </span>
                          {!isDraft && <FileText className="h-3 w-3 text-gray-400" />}
                        </div>
                      </Wrapper>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{customer.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">This will remove the customer from the admin. Linked repairs and units will be unlinked.</p>
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
          <span className="text-[11px] text-gray-500">{label}</span>
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
    <div className="flex items-center justify-between py-2.5 group/row text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-accent -mx-3 px-3 rounded-lg transition-colors" onClick={() => onEdit(field)}>
      <span className="flex items-center gap-2 text-gray-500 dark:text-muted-foreground shrink-0">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        {value ? (
          href ? (
            <a href={href} className="font-medium text-gray-900 hover:text-[#0CC0DF] truncate max-w-[200px]" onClick={(e) => e.stopPropagation()}>{value}</a>
          ) : (
            <span className="font-medium text-gray-900 truncate max-w-[200px]">{value}</span>
          )
        ) : (
          <span className="text-xs text-gray-300 italic">—</span>
        )}
        <Pencil className="h-2.5 w-2.5 text-gray-400 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}
