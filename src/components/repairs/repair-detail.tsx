"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRepairJob } from "@/actions/repairs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  CUSTOMER_RESPONSE_LABELS, INVOICE_STATUS_LABELS,
} from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus, InvoiceStatus } from "@/types";
import { ArrowLeft, Save, Clock, User, MapPin, FileText, Pencil, X as XIcon, MessageSquare, StickyNote, Wrench, Hash, CalendarDays, DollarSign, Flag, Receipt, FileDown, Send, Plus, Trash2, Package, RefreshCw } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SmartDate } from "@/components/ui/smart-date";
import { CommunicationLogPanel } from "@/components/communication-log";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";
import { createHoldedInvoice, downloadHoldedInvoicePdf, sendHoldedInvoice, createHoldedQuote } from "@/actions/holded";
import { deleteRepairJob } from "@/actions/repairs";
import { HoldedHint } from "@/components/holded-hint";
import { SmartSuggestions, getRepairSuggestions } from "@/components/smart-suggestions";

interface PartItem {
  id: string;
  name: string;
  partNumber: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  supplierName: string | null;
}

interface CostLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  partId?: string;
  type: "part" | "labour" | "custom";
}

interface PricingSettings {
  hourlyRate: number;
  defaultMarkup: number;
  defaultTax: number;
}

interface RepairDetailProps {
  job: any;
  communicationLogs?: any[];
  partsList?: PartItem[];
  backTo?: string;
  settings?: PricingSettings;
}

