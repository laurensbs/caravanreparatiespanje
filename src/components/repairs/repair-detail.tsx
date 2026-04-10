"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateRepairJob } from "@/actions/repairs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  CUSTOMER_RESPONSE_LABELS, INVOICE_STATUS_LABELS,
} from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus, InvoiceStatus } from "@/types";
import { ArrowLeft, Save, Clock, User, MapPin, FileText, Pencil, X as XIcon, MessageSquare, StickyNote, Wrench, Hash, CalendarDays, DollarSign, Flag, Receipt, FileDown, Send, Plus, Trash2, Package, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SmartDate } from "@/components/ui/smart-date";
import { CommunicationLogPanel } from "@/components/communication-log";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";
import { createHoldedInvoice, sendHoldedInvoice, createHoldedQuote, sendHoldedQuote, verifyHoldedDocuments, deleteHoldedQuote, deleteHoldedInvoice } from "@/actions/holded";
import { deleteRepairJob } from "@/actions/repairs";
import { scheduleRepair, unscheduleRepair } from "@/actions/planning";
import { updateCustomer } from "@/actions/customers";
import { updateUnit } from "@/actions/units";
import { HoldedHint } from "@/components/holded-hint";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearch } from "@/components/customers/customer-search";
import { SmartSuggestions, getRepairSuggestions, type RepairSuggestionActions } from "@/components/smart-suggestions";
import { RepairProgressTracker } from "@/components/repair-progress";
import { useAssistantContext } from "@/components/assistant-context";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { WorkflowGuide } from "@/components/workflow-guide";
import { addTagToRepair, removeTagFromRepair } from "@/actions/tags";

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
  internalCost: number;
  partId?: string;
  type: "part" | "labour" | "custom";
}

interface PricingSettings {
  hourlyRate: number;
  defaultMarkup: number;
  defaultTax: number;
}