export function RepairDetail({ job, communicationLogs = [], partsList = [], backTo, settings = { hourlyRate: 42.50, defaultMarkup: 25, defaultTax: 21 } }: RepairDetailProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(job.priority);
  const [invoiceStatus, setInvoiceStatus] = useState(job.invoiceStatus);
  const [customerResponseStatus, setCustomerResponseStatus] = useState(job.customerResponseStatus);
  const [notes, setNotes] = useState(job.notesRaw && job.notesRaw !== "true" && job.notesRaw !== "false" ? job.notesRaw : "");
  const [internalComments, setInternalComments] = useState(job.internalComments ?? "");
  const [title, setTitle] = useState(job.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(job.descriptionRaw ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(job.estimatedCost ?? "");
  const [actualCost, setActualCost] = useState(job.actualCost ?? "");
  const [costLines, setCostLines] = useState<CostLineItem[]>([]);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

  const costLinesSubtotal = costLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const discountAmount = costLinesSubtotal * (discountPercent / 100);
  const costLinesTotal = costLinesSubtotal - discountAmount;
  const costLinesTotalInclTax = costLinesTotal * (1 + settings.defaultTax / 100);

  function addPartLine(part: PartItem) {
    const baseCost = part.defaultCost ? parseFloat(part.defaultCost) : 0;
    const markup = part.markupPercent ? parseFloat(part.markupPercent) : settings.defaultMarkup;
    const sellingPrice = baseCost * (1 + markup / 100);
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: part.name, quantity: 1, unitPrice: Math.round(sellingPrice * 100) / 100, partId: part.id, type: "part" },
    ]);
    setShowPartPicker(false);
    setPartSearch("");
  }

  function addLabourLine() {
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "Labour", quantity: 1, unitPrice: settings.hourlyRate, type: "labour" },
    ]);
  }

  function addCustomLine() {
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, type: "custom" },
    ]);
  }

  function removeCostLine(id: string) {
    setCostLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateCostLine(id: string, field: keyof CostLineItem, value: string | number) {
    setCostLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function applyLinesToEstimate() {
    setEstimatedCost(costLinesTotalInclTax.toFixed(2));
  }

  const filteredParts = partSearch.length > 0
    ? partsList.filter(
        (p) =>
          p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          p.partNumber?.toLowerCase().includes(partSearch.toLowerCase())
      ).slice(0, 8)
    : partsList.slice(0, 8);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this repair job? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteRepairJob(job.id);
      toast.success("Repair job deleted");
      router.push("/repairs");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateRepairJob(job.id, {
        title: title || null,
        descriptionRaw: description || null,
        status,
        priority,
        invoiceStatus,
        customerResponseStatus,
        notesRaw: notes || null,
        internalComments: internalComments || null,
        estimatedCost: estimatedCost || null,
        actualCost: actualCost || null,
      });
      router.refresh();
      toast.success("Changes saved");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0 mt-0.5" asChild>
            <Link href={backTo ?? "/repairs"}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold tracking-tight">{job.publicCode ?? "Repair Job"}</h1>
              <Badge className={`${STATUS_COLORS[status as RepairStatus]} rounded-full text-[11px] px-2 py-0`}>
                {STATUS_LABELS[status as RepairStatus]}
              </Badge>
              <Badge className={`${PRIORITY_COLORS[priority as Priority]} rounded-full text-[11px] px-2 py-0`}>
                {PRIORITY_LABELS[priority as Priority]}
              </Badge>
            </div>
            {editingTitle ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm h-7 rounded-lg"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingTitle(false); if (e.key === "Enter") setEditingTitle(false); }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTitle(false)}>
                  <XIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors text-left mt-0.5"
              >
                <span className="truncate">{title || "No title — click to add"}</span>
                <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-xl shrink-0 h-9 px-4">
          {saving ? <Spinner className="mr-2" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <SmartSuggestions suggestions={getRepairSuggestions(job)} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Issue description */}
          <Card className="rounded-xl">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                </span>
                {!editingDescription && (
                  <button type="button" onClick={() => setEditingDescription(true)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    autoFocus
                    className="rounded-lg text-sm"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setEditingDescription(false)} className="h-7 text-xs">
                    Done
                  </Button>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {description || <span className="text-muted-foreground italic">No description</span>}
                </div>
              )}
              {job.descriptionNormalized && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-sm text-muted-foreground">{job.descriptionNormalized}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts needed */}
          {job.partsNeededRaw && (
            <Card className="rounded-xl">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Parts Needed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="whitespace-pre-wrap text-sm">{job.partsNeededRaw}</div>
              </CardContent>
            </Card>
          )}

          {/* Cost Estimate Builder */}
          <Card className="rounded-xl">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Cost Estimate
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addLabourLine}>
                    <Clock className="h-3 w-3 mr-1" />
                    Labour
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCustomLine}>
                    <Plus className="h-3 w-3 mr-1" />
                    Custom
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowPartPicker(!showPartPicker)}>
                    <Package className="h-3 w-3 mr-1" />
                    Part
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {showPartPicker && (
                <div className="mb-3 border rounded-lg p-2 bg-muted/30">
                  <Input
                    placeholder="Search parts..."
                    value={partSearch}
                    onChange={(e) => setPartSearch(e.target.value)}
                    className="h-7 text-xs rounded-lg mb-2"
                    autoFocus
                  />
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {filteredParts.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground py-2 text-center">No parts found</p>
                    ) : (
                      filteredParts.map((p) => {
                        const baseCost = p.defaultCost ? parseFloat(p.defaultCost) : 0;
                        const markup = p.markupPercent ? parseFloat(p.markupPercent) : settings.defaultMarkup;
                        const sellPrice = baseCost * (1 + markup / 100);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addPartLine(p)}
                            className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors flex justify-between items-center"
                          >
                            <span className="truncate">
                              {p.name}
                              {p.partNumber && <span className="text-muted-foreground ml-1">({p.partNumber})</span>}
                            </span>
                            <span className="text-muted-foreground shrink-0 ml-2">
                              €{sellPrice.toFixed(2)}
                              {baseCost > 0 && <span className="text-[10px] ml-1 opacity-60">+{markup}%</span>}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {costLines.length > 0 ? (
                <div className="space-y-1.5">
                  {costLines.map((line) => (
                    <div key={line.id} className="flex items-center gap-2">
                      <span className={`text-[9px] font-medium uppercase tracking-wider w-10 shrink-0 ${
                        line.type === "labour" ? "text-blue-500" : line.type === "part" ? "text-green-600" : "text-muted-foreground"
                      }`}>
                        {line.type === "labour" ? "HRS" : line.type === "part" ? "PART" : "ITEM"}
                      </span>
                      <Input
                        value={line.description}
                        onChange={(e) => updateCostLine(line.id, "description", e.target.value)}
                        placeholder={line.type === "labour" ? "Labour description" : "Description"}
                        className="h-7 text-xs rounded-lg flex-1"
                      />
                      <Input
                        type="number"
                        min="0.25"
                        step={line.type === "labour" ? "0.25" : "1"}
                        value={line.quantity}
                        onChange={(e) => updateCostLine(line.id, "quantity", parseFloat(e.target.value) || 1)}
                        className="h-7 text-xs rounded-lg w-14 text-center"
                        title={line.type === "labour" ? "Hours" : "Quantity"}
                      />
                      <div className="relative w-24">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => updateCostLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs pl-5 pr-2 text-right rounded-lg"
                        />
                      </div>
                      <span className="text-xs font-medium w-16 text-right tabular-nums">
                        €{(line.quantity * line.unitPrice).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCostLine(line.id)}>
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Discount row */}
                  <div className="flex items-center justify-between pt-2 border-t gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Discount</span>
                      <div className="relative w-16">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          className="h-6 text-xs pr-5 text-right rounded-lg"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">%</span>
                      </div>
                    </div>
                    {discountPercent > 0 && (
                      <span className="text-xs text-destructive tabular-nums">-€{discountAmount.toFixed(2)}</span>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Subtotal excl. VAT</span>
                      <span className="text-xs font-medium tabular-nums">€{costLinesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">VAT ({settings.defaultTax}%)</span>
                      <span className="text-xs tabular-nums">€{(costLinesTotal * settings.defaultTax / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs font-semibold">Total incl. VAT</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tabular-nums">€{costLinesTotalInclTax.toFixed(2)}</span>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyLinesToEstimate}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground py-2">
                  Add parts, labour hours, or custom lines to build a cost estimate.
                </p>
              )}
              <HoldedHint variant="info" className="mt-3">
                Prices are excl. VAT. Use <strong>"Create Quote"</strong> or <strong>"Create Invoice"</strong> in the sidebar to send to Holded.
              </HoldedHint>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add notes visible to all team members..."
                className="rounded-lg text-sm resize-none"
              />
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Internal only</p>
                <Textarea
                  value={internalComments}
                  onChange={(e) => setInternalComments(e.target.value)}
                  rows={2}
                  placeholder="Private staff notes..."
                  className="rounded-lg text-sm resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          {job.events.length > 0 && (
            <Card className="rounded-xl">
              <CardHeader className="pb-1">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="space-y-0">
                  {job.events.map((event: any, idx: number) => (
                    <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                      {idx < job.events.length - 1 && (
                        <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-border" />
                      )}
                      <div className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-primary/30 bg-background" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5 text-xs">
                          <span className="font-medium">{event.userName ?? "System"}</span>
                          <span className="text-muted-foreground">{event.eventType.replace(/_/g, " ")}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground/70 whitespace-nowrap">
                            <SmartDate date={event.createdAt} />
                          </span>
                        </div>
                        {event.fieldChanged && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {event.fieldChanged}: {event.oldValue} → {event.newValue}
                          </p>
                        )}
                        {event.comment && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{event.comment}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Communication Log */}
          <Card className="rounded-xl">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                Communication Log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <CommunicationLogPanel
                repairJobId={job.id}
                logs={communicationLogs}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status controls */}
          <Card className="rounded-xl">
            <CardContent className="space-y-3 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Priority</Label>
                  <PrioritySelect value={priority} onValueChange={setPriority} className="mt-1 h-8 text-xs rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Invoice</Label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Contact</Label>
                  <Select value={customerResponseStatus} onValueChange={setCustomerResponseStatus}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </span>
                  <span className="font-medium text-right">{job.location?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Contact
                  </span>
                  {job.customer ? (
                    <Link href={`/customers/${job.customer.id}`} className="font-medium text-primary hover:underline text-right">
                      {job.customer.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {job.unit && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Unit
                    </span>
                    <Link href={`/units/${job.unit.id}`} className="font-medium text-primary hover:underline text-right truncate max-w-[160px]">
                      {[job.unit.brand, job.unit.model, job.unit.registration].filter(Boolean).join(" · ") || "—"}
                    </Link>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Assigned
                  </span>
                  <span className="font-medium text-right">{job.assignedUser?.name ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Created
                  </span>
                  <span className="text-right">{format(new Date(job.createdAt), "dd MMM yyyy")}</span>
                </div>
                {(job.estimatedCost || job.actualCost || true) && (
                  <div className="border-t pt-2.5 mt-2.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                        <DollarSign className="h-3.5 w-3.5" />
                        Estimated
                      </span>
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={estimatedCost}
                          onChange={(e) => setEstimatedCost(e.target.value)}
                          className="h-7 text-xs pl-5 pr-2 text-right rounded-lg"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                        <DollarSign className="h-3.5 w-3.5" />
                        Actual
                      </span>
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={actualCost}
                          onChange={(e) => setActualCost(e.target.value)}
                          className="h-7 text-xs pl-5 pr-2 text-right rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}
                {job.sourceSheet && (
                  <div className="border-t pt-2.5 mt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Source</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">{job.sourceSheet}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Flags */}
          {(job.waterDamageRiskFlag || job.safetyFlag || job.tyresFlag || job.lightsFlag || job.brakesFlag || job.windowsFlag || job.sealsFlag || job.partsRequiredFlag || job.followUpRequiredFlag || job.warrantyInternalCostFlag || job.prepaidFlag) && (
            <Card className="rounded-xl">
              <CardContent className="pt-5">
                <p className="flex items-center gap-2 text-xs font-semibold mb-3">
                  <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                  Flags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.waterDamageRiskFlag && <Badge variant="destructive" className="rounded-full text-[10px] px-2 py-0">Water Damage</Badge>}
                  {job.safetyFlag && <Badge variant="destructive" className="rounded-full text-[10px] px-2 py-0">Safety</Badge>}
                  {job.tyresFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Tyres</Badge>}
                  {job.lightsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Lighting</Badge>}
                  {job.brakesFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Brakes</Badge>}
                  {job.windowsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Windows</Badge>}
                  {job.sealsFlag && <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">Seals</Badge>}
                  {job.partsRequiredFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Parts</Badge>}
                  {job.followUpRequiredFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Follow-up</Badge>}
                  {job.warrantyInternalCostFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Warranty</Badge>}
                  {job.prepaidFlag && <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">Prepaid</Badge>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Holded Documents */}
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <p className="flex items-center gap-2 text-xs font-semibold mb-3">
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                Holded Documents
              </p>

              {/* Quote section */}
              <div className="space-y-2 mb-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Quote</p>
                {job.holdedQuoteId ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{job.holdedQuoteNum}</p>
                      <a
                        href={`https://app.holded.com/documents/estimate/${job.holdedQuoteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline"
                      >
                        Open in Holded
                      </a>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={!job.customer || costLines.length === 0}
                    onClick={async () => {
                      try {
                        const result = await createHoldedQuote(job.id, costLines.map(l => ({
                          name: l.description || "Line item",
                          units: l.quantity,
                          subtotal: l.unitPrice * l.quantity,
                          tax: settings.defaultTax,
                          discount: 0,
                        })), discountPercent);
                        toast.success(`Quote ${result.quoteNum} created`);
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e.message ?? "Failed to create quote");
                      }
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Create Quote
                  </Button>
                )}
              </div>

              <div className="border-t pt-3 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoice</p>
                {job.holdedInvoiceId ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{job.holdedInvoiceNum}</p>
                    <a
                      href={`https://app.holded.com/documents/invoice/${job.holdedInvoiceId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline"
                    >
                      Open in Holded
                    </a>
                  </div>
                  <HoldedHint variant="sync">
                    Invoice exists in Holded. PDF &amp; email sent via Holded.
                  </HoldedHint>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={async () => {
                        try {
                          const { data, filename } = await downloadHoldedInvoicePdf(job.id);
                          const link = document.createElement("a");
                          link.href = `data:application/pdf;base64,${data}`;
                          link.download = filename;
                          link.click();
                          toast.success("PDF downloaded");
                        } catch {
                          toast.error("Failed to download PDF");
                        }
                      }}
                    >
                      <FileDown className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                    {job.customer?.email && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={async () => {
                          try {
                            await sendHoldedInvoice(job.id);
                            toast.success("Invoice sent to " + job.customer.email);
                          } catch (e: any) {
                            toast.error(e.message ?? "Failed to send");
                          }
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Email
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full text-xs"
                    disabled={!job.customer || (costLines.length === 0 && !actualCost && !estimatedCost)}
                    onClick={async () => {
                      try {
                        const items = costLines.length > 0
                          ? costLines.map(l => ({
                              name: l.description || "Line item",
                              units: l.quantity,
                              subtotal: l.unitPrice * l.quantity,
                              tax: settings.defaultTax,
                              discount: 0,
                            }))
                          : undefined;
                        const result = await createHoldedInvoice(job.id, items, discountPercent);
                        toast.success(`Invoice ${result.invoiceNum} created`);
                        router.refresh();
                      } catch (e: any) {
                        toast.error(e.message ?? "Failed to create invoice");
                      }
                    }}
                  >
                    <Receipt className="h-3 w-3 mr-1" />
                    Create Invoice
                  </Button>
                  {!job.customer && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">Link a contact first</p>
                  )}
                  {job.customer && costLines.length === 0 && !actualCost && !estimatedCost && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">Add lines or a cost estimate first</p>
                  )}
                  <HoldedHint variant="info" className="mt-2">
                    {costLines.length > 0
                      ? `Creates invoice with ${costLines.length} line items${discountPercent > 0 ? ` and ${discountPercent}% discount` : ""}`
                      : "Creates invoice using actual or estimated cost"
                    }
                  </HoldedHint>
                </div>
              )}
              </div>
            </CardContent>
          </Card>

          {/* Delete job */}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Spinner className="mr-2" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Delete Repair Job
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