interface CustomerRepairItem {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

interface UserItem {
  id: string;
  name: string | null;
}

interface RepairDetailProps {
  job: any;
  communicationLogs?: any[];
  partsList?: PartItem[];
  backTo?: string;
  settings?: PricingSettings;
  allTags?: TagItem[];
  allCustomers?: { id: string; name: string }[];
  repairTags?: TagItem[];
  customerRepairs?: CustomerRepairItem[];
  users?: UserItem[];
}

export function RepairDetail({ job, communicationLogs = [], partsList = [], backTo, settings = { hourlyRate: 42.50, defaultMarkup: 25, defaultTax: 21 }, allTags = [], repairTags = [], customerRepairs = [], users = [], allCustomers = [] }: RepairDetailProps) {
  const router = useRouter();
  const { setRepairContext } = useAssistantContext();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [priority, setPriority] = useState(job.priority);
  const [invoiceStatus, setInvoiceStatus] = useState(job.invoiceStatus);
  const [warrantyFlag, setWarrantyFlag] = useState(job.warrantyInternalCostFlag ?? false);
  const [prepaidFlag, setPrepaidFlag] = useState(job.prepaidFlag ?? false);
  const [waterDamageFlag, setWaterDamageFlag] = useState(job.waterDamageRiskFlag ?? false);
  const [safetyFlag, setSafetyFlag] = useState(job.safetyFlag ?? false);
  const [tyresFlag, setTyresFlag] = useState(job.tyresFlag ?? false);
  const [lightsFlag, setLightsFlag] = useState(job.lightsFlag ?? false);
  const [brakesFlag, setBrakesFlag] = useState(job.brakesFlag ?? false);
  const [windowsFlag, setWindowsFlag] = useState(job.windowsFlag ?? false);
  const [sealsFlag, setSealsFlag] = useState(job.sealsFlag ?? false);
  const [partsRequiredFlag, setPartsRequiredFlag] = useState(job.partsRequiredFlag ?? false);
  const [followUpRequiredFlag, setFollowUpRequiredFlag] = useState(job.followUpRequiredFlag ?? false);
  const [customerResponseStatus, setCustomerResponseStatus] = useState(job.customerResponseStatus);
  const [notes, setNotes] = useState(job.notesRaw && job.notesRaw !== "true" && job.notesRaw !== "false" ? job.notesRaw : "");
  const [internalComments, setInternalComments] = useState(job.internalComments ?? "");
  const [title, setTitle] = useState(job.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [expandCustomer, setExpandCustomer] = useState(false);
  const [expandUnit, setExpandUnit] = useState(false);
  const [description, setDescription] = useState(job.descriptionRaw ?? "");
  const [editingDescription, setEditingDescription] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(job.estimatedCost ?? "");
  const [actualCost, setActualCost] = useState(job.actualCost ?? "");
  const [internalCost, setInternalCost] = useState(job.internalCost ?? "");
  const [costLines, setCostLines] = useState<CostLineItem[]>([]);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

  const costLinesSubtotal = costLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const costLinesInternalTotal = costLines.reduce((sum, l) => sum + l.quantity * l.internalCost, 0);
  const discountAmount = costLinesSubtotal * (discountPercent / 100);
  const costLinesTotal = costLinesSubtotal - discountAmount;
  const costLinesTotalInclTax = costLinesTotal * (1 + settings.defaultTax / 100);

  // Push repair context to the global assistant
  useEffect(() => {
    setRepairContext({ job, settings });
    return () => setRepairContext(null);
  }, [job, settings, setRepairContext]);

  function addPartLine(part: PartItem) {
    const baseCost = part.defaultCost ? parseFloat(part.defaultCost) : 0;
    const markup = part.markupPercent ? parseFloat(part.markupPercent) : settings.defaultMarkup;
    const sellingPrice = baseCost * (1 + markup / 100);
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: part.name, quantity: 1, unitPrice: Math.round(sellingPrice * 100) / 100, internalCost: baseCost, partId: part.id, type: "part" },
    ]);
    setShowPartPicker(false);
    setPartSearch("");
  }

  function addLabourLine() {
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "Labour", quantity: 1, unitPrice: settings.hourlyRate, internalCost: 0, type: "labour" },
    ]);
  }

  function addCustomLine() {
    setCostLines((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0, internalCost: 0, type: "custom" },
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
    setInternalCost(costLinesInternalTotal.toFixed(2));
  }

  const filteredParts = partSearch.length > 0
    ? partsList.filter(
        (p) =>
          p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          p.partNumber?.toLowerCase().includes(partSearch.toLowerCase())
      ).slice(0, 8)
    : partsList.slice(0, 8);

  async function handleDelete() {
    if (!confirm("Move this repair job to the bin? You can restore it later.")) return;
    setDeleting(true);
    try {
      await deleteRepairJob(job.id);
      toast.success("Moved to bin");
      router.push("/repairs");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
      setDeleting(false);
    }
  }

  // ── Smart suggestion action states ──
  const [showCustomerLinker, setShowCustomerLinker] = useState(false);
  const [showUserAssigner, setShowUserAssigner] = useState(false);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const communicationRef = useRef<HTMLDivElement>(null);
  const costRef = useRef<HTMLDivElement>(null);
  const holdedRef = useRef<HTMLDivElement>(null);

  const suggestionActions: RepairSuggestionActions = {
    onLinkCustomer: () => setShowCustomerLinker(true),
    onAssignUser: () => setShowUserAssigner(true),
    onCreateInvoice: () => holdedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    onCreateQuote: () => holdedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    onEditDescription: () => {
      setEditingDescription(true);
      setTimeout(() => descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    },
    onEditEstimate: () => costRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    onOpenCommunication: () => communicationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    onClearFollowUp: () => {
      setFollowUpRequiredFlag(false);
      toast.info("Follow-up flag cleared — save to apply");
    },
  };

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
        internalCost: internalCost || null,
        warrantyInternalCostFlag: warrantyFlag,
        prepaidFlag,
        waterDamageRiskFlag: waterDamageFlag,
        safetyFlag,
        tyresFlag,
        lightsFlag,
        brakesFlag,
        windowsFlag,
        sealsFlag,
        partsRequiredFlag,
        followUpRequiredFlag,
      });
      router.refresh();
      toast.success("Changes saved");
      router.push(backTo ?? "/repairs");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0 mt-0.5" asChild>
            <Link href={backTo ?? "/repairs"}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold tracking-tight truncate max-w-[400px]">{job.publicCode ?? title ?? "Repair Job"}</h1>
              <Badge className={`${STATUS_COLORS[status as RepairStatus]} rounded-full text-[11px] px-2 py-0`}>
                {STATUS_LABELS[status as RepairStatus]}
              </Badge>
              <Badge className={`${PRIORITY_COLORS[priority as Priority]} rounded-full text-[11px] px-2 py-0`}>
                {PRIORITY_LABELS[priority as Priority]}
              </Badge>
            </div>
            {allTags.length > 0 && (
              <div className="mt-1">
                <TagPicker
                  allTags={allTags}
                  activeTags={repairTags}
                  onAdd={(tagId) => addTagToRepair(job.id, tagId)}
                  onRemove={(tagId) => removeTagFromRepair(job.id, tagId)}
                />
              </div>
            )}
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

      <RepairProgressTracker
        data={{
          status,
          invoiceStatus,
          holdedQuoteId: job.holdedQuoteId,
          holdedQuoteNum: job.holdedQuoteNum,
          holdedInvoiceId: job.holdedInvoiceId,
          holdedInvoiceNum: job.holdedInvoiceNum,
        }}
      />

      <WorkflowGuide page="repair-detail" context={{ job, settings }} />

      <SmartSuggestions suggestions={getRepairSuggestions(job, suggestionActions)} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-5 lg:col-span-2">
          {/* Issue description */}
          <Card className="rounded-xl" ref={descriptionRef}>
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
          <Card className="rounded-xl" ref={costRef}>
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
                  {/* Column headers */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider pb-1 border-b">
                    <span className="w-10 shrink-0">Type</span>
                    <span className="flex-1">Description</span>
                    <span className="w-14 text-center">Qty</span>
                    <span className="w-20 text-right">Our cost</span>
                    <span className="w-20 text-right">Sell</span>
                    <span className="w-16 text-right">Total</span>
                    <span className="w-6" />
                  </div>

                  {costLines.map((line) => (
                    <div key={line.id} className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium uppercase tracking-wider w-10 shrink-0 ${
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
                      <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.internalCost}
                          onChange={(e) => updateCostLine(line.id, "internalCost", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs pl-5 pr-2 text-right rounded-lg bg-orange-50 dark:bg-orange-950/20"
                          title="Our cost (purchase/internal)"
                        />
                      </div>
                      <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.unitPrice}
                          onChange={(e) => updateCostLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="h-7 text-xs pl-5 pr-2 text-right rounded-lg"
                          title="Sell price"
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
                      <span className="text-xs text-muted-foreground">Our total cost</span>
                      <span className="text-xs tabular-nums text-orange-600 dark:text-orange-400">€{costLinesInternalTotal.toFixed(2)}</span>
                    </div>
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
                          → Estimated
                        </Button>
                      </div>
                    </div>
                    {costLinesInternalTotal > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">Margin</span>
                        <span className={`text-xs font-medium tabular-nums ${costLinesTotal - costLinesInternalTotal >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          €{(costLinesTotal - costLinesInternalTotal).toFixed(2)} ({costLinesInternalTotal > 0 ? Math.round((costLinesTotal - costLinesInternalTotal) / costLinesInternalTotal * 100) : 0}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground py-2">
                  Add parts, labour hours, or custom lines to build a cost estimate.
                </p>
              )}
              <HoldedHint variant="info" className="mt-3">
                Prices are excl. VAT. Build lines → click <strong>"→ Estimated"</strong> → <strong>Create Quote</strong>. After work: adjust actual → <strong>Create Invoice</strong>.
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
          <Card className="rounded-xl" ref={communicationRef}>
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
                customerName={job.customer?.name}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status + Info — merged card */}
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
                  <Select value={invoiceStatus} onValueChange={(val) => {
                    setInvoiceStatus(val);
                    // Auto-set repair status + contact to rejected/declined when invoice is rejected
                    if (val === "rejected") {
                      setStatus("rejected");
                      setCustomerResponseStatus("declined");
                    }
                  }}>
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
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox
                  checked={warrantyFlag}
                  onCheckedChange={(checked) => {
                    const val = checked === true;
                    setWarrantyFlag(val);
                    if (val) {
                      setInvoiceStatus("warranty");
                      if (["new", "todo", "in_inspection", "quote_needed", "waiting_approval", "waiting_customer", "waiting_parts", "scheduled", "in_progress", "blocked"].includes(status)) {
                        setStatus("completed");
                      }
                    } else if (!val && invoiceStatus === "warranty") {
                      setInvoiceStatus("not_invoiced");
                    }
                  }}
                />
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Our Cost (warranty / internal)</span>
              </label>

              {/* Info section — integrated */}
              <div className="border-t pt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Location
                  </span>
                  <span className="font-medium text-right">{job.location?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Position
                  </span>
                  <span className="font-mono text-xs font-medium text-right">{job.unit?.currentPosition ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Storage
                  </span>
                  <span className="text-xs font-medium text-right">{job.unit?.storageLocation ? `${job.unit.storageLocation}${job.unit.storageType ? ` (${job.unit.storageType})` : ""}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Contact
                  </span>
                  {job.customer ? (
                    <span className="flex items-center gap-1.5">
                      <Link href={`/customers/${job.customer.id}`} className="font-medium text-primary hover:underline text-right">
                        {job.customer.name}
                      </Link>
                      <button onClick={() => setExpandCustomer((v) => !v)} className="p-0.5 rounded hover:bg-muted" title="Edit customer">
                        <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                {expandCustomer && job.customer && (
                  <InlineCustomerEdit customer={job.customer} onDone={() => setExpandCustomer(false)} />
                )}
                {job.unit && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Unit
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Link href={`/units/${job.unit.id}`} className="font-medium text-primary hover:underline text-right text-xs">
                        {[job.unit.brand, job.unit.model].filter(Boolean).join(" ") || "Unit"}{job.unit.registration ? ` · ${job.unit.registration}` : ""}
                      </Link>
                      <button onClick={() => setExpandUnit((v) => !v)} className="p-0.5 rounded hover:bg-muted" title="Edit unit">
                        <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    </span>
                  </div>
                )}
                {expandUnit && job.unit && (
                  <InlineUnitEdit unit={job.unit} onDone={() => setExpandUnit(false)} />
                )}
                {!job.unit && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5" />
                      Unit
                    </span>
                    <span className="text-muted-foreground">—</span>
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
                {job.holdedInvoiceDate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      Invoice Date
                    </span>
                    <span className="text-right">{format(new Date(job.holdedInvoiceDate), "dd MMM yyyy")}</span>
                  </div>
                )}
                {job.dueDate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Due Date
                    </span>
                    <span className="text-right">{format(new Date(job.dueDate), "dd MMM yyyy")}</span>
                  </div>
                )}
                {/* Planning date — editable */}
                <PlanningDateRow jobId={job.id} dueDate={job.dueDate} />
              </div>

              {/* Costs section — integrated */}
              {(job.estimatedCost || job.actualCost || true) && (
                <div className="border-t pt-2.5 mt-2.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="shrink-0">
                      <span className="flex items-center gap-2 text-muted-foreground text-sm">
                        <DollarSign className="h-3.5 w-3.5" />
                        Estimated
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-5.5 leading-none">→ for quote</span>
                    </div>
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
                    <div className="shrink-0">
                      <span className="flex items-center gap-2 text-muted-foreground text-sm">
                        <DollarSign className="h-3.5 w-3.5" />
                        Actual
                      </span>
                      <span className="text-[10px] text-muted-foreground/60 ml-5.5 leading-none">→ for invoice</span>
                    </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-orange-600 dark:text-orange-400 shrink-0">
                      <DollarSign className="h-3.5 w-3.5" />
                      Our Cost
                    </span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={internalCost}
                        onChange={(e) => setInternalCost(e.target.value)}
                        className="h-7 text-xs pl-5 pr-2 text-right rounded-lg bg-orange-50 dark:bg-orange-950/20"
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
            </CardContent>
          </Card>

          {/* Flags — compact toggleable pills */}
          <Card className="rounded-xl">
            <CardContent className="pt-5">
              <p className="flex items-center gap-2 text-xs font-semibold mb-3">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                Flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { label: "Water Damage", value: waterDamageFlag, set: setWaterDamageFlag, danger: true },
                  { label: "Safety", value: safetyFlag, set: setSafetyFlag, danger: true },
                  { label: "Tyres", value: tyresFlag, set: setTyresFlag, danger: false },
                  { label: "Lighting", value: lightsFlag, set: setLightsFlag, danger: false },
                  { label: "Brakes", value: brakesFlag, set: setBrakesFlag, danger: false },
                  { label: "Windows", value: windowsFlag, set: setWindowsFlag, danger: false },
                  { label: "Seals", value: sealsFlag, set: setSealsFlag, danger: false },
                  { label: "Parts Required", value: partsRequiredFlag, set: setPartsRequiredFlag, danger: false },
                  { label: "Follow-up", value: followUpRequiredFlag, set: setFollowUpRequiredFlag, danger: false },
                  { label: "Prepaid", value: prepaidFlag, set: setPrepaidFlag, danger: false },
                ] as const).map((flag) => (
                  <button
                    key={flag.label}
                    type="button"
                    onClick={() => flag.set(!flag.value)}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer border ${
                      flag.value
                        ? flag.danger
                          ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                          : "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted/50 text-muted-foreground border-transparent hover:border-border"
                    }`}
                  >
                    {flag.value && <span className="mr-1">✓</span>}
                    {flag.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer Repairs */}
          {job.customer && customerRepairs.length > 0 && (
            <CustomerRepairsCard repairs={customerRepairs} customerName={job.customer.name} />
          )}

          {/* Holded Documents */}
          <div ref={holdedRef}>
          <HoldedDocumentsCard
            job={job}
            costLines={costLines}
            discountPercent={discountPercent}
            settings={settings}
            router={router}
          />
          </div>

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

      {/* ── Customer Linker Dialog ── */}
      <Dialog open={showCustomerLinker} onOpenChange={setShowCustomerLinker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link a customer</DialogTitle>
          </DialogHeader>
          <CustomerSearch
            customers={allCustomers}
            onSelect={async (customerId) => {
              if (!customerId) return;
              try {
                await updateRepairJob(job.id, { customerId });
                toast.success("Customer linked");
                setShowCustomerLinker(false);
                router.refresh();
              } catch {
                toast.error("Failed to link customer");
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── User Assignment Dialog ── */}
      <Dialog open={showUserAssigner} onOpenChange={setShowUserAssigner}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign to</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={async () => {
                  try {
                    await updateRepairJob(job.id, { assignedUserId: u.id });
                    toast.success(`Assigned to ${u.name}`);
                    setShowUserAssigner(false);
                    router.refresh();
                  } catch {
                    toast.error("Failed to assign");
                  }
                }}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                {u.name}
              </button>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No users available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Planning Date Row ───

function PlanningDateRow({ jobId, dueDate }: { jobId: string; dueDate: string | Date | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : "";

  async function handleSet(dateStr: string) {
    if (!dateStr) return;
    setSaving(true);
    try {
      const d = new Date(dateStr);
      d.setHours(8, 0, 0, 0);
      await scheduleRepair(jobId, d.toISOString());
      toast.success(`Planned for ${format(d, "dd MMM yyyy")}`);
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to set planning date");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await unscheduleRepair(jobId);
      toast.success("Removed from planning");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to remove planning date");
    } finally {
      setSaving(false);
    }
  }

  if (!dueDate && !editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          Planning
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-primary hover:underline font-medium"
        >
          + Plan
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <span className="flex items-center gap-2 text-muted-foreground text-sm">
          <CalendarDays className="h-3.5 w-3.5" />
          Planning
        </span>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            defaultValue={current}
            className="h-7 text-xs rounded-lg flex-1"
            disabled={saving}
            autoFocus
            onChange={(e) => {
              if (e.target.value) handleSet(e.target.value);
            }}
          />
          {dueDate && (
            <button onClick={handleRemove} disabled={saving} className="p-1 rounded hover:bg-muted" title="Remove from planning">
              <XIcon className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-muted">
            <XIcon className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  // Has date — show with edit option
  return (
    <div className="flex items-center justify-between group/plan">
      <span className="flex items-center gap-2 text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Planning
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-right font-medium text-sm">{format(new Date(dueDate!), "dd MMM yyyy")}</span>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover/plan:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        >
          <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      </span>
    </div>
  );
}

// ─── Inline Customer Edit ───

function InlineCustomerEdit({ customer, onDone }: { customer: any; onDone: () => void }) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [name, setName] = useState(customer.name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [mobile, setMobile] = useState(customer.mobile ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [city, setCity] = useState(customer.city ?? "");
  const [postalCode, setPostalCode] = useState(customer.postalCode ?? "");
  const [country, setCountry] = useState(customer.country ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, {
          name, email: email || undefined, phone: phone || undefined,
          mobile: mobile || undefined, address: address || undefined,
          city: city || undefined, postalCode: postalCode || undefined,
          country: country || undefined, notes: notes || undefined,
          contactType: customer.contactType ?? "person",
        });
        toast.success("Customer updated");
        router.refresh();
        onDone();
      } catch {
        toast.error("Failed to update customer");
      }
    });
  }

  const fields: [string, string, (v: string) => void][] = [
    ["Name", name, setName], ["Email", email, setEmail], ["Phone", phone, setPhone],
    ["Mobile", mobile, setMobile], ["Address", address, setAddress],
    ["City", city, setCity], ["Postal Code", postalCode, setPostalCode],
    ["Country", country, setCountry],
  ];

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2 animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, value, setter]) => (
          <div key={label}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
            <Input value={value} onChange={(e) => setter(e.target.value)} className="h-7 text-xs rounded-md mt-0.5" />
          </div>
        ))}
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs rounded-md mt-0.5" />
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="h-6 text-[11px] rounded-lg" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Inline Unit Edit ───

function InlineUnitEdit({ unit, onDone }: { unit: any; onDone: () => void }) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [registration, setRegistration] = useState(unit.registration ?? "");
  const [brand, setBrand] = useState(unit.brand ?? "");
  const [model, setModel] = useState(unit.model ?? "");
  const [year, setYear] = useState(unit.year?.toString() ?? "");
  const [chassisId, setChassisId] = useState(unit.chassisId ?? "");
  const [length, setLength] = useState(unit.length ?? "");
  const [storageLocation, setStorageLocation] = useState(unit.storageLocation ?? "");
  const [storageType, setStorageType] = useState(unit.storageType ?? "");
  const [currentPosition, setCurrentPosition] = useState(unit.currentPosition ?? "");
  const [nfcTag, setNfcTag] = useState(unit.nfcTag ?? "");
  const [notes, setNotes] = useState(unit.notes ?? "");

  function handleSave() {
    startTransition(async () => {
      try {
        await updateUnit(unit.id, {
          registration: registration || undefined, brand: brand || undefined,
          model: model || undefined, year: year ? Number(year) : undefined,
          chassisId: chassisId || undefined, length: length || undefined,
          storageLocation: storageLocation || undefined, storageType: storageType || undefined,
          currentPosition: currentPosition || undefined, nfcTag: nfcTag || undefined,
          notes: notes || undefined, customerId: unit.customerId,
        });
        toast.success("Unit updated");
        router.refresh();
        onDone();
      } catch {
        toast.error("Failed to update unit");
      }
    });
  }

  const fields: [string, string, (v: string) => void, string?][] = [
    ["Registration", registration, setRegistration, "font-mono"],
    ["Brand", brand, setBrand], ["Model", model, setModel],
    ["Year", year, setYear], ["Chassis", chassisId, setChassisId, "font-mono"],
    ["Length", length, setLength],
    ["Storage Loc.", storageLocation, setStorageLocation],
    ["Storage Type", storageType, setStorageType],
    ["Position", currentPosition, setCurrentPosition],
    ["NFC Tag", nfcTag, setNfcTag, "font-mono"],
  ];

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2 animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([label, value, setter, extra]) => (
          <div key={label}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
            <Input value={value} onChange={(e) => setter(e.target.value)} className={`h-7 text-xs rounded-md mt-0.5 ${extra ?? ""}`} />
          </div>
        ))}
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs rounded-md mt-0.5" />
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="h-6 text-[11px] rounded-lg" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner className="mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Holded Documents Card ───

function HoldedDocumentsCard({
  job, costLines, discountPercent, settings, router,
}: {
  job: any;
  costLines: CostLineItem[];
  discountPercent: number;
  settings: PricingSettings;
  router: ReturnType<typeof useRouter>;
}) {
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(false);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const quoteSent = !!job.holdedQuoteSentAt;
  const invoiceSent = !!job.holdedInvoiceSentAt;

  // Unsent document warning — uses beforeunload for browser navigation
  const hasUnsentDoc = (job.holdedQuoteId && !quoteSent) || (job.holdedInvoiceId && !invoiceSent);

  useEffect(() => {
    if (!hasUnsentDoc) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsentDoc]);

  async function handleAction(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    } finally {
      setLoading(null);
    }
  }

  const actualCost = job.actualCost ? parseFloat(job.actualCost) : 0;
  const estimatedCost = job.estimatedCost ? parseFloat(job.estimatedCost) : 0;

  return (
    <Card className="rounded-xl">
      <CardContent className="pt-5">
        <p className="flex items-center gap-2 text-xs font-semibold mb-3">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          Holded Documents
        </p>

        {/* Unsent warning banner */}
        {hasUnsentDoc && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 mb-3 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {job.holdedQuoteId && !quoteSent && job.holdedInvoiceId && !invoiceSent
                ? "Quote and invoice not yet emailed to customer"
                : job.holdedQuoteId && !quoteSent
                ? "Quote not yet emailed to customer"
                : "Invoice not yet emailed to customer"
              }
            </span>
          </div>
        )}

        {/* ── Quote section ── */}
        <div className="space-y-2 mb-3">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Quote</p>
          {job.holdedQuoteId ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {job.holdedQuoteNum} ↗
                  </a>
                  {quoteSent ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Sent
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Not sent
                    </Badge>
                  )}
                </div>
                <a
                  href={`https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                >
                  Holded ↗
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => window.open(`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`, "_blank")}
                >
                  <FileDown className="h-3 w-3 mr-1" /> View PDF
                </Button>
                {job.customer?.email && (
                  <Button
                    variant={quoteSent ? "outline" : "default"} size="sm" className="flex-1 text-xs"
                    disabled={loading === "send-quote"}
                    onClick={() => handleAction("send-quote", async () => {
                      await sendHoldedQuote(job.id);
                      toast.success("Quote sent to " + job.customer.email);
                      router.refresh();
                    })}
                  >
                    {loading === "send-quote" ? <Spinner className="mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                    {quoteSent ? "Resend" : "Email"}
                  </Button>
                )}
              </div>
              {/* Delete quote */}
              {confirmDeleteQuote ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 dark:border-red-900 dark:bg-red-950/50">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="text-[11px] text-red-700 dark:text-red-400 flex-1">
                    Delete quote {job.holdedQuoteNum} from Holded?
                  </span>
                  <Button
                    variant="destructive" size="sm" className="h-6 text-[11px] px-2"
                    disabled={loading === "delete-quote"}
                    onClick={() => handleAction("delete-quote", async () => {
                      await deleteHoldedQuote(job.id);
                      toast.success("Quote deleted from Holded");
                      setConfirmDeleteQuote(false);
                      router.refresh();
                    })}
                  >
                    {loading === "delete-quote" ? <Spinner /> : "Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDeleteQuote(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDeleteQuote(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete Quote
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Button
                variant="outline" size="sm" className="w-full text-xs"
                disabled={!job.customer || costLines.length === 0 || !!loading}
                onClick={() => handleAction("create-quote", async () => {
                  const result = await createHoldedQuote(job.id, costLines.map(l => ({
                    name: l.description || "Line item",
                    units: l.quantity,
                    subtotal: l.unitPrice * l.quantity,
                    tax: settings.defaultTax,
                    discount: 0,
                  })), discountPercent);
                  toast.success(`Quote ${result.quoteNum} created`);
                  router.refresh();
                })}
              >
                {loading === "create-quote" ? <Spinner className="mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                Create Quote
              </Button>
              {job.customer?.email && (
                <Button
                  variant="outline" size="sm" className="w-full text-xs"
                  disabled={!job.customer || costLines.length === 0 || !!loading}
                  onClick={() => handleAction("create-send-quote", async () => {
                    const result = await createHoldedQuote(job.id, costLines.map(l => ({
                      name: l.description || "Line item",
                      units: l.quantity,
                      subtotal: l.unitPrice * l.quantity,
                      tax: settings.defaultTax,
                      discount: 0,
                    })), discountPercent);
                    await sendHoldedQuote(job.id);
                    toast.success(`Quote ${result.quoteNum} created & sent to ${job.customer.email}`);
                    router.refresh();
                  })}
                >
                  {loading === "create-send-quote" ? <Spinner className="mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  Create & Send Quote
                </Button>
              )}
              {!job.customer && <p className="text-[11px] text-muted-foreground">Link a contact first</p>}
              {job.customer && costLines.length === 0 && <p className="text-[11px] text-muted-foreground">Add cost lines first</p>}
            </div>
          )}
        </div>

        {/* ── Invoice section ── */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoice</p>
          {job.holdedInvoiceId ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {job.holdedInvoiceNum} ↗
                  </a>
                  {invoiceSent ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Sent
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Not sent
                    </Badge>
                  )}
                </div>
                <a
                  href={`https://app.holded.com/invoicing/invoice/${job.holdedInvoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                >
                  Holded ↗
                </a>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="flex-1 text-xs"
                  onClick={() => window.open(`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`, "_blank")}
                >
                  <FileDown className="h-3 w-3 mr-1" /> View PDF
                </Button>
                {job.customer?.email && (
                  <Button
                    variant={invoiceSent ? "outline" : "default"} size="sm" className="flex-1 text-xs"
                    disabled={loading === "send-invoice"}
                    onClick={() => handleAction("send-invoice", async () => {
                      await sendHoldedInvoice(job.id);
                      toast.success("Invoice sent to " + job.customer.email);
                      router.refresh();
                    })}
                  >
                    {loading === "send-invoice" ? <Spinner className="mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                    {invoiceSent ? "Resend" : "Email"}
                  </Button>
                )}
              </div>
              {/* Delete invoice */}
              {job.invoiceStatus !== "paid" && (
                confirmDeleteInvoice ? (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 dark:border-red-900 dark:bg-red-950/50">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                    <span className="text-[11px] text-red-700 dark:text-red-400 flex-1">
                      Delete invoice {job.holdedInvoiceNum} from Holded?
                    </span>
                    <Button
                      variant="destructive" size="sm" className="h-6 text-[11px] px-2"
                      disabled={loading === "delete-invoice"}
                      onClick={() => handleAction("delete-invoice", async () => {
                        await deleteHoldedInvoice(job.id);
                        toast.success("Invoice deleted from Holded");
                        setConfirmDeleteInvoice(false);
                        router.refresh();
                      })}
                    >
                      {loading === "delete-invoice" ? <Spinner /> : "Delete"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDeleteInvoice(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmDeleteInvoice(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Delete Invoice
                  </Button>
                )
              )}
            </div>
          ) : (
            <div>
              <Button
                variant="default" size="sm" className="w-full text-xs"
                disabled={!job.customer || (costLines.length === 0 && !actualCost && !estimatedCost) || !!loading}
                onClick={() => handleAction("create-invoice", async () => {
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
                })}
              >
                {loading === "create-invoice" ? <Spinner className="mr-1" /> : <Receipt className="h-3 w-3 mr-1" />}
                Create Invoice
              </Button>
              {!job.customer && <p className="text-[11px] text-muted-foreground mt-1.5">Link a contact first</p>}
              {job.customer && costLines.length === 0 && !actualCost && !estimatedCost && (
                <p className="text-[11px] text-muted-foreground mt-1.5">Add lines or a cost estimate first</p>
              )}
            </div>
          )}
        </div>

        {/* Verify Holded links */}
        {(job.holdedInvoiceId || job.holdedQuoteId) && (
          <div className="border-t pt-3 mt-3">
            <Button
              variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
              onClick={() => handleAction("verify", async () => {
                const result = await verifyHoldedDocuments(job.id);
                if (result.fixed) {
                  toast.success(result.issues.join(". "));
                  router.refresh();
                } else {
                  toast.success("All Holded links verified ✓");
                }
              })}
            >
              {loading === "verify" ? <Spinner className="mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Verify Holded Links
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Customer Repairs Card ───

function CustomerRepairsCard({ repairs, customerName }: { repairs: CustomerRepairItem[]; customerName: string }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? repairs : repairs.slice(0, 5);

  return (
    <Card className="rounded-xl">
      <CardContent className="pt-5">
        <p className="flex items-center gap-2 text-xs font-semibold mb-3">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          {customerName}&apos;s Repairs
          <span className="text-muted-foreground font-normal">({repairs.length})</span>
        </p>
        <div className="space-y-1">
          {shown.map((r) => (
            <Link
              key={r.id}
              href={`/repairs/${r.id}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium group-hover:text-primary truncate block">
                  {r.publicCode ? `${r.publicCode} — ` : ""}{r.title ?? "Untitled"}
                </span>
                {r.completedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(r.completedAt), "dd MMM yyyy")}
                  </span>
                )}
              </div>
              <Badge
                variant="secondary"
                className={`text-[9px] px-1.5 py-0 shrink-0 ml-2 ${STATUS_COLORS[r.status as RepairStatus] ?? ""}`}
              >
                {STATUS_LABELS[r.status as RepairStatus] ?? r.status}
              </Badge>
            </Link>
          ))}
        </div>
        {repairs.length > 5 && (
          <Button
            variant="ghost" size="sm"
            className="w-full text-xs text-muted-foreground mt-1"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> Show all {repairs.length}</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
