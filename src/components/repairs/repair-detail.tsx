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
import { createPartRequest, updatePartRequestStatus } from "@/actions/parts";
import { createPart } from "@/actions/parts";
import { addRepairWorker, removeRepairWorker } from "@/actions/garage";
import { scheduleRepair, unscheduleRepair } from "@/actions/planning";
import { updateCustomer } from "@/actions/customers";
import { updateUnit } from "@/actions/units";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearch } from "@/components/customers/customer-search";
import { type RepairSuggestionActions } from "@/components/smart-suggestions";
import { useAssistantContext } from "@/components/assistant-context";
import { TagPicker, type TagItem } from "@/components/tag-picker";

import { addTagToRepair, removeTagFromRepair } from "@/actions/tags";
import { RepairTaskList } from "@/components/repairs/repair-task-list";
import type { RepairTask } from "@/types";

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

interface PartRequestItem {
  id: string;
  partName: string;
  quantity: number;
  status: string;
  expectedDelivery: Date | string | null;
  supplierName: string | null;
  notes: string | null;
}

interface UserItem {
  id: string;
  name: string | null;
}

interface WorkerItem {
  id: string;
  userId: string;
  userName: string;
  note: string | null;
  createdAt: Date | string;
}

interface ActiveUserItem {
  id: string;
  name: string;
  role: string;
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
  tasks?: RepairTask[];
  partRequests?: PartRequestItem[];
  repairWorkers?: WorkerItem[];
  activeUsers?: ActiveUserItem[];
}

export function RepairDetail({ job, communicationLogs = [], partsList = [], backTo, settings = { hourlyRate: 42.50, defaultMarkup: 25, defaultTax: 21 }, allTags = [], repairTags = [], customerRepairs = [], users = [], allCustomers = [], tasks = [], partRequests = [], repairWorkers = [], activeUsers = [] }: RepairDetailProps) {
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
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);

  // Flag definitions for rendering
  const allFlags = [
    { label: "Water Damage", value: waterDamageFlag, set: setWaterDamageFlag, danger: true },
    { label: "Safety", value: safetyFlag, set: setSafetyFlag, danger: true },
    { label: "Tyres", value: tyresFlag, set: setTyresFlag, danger: false },
    { label: "Lighting", value: lightsFlag, set: setLightsFlag, danger: false },
    { label: "Brakes", value: brakesFlag, set: setBrakesFlag, danger: true },
    { label: "Windows", value: windowsFlag, set: setWindowsFlag, danger: false },
    { label: "Seals", value: sealsFlag, set: setSealsFlag, danger: false },
    { label: "Parts Req.", value: partsRequiredFlag, set: setPartsRequiredFlag, danger: false },
    { label: "Follow-up", value: followUpRequiredFlag, set: setFollowUpRequiredFlag, danger: false },
    { label: "Prepaid", value: prepaidFlag, set: setPrepaidFlag, danger: false },
  ] as const;
  const activeFlags = allFlags.filter((f) => f.value);
  const inactiveFlags = allFlags.filter((f) => !f.value);

  const costLinesSubtotal = costLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const costLinesInternalTotal = costLines.reduce((sum, l) => sum + l.quantity * l.internalCost, 0);
  const discountAmount = costLinesSubtotal * (discountPercent / 100);
  const costLinesTotal = costLinesSubtotal - discountAmount;
  const costLinesTotalInclTax = costLinesTotal * (1 + settings.defaultTax / 100);

  // Auto-sync Actual + Our Cost from line items
  useEffect(() => {
    if (costLines.length > 0) {
      setActualCost(costLinesTotalInclTax.toFixed(2));
      setInternalCost(costLinesInternalTotal.toFixed(2));
    }
  }, [costLines, costLinesTotalInclTax, costLinesInternalTotal]);

  // Part requests state
  const [addingPartName, setAddingPartName] = useState("");
  const [showAddPart, setShowAddPart] = useState(false);
  const [partRequestsPending, startPartTransition] = useTransition();

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
    onCreateInvoice: () => costRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    onCreateQuote: () => costRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
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

  // Workflow step computation for Estimate → Quote → Invoice stepper
  const hasEstimate = parseFloat(estimatedCost || "0") > 0;
  const hasQuote = !!job.holdedQuoteId;
  const hasInvoice = !!job.holdedInvoiceId;
  const isPaid = job.invoiceStatus === "paid";
  const workflowStep = isPaid ? 4 : hasInvoice ? 3 : hasQuote ? 2 : hasEstimate ? 1 : 0;

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
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-1.5 p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="min-w-0 flex-1">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg font-semibold h-10 rounded-lg border-0 bg-muted/50 px-3"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setEditingTitle(false); }}
                  />
                  <button onClick={() => setEditingTitle(false)} className="p-1 rounded hover:bg-muted">
                    <XIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="group text-left w-full"
                >
                  <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug line-clamp-2">
                    {title || job.publicCode || "Untitled repair"}
                  </h1>
                </button>
              )}
              <p className="text-sm text-muted-foreground mt-0.5">
                {job.publicCode && title ? job.publicCode : ''}
                {job.customer ? `${job.publicCode && title ? ' · ' : ''}${job.customer.name}` : ''}
                {job.unit ? ` · ${[job.unit.brand, job.unit.model].filter(Boolean).join(' ')}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
            </button>
            <Button onClick={handleSave} disabled={saving} size="sm" className="rounded-lg h-9 px-5 font-medium">
              {saving ? <Spinner className="mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>

        {/* Status chips + tags */}
        <div className="flex items-center gap-2 flex-wrap pl-10">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status as RepairStatus] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABELS[status as RepairStatus]}
          </span>
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority as Priority] ?? 'bg-muted text-muted-foreground'}`}>
            {PRIORITY_LABELS[priority as Priority]}
          </span>
          {allTags.length > 0 && (
            <TagPicker
              allTags={allTags}
              activeTags={repairTags}
              onAdd={(tagId) => addTagToRepair(job.id, tagId)}
              onRemove={(tagId) => removeTagFromRepair(job.id, tagId)}
            />
          )}
        </div>
      </div>

      {/* ── Past Repairs ── */}
      {job.customer && customerRepairs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Past Repairs</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {customerRepairs.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href={`/repairs/${r.id}`}
                className="flex items-start gap-3 rounded-xl bg-muted/40 hover:bg-muted/70 px-4 py-3 min-w-[220px] transition-colors group"
              >
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted text-sm font-bold text-muted-foreground shrink-0 mt-0.5">
                  {(r.publicCode ?? 'R').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {r.title ? r.title.slice(0, 35) + (r.title.length > 35 ? '…' : '') : r.publicCode ?? 'Repair'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(r.createdAt), "dd MMM yyyy")}
                    <span className="mx-1.5">·</span>
                    {STATUS_LABELS[r.status as RepairStatus] ?? r.status}
                  </p>
                </div>
              </Link>
            ))}
            {customerRepairs.length > 6 && (
              <div className="flex items-center text-xs text-muted-foreground font-medium px-4 shrink-0">
                +{customerRepairs.length - 6} more
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">

          {/* ═══ WORK CLUSTER ═══ */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">Work</p>

          {/* Issue description + notes merged */}
          <div className="rounded-xl bg-muted/30 border border-border/50 p-6" ref={descriptionRef}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
              {!editingDescription && (
                <button type="button" onClick={() => setEditingDescription(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Edit
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  autoFocus
                  className="rounded-lg text-sm border-0 bg-background/60"
                />
                <button onClick={() => setEditingDescription(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {description || <span className="text-muted-foreground italic">No description</span>}
              </div>
            )}
            {job.descriptionNormalized && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                <p className="text-sm text-muted-foreground">{job.descriptionNormalized}</p>
              </div>
            )}
            {/* Internal notes */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <details className="group" open={!!internalComments}>
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none flex items-center gap-1.5">
                  Internal notes
                  {internalComments && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </summary>
                <Textarea
                  value={internalComments}
                  onChange={(e) => setInternalComments(e.target.value)}
                  rows={2}
                  placeholder="Private staff notes..."
                  className="rounded-lg text-sm resize-none mt-2 border-0 bg-background/60"
                />
              </details>
            </div>
          </div>

          {/* Parts needed */}
          {job.partsNeededRaw && (
            <div className="rounded-xl bg-muted/30 border border-border/50 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Parts Needed</h3>
              <div className="whitespace-pre-wrap text-sm">{job.partsNeededRaw}</div>
            </div>
          )}

          {/* ── GARAGE ZONE — workers, planning, flags, tasks, parts ── */}
          <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
            <details open>
              <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                Garage
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </summary>
            <div className="px-6 pb-6 space-y-5">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Assigned workers */}
                <div>
                  <Label className="text-xs text-muted-foreground">Assigned</Label>
                  {repairWorkers.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {repairWorkers.map((w) => (
                        <span key={w.id} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium group">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-foreground/10 text-[10px] font-bold text-foreground/70">
                            {w.userName.charAt(0).toUpperCase()}
                          </span>
                          {w.userName}
                          <button
                            onClick={() => {
                              startPartTransition(async () => {
                                await removeRepairWorker(job.id, w.userId);
                                router.refresh();
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-0.5"
                            title="Remove"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const availableUsers = activeUsers.filter(
                      (u) => !repairWorkers.some((w) => w.userId === u.id) && u.role === "technician"
                    );
                    if (availableUsers.length === 0) return null;
                    return (
                      <Select
                        value=""
                        onValueChange={(userId) => {
                          startPartTransition(async () => {
                            await addRepairWorker(job.id, userId);
                            router.refresh();
                          });
                        }}
                      >
                        <SelectTrigger className="mt-1.5 h-8 text-xs rounded-lg border-border/50"><SelectValue placeholder="+ Add worker..." /></SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>

                {/* Planning + Send to Garage */}
                <div>
                  <PlanningDateRow jobId={job.id} dueDate={job.dueDate} status={job.status} />
                </div>
              </div>

              {/* Flags */}
              <div className="border-t border-border/30 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">Inspection Flags</p>
                  {!showAllFlags && (
                    <button
                      onClick={() => setShowAllFlags(true)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeFlags.map((flag) => (
                    <button
                      key={flag.label}
                      type="button"
                      onClick={() => flag.set(!flag.value)}
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border ${
                        flag.danger
                          ? "bg-red-50 text-red-600 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/60"
                          : "bg-muted text-foreground/80 border-border/60"
                      }`}
                    >
                      <span className="mr-1">✓</span>
                      {flag.label}
                    </button>
                  ))}
                  {showAllFlags && inactiveFlags.map((flag) => (
                    <button
                      key={flag.label}
                      type="button"
                      onClick={() => flag.set(true)}
                      className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border bg-transparent text-muted-foreground border-border/40 hover:border-border"
                    >
                      {flag.label}
                    </button>
                  ))}
                  {showAllFlags && (
                    <button
                      type="button"
                      onClick={() => setShowAllFlags(false)}
                      className="inline-flex items-center rounded-full px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  )}
                  {activeFlags.length === 0 && !showAllFlags && (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </div>
              </div>
              {/* Garage Tasks */}
              <div className="border-t border-border/30 pt-4">
                <RepairTaskList repairJobId={job.id} initialTasks={tasks} />
              </div>

              {/* Parts Used */}
              <div className="border-t border-border/30 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">
                      Parts Used
                    {partRequests.length > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        partRequests.every(p => p.status === "received" || p.status === "cancelled")
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                          : "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                      }`}>
                        {partRequests.filter(p => p.status === "received").length}/{partRequests.filter(p => p.status !== "cancelled").length}
                      </span>
                    )}
                  </p>
                  {!showAddPart && (
                    <button
                      onClick={() => setShowAddPart(true)}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              {/* Inline add form — search catalog */}
              {showAddPart && (
                <div className="mb-3 space-y-2">
                  <Input
                    value={addingPartName}
                    onChange={(e) => setAddingPartName(e.target.value)}
                    placeholder="Search parts catalog..."
                    className="h-8 text-sm rounded-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setShowAddPart(false); setAddingPartName(""); }
                    }}
                  />
                  {/* Matching parts from catalog */}
                  {addingPartName.trim().length >= 1 && (
                    <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-lg border bg-white/80 dark:bg-black/20 p-1">
                      {partsList
                        .filter((p) => p.name.toLowerCase().includes(addingPartName.toLowerCase()))
                        .slice(0, 8)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              startPartTransition(async () => {
                                await createPartRequest({ repairJobId: job.id, partName: p.name });
                                setAddingPartName("");
                                setShowAddPart(false);
                                router.refresh();
                              });
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-md text-xs hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{p.partNumber ?? ''}</span>
                          </button>
                        ))}
                      {partsList.filter((p) => p.name.toLowerCase().includes(addingPartName.toLowerCase())).length === 0 && (
                        <p className="text-[11px] text-muted-foreground py-2 text-center">No matching parts in catalog</p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {/* Add as custom (not in catalog) */}
                    <button
                      onClick={() => {
                        if (!addingPartName.trim()) return;
                        startPartTransition(async () => {
                          await createPartRequest({ repairJobId: job.id, partName: addingPartName });
                          setAddingPartName("");
                          setShowAddPart(false);
                          router.refresh();
                        });
                      }}
                      disabled={!addingPartName.trim() || partRequestsPending}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Use &quot;{addingPartName || '...'}&quot; as-is
                    </button>
                    <span className="text-muted-foreground text-xs">·</span>
                    {/* Add New Part to catalog */}
                    <button
                      onClick={() => {
                        if (!addingPartName.trim()) return;
                        startPartTransition(async () => {
                          const newPart = await createPart({ name: addingPartName, stockQuantity: 0, minStockLevel: 0 });
                          await createPartRequest({ repairJobId: job.id, partName: newPart.name });
                          setAddingPartName("");
                          setShowAddPart(false);
                          toast.success(`Part "${newPart.name}" added to catalog`);
                          router.refresh();
                        });
                      }}
                      disabled={!addingPartName.trim() || partRequestsPending}
                      className="text-xs text-muted-foreground hover:text-foreground font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      Add &quot;{addingPartName || '...'}&quot; to catalog
                    </button>
                    <button onClick={() => { setShowAddPart(false); setAddingPartName(""); }} className="text-muted-foreground hover:text-foreground ml-auto">
                      <XIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Parts from cost estimate */}
              {costLines.filter(l => l.type === "part").length > 0 && partRequests.length === 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">From Quote</p>
                  <div className="space-y-1">
                    {costLines.filter(l => l.type === "part").map((l) => (
                      <div key={l.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/60 dark:bg-white/5 border">
                        <span className="truncate font-medium">{l.description}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">×{l.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Part requests */}
              {partRequests.length > 0 ? (
                <div className="space-y-1">
                  {partRequests.map((pr) => (
                    <div key={pr.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-white/60 dark:bg-white/5 border">
                      <span className="truncate font-medium mr-2">
                        {pr.partName}
                        {pr.quantity > 1 && <span className="text-muted-foreground"> ×{pr.quantity}</span>}
                      </span>
                      <Select
                        value={pr.status}
                        onValueChange={(newStatus) => {
                          startPartTransition(async () => {
                            await updatePartRequestStatus(pr.id, newStatus as any);
                            router.refresh();
                          });
                        }}
                      >
                        <SelectTrigger className={`h-6 w-[100px] text-[10px] font-semibold rounded-full border-0 ${
                          pr.status === "received" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                          pr.status === "shipped" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" :
                          pr.status === "ordered" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                          pr.status === "cancelled" ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500" :
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400"
                        }`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested">⏳ Requested</SelectItem>
                          <SelectItem value="ordered">📋 Ordered</SelectItem>
                          <SelectItem value="shipped">🚚 Shipped</SelectItem>
                          <SelectItem value="received">✓ Received</SelectItem>
                          <SelectItem value="cancelled">✗ Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : !showAddPart && costLines.filter(l => l.type === "part").length === 0 ? (
                <p className="text-xs text-muted-foreground">No parts used yet. Add from quote or manually.</p>
              ) : null}
              </div>
            </div>
            </details>
          </div>

          {/* ═══ FINANCIAL CLUSTER ═══ */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mt-2">Financial</p>

          {/* Cost Estimate Builder */}
          <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden" ref={costRef}>
            <details open>
              <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                <span>Cost Estimate</span>
                <div className="flex items-center gap-0">
                  {[
                    { label: "Estimate", done: hasEstimate, active: workflowStep === 0 },
                    { label: "Quote", done: hasQuote, active: workflowStep === 1 },
                    { label: "Invoice", done: hasInvoice, active: workflowStep === 2 || workflowStep === 3 },
                    { label: "Paid", done: isPaid, active: workflowStep === 3 && !isPaid },
                  ].map((s, i, arr) => (
                    <div key={s.label} className="flex items-center">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                        s.done ? "text-emerald-600 dark:text-emerald-400" :
                        s.active ? "text-foreground" :
                        "text-muted-foreground/30"
                      }`}>{s.label}</span>
                      {i < arr.length - 1 && <span className={`text-[10px] ${s.done ? "text-emerald-400" : "text-muted-foreground/20"}`}>→</span>}
                    </div>
                  ))}
                </div>
              </summary>

            <div className="px-6 pb-6">
              {/* ── Pricing: Estimated (primary), Actual (auto from lines), Our Cost (subtle) ── */}
              <div className="flex items-start gap-6 mb-5">
                <div className="flex-[1.2]">
                  <span className="text-xs font-medium text-foreground/70 block mb-1">Estimated</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-base">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      className="h-12 text-xl font-bold pl-8 pr-2 text-right rounded-lg tabular-nums border-border"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground block mb-1">
                    Actual
                    {costLines.length > 0 && <span className="text-muted-foreground/40 ml-1">· auto</span>}
                  </span>
                  {costLines.length > 0 ? (
                    <div className="h-12 flex items-center justify-end text-sm tabular-nums text-muted-foreground px-2">
                      €{parseFloat(actualCost || "0").toFixed(2)}
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-sm">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        className="h-12 text-sm pl-7 pr-2 text-right rounded-lg tabular-nums"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-[11px] text-muted-foreground/50 block mb-1">
                    Our Cost
                    {costLines.length > 0 && <span className="text-muted-foreground/30 ml-1">· auto</span>}
                  </span>
                  {costLines.length > 0 ? (
                    <div className="h-12 flex items-center justify-end text-xs tabular-nums text-muted-foreground/40 px-2">
                      €{parseFloat(internalCost || "0").toFixed(2)}
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 text-sm">€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={internalCost}
                        onChange={(e) => setInternalCost(e.target.value)}
                        className="h-12 text-sm pl-7 pr-2 text-right rounded-lg tabular-nums text-muted-foreground/60"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Warranty toggle */}
              <label className="flex items-center gap-2 cursor-pointer mb-5">
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
                <span className="text-xs text-muted-foreground">Warranty / internal cost</span>
              </label>

              {/* ── Line items ── */}
              <div className="border-t border-border/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Line items</span>
                    <details className="relative inline-block group/hint">
                      <summary className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground cursor-pointer select-none transition-colors">
                        ?
                      </summary>
                      <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover p-2.5 text-[11px] text-popover-foreground shadow-md">
                        <p className="leading-relaxed">Add lines → <strong>→ Estimated</strong> → <strong>Create Quote</strong>. After work, create invoice.</p>
                      </div>
                    </details>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="inline-flex items-center h-7 text-xs px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={addLabourLine}>
                      Labour
                    </button>
                    <button className="inline-flex items-center h-7 text-xs px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={addCustomLine}>
                      Custom
                    </button>
                    <button className="inline-flex items-center h-7 text-xs px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setShowPartPicker(!showPartPicker)}>
                      Part
                    </button>
                  </div>
                </div>

                {showPartPicker && (
                  <div className="mb-3 border border-border/50 rounded-lg p-2 bg-background/50">
                    <Input
                      placeholder="Search parts..."
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      className="h-7 text-xs rounded-lg mb-2"
                      autoFocus
                    />
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {filteredParts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2 text-center">No parts found</p>
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
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/30">
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
                          line.type === "labour" ? "text-muted-foreground" : line.type === "part" ? "text-muted-foreground" : "text-muted-foreground"
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
                            className="h-7 text-xs pl-5 pr-2 text-right rounded-lg text-muted-foreground"
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
                        <button className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => removeCostLine(line.id)}>
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {/* Discount row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30 gap-2">
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
                      {costLinesInternalTotal > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground/60">Our total cost</span>
                          <span className="text-xs tabular-nums text-muted-foreground/60">€{costLinesInternalTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Subtotal excl. VAT</span>
                        <span className="text-xs tabular-nums">€{costLinesTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">VAT ({settings.defaultTax}%)</span>
                        <span className="text-xs tabular-nums text-muted-foreground">€{(costLinesTotal * settings.defaultTax / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                        <span className="text-sm font-semibold">Total incl. VAT</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold tabular-nums">€{costLinesTotalInclTax.toFixed(2)}</span>
                          <button
                            onClick={applyLinesToEstimate}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                          >
                            → Estimated
                          </button>
                        </div>
                      </div>
                      {costLinesInternalTotal > 0 && (
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="text-xs text-muted-foreground/60">Margin</span>
                          <span className={`text-xs tabular-nums text-muted-foreground/60`}>
                            €{(costLinesTotal - costLinesInternalTotal).toFixed(2)} ({costLinesInternalTotal > 0 ? Math.round((costLinesTotal - costLinesInternalTotal) / costLinesInternalTotal * 100) : 0}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-muted mb-3">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No cost lines yet</p>
                    <p className="text-xs text-muted-foreground/50 mt-1 max-w-[240px] mx-auto">Add labour or parts to build a quote, then send it to the customer</p>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button className="inline-flex items-center h-8 text-xs font-medium px-3 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors" onClick={addLabourLine}>
                        + Labour
                      </button>
                      <button className="inline-flex items-center h-8 text-xs px-3 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setShowPartPicker(!showPartPicker)}>
                        + Part
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Next action: contextual CTA ── */}
              <div className="border-t border-border/30 pt-4 mt-4">
                {!hasQuote && !hasInvoice && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default" size="sm" className="flex-1 text-xs"
                      disabled={!job.customer || costLines.length === 0}
                      onClick={() => {
                        const el = holdedRef.current;
                        if (el) {
                          const details = el.querySelector('details');
                          if (details) details.open = true;
                          setTimeout(() => el.querySelector<HTMLElement>('[data-action="create-quote"]')?.click(), 50);
                        }
                      }}
                    >
                      Create Quote
                    </Button>
                    {!job.customer && <span className="text-[11px] text-muted-foreground">Link a contact first</span>}
                    {job.customer && costLines.length === 0 && <span className="text-[11px] text-muted-foreground">Add lines first</span>}
                  </div>
                )}
                {hasQuote && !hasInvoice && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Quote {job.holdedQuoteNum}</span>
                    <span className="text-muted-foreground/30">→</span>
                    <Button
                      variant="default" size="sm" className="text-xs"
                      disabled={!job.customer}
                      onClick={() => {
                        const el = holdedRef.current;
                        if (el) {
                          const details = el.querySelector('details');
                          if (details) details.open = true;
                          setTimeout(() => el.querySelector<HTMLElement>('[data-action="create-invoice"]')?.click(), 50);
                        }
                      }}
                    >
                      Create Invoice
                    </Button>
                  </div>
                )}
                {hasInvoice && !isPaid && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Invoice {job.holdedInvoiceNum}</span>
                    <span className="text-muted-foreground/30">→</span>
                    <span className="text-muted-foreground">Awaiting payment</span>
                  </div>
                )}
                {isPaid && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" /> Paid
                  </div>
                )}
              </div>
            </div>
            </details>
          </div>

          {/* Holded Documents — collapsible details */}
          <div ref={holdedRef}>
            <HoldedDocumentsCard
              job={job}
              costLines={costLines}
              discountPercent={discountPercent}
              settings={settings}
              router={router}
            />
          </div>

          {/* Timeline + Communication — merged into tabs */}
          {(job.events.length > 0 || communicationLogs.length > 0) && (
            <TimelineCommunicationCard
              events={job.events}
              repairJobId={job.id}
              communicationLogs={communicationLogs}
              customerName={job.customer?.name}
              communicationRef={communicationRef}
            />
          )}
        </div>

        {/* ═══ SIDEBAR ═══ */}
        <div className="space-y-6">

          {/* ── Office ── */}
          <div className="rounded-xl bg-muted/30 border border-border/50 p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Office</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1 h-8 text-xs rounded-lg border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <PrioritySelect value={priority} onValueChange={setPriority} className="mt-1 h-8 text-xs rounded-lg border-border/50" />
              </div>
            </div>

            {/* Info rows */}
            <div className="border-t border-border/40 pt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-right">{job.location?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Position</span>
                <span className="font-mono text-xs font-medium text-right">{job.unit?.currentPosition ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Storage</span>
                <span className="text-xs font-medium text-right">{job.unit?.storageLocation ? `${job.unit.storageLocation}${job.unit.storageType ? ` (${job.unit.storageType})` : ""}` : "—"}</span>
              </div>
              {job.unit && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Unit</span>
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
                  <span className="text-muted-foreground">Unit</span>
                  <span className="text-muted-foreground">—</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-right">{format(new Date(job.createdAt), "dd MMM yyyy")}</span>
              </div>
            </div>
            {job.sourceSheet && (
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Source</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">Jake&apos;s beautiful excel sheet</span>
                </div>
              </div>
              )}
          </div>

          {/* ── Customer ── */}
          <div className="rounded-xl bg-muted/30 border border-border/50 p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>

            {/* Customer name + edit */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Contact</span>
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

              {/* Customer response */}
              <div>
                <Label className="text-xs text-muted-foreground">Response</Label>
                <Select value={customerResponseStatus} onValueChange={setCustomerResponseStatus}>
                  <SelectTrigger className="mt-1 h-8 text-xs rounded-lg border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

          {/* Remove past repairs from customer card — now in header */}

              {/* Invoice + pricing */}
              <div className="border-t border-border/40 pt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Invoice</Label>
                  <Select value={invoiceStatus} onValueChange={(val) => {
                    setInvoiceStatus(val);
                    if (val === "rejected") {
                      setStatus("rejected");
                      setCustomerResponseStatus("declined");
                    }
                  }}>
                    <SelectTrigger className="mt-1 h-8 text-xs rounded-lg border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {job.holdedInvoiceDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Invoice Date
                    </span>
                    <span className="text-right">{format(new Date(job.holdedInvoiceDate), "dd MMM yyyy")}</span>
                  </div>
                )}

                {/* Costs moved to Cost Estimate card */}
              </div>
          </div>


        </div>
      </div>

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
  );
}

// ─── Timeline + Communication (tabbed) ───

function TimelineCommunicationCard({
  events,
  repairJobId,
  communicationLogs,
  customerName,
  communicationRef,
}: {
  events: any[];
  repairJobId: string;
  communicationLogs: any[];
  customerName?: string;
  communicationRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [tab, setTab] = useState<"timeline" | "comms">("comms");
  return (
    <Card className="rounded-xl" ref={communicationRef}>
      <CardHeader className="pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("comms")}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-0.5 border-b-2 transition-colors ${
              tab === "comms" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Comms
          </button>
          <button
            type="button"
            onClick={() => setTab("timeline")}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-0.5 border-b-2 transition-colors ${
              tab === "timeline" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            Timeline
            {events.length > 0 && (
              <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5">{events.length}</span>
            )}
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {tab === "comms" ? (
          <CommunicationLogPanel
            repairJobId={repairJobId}
            logs={communicationLogs}
            customerName={customerName}
          />
        ) : (
          <div className="space-y-0">
            {events.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">No timeline events yet.</p>
            ) : (
              events.map((event: any, idx: number) => (
                <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {idx < events.length - 1 && (
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
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Planning Date Row (with Send to Garage) ───

function PlanningDateRow({ jobId, dueDate, status }: { jobId: string; dueDate: string | Date | null; status: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const futureRef = useRef<HTMLInputElement>(null);
  const current = dueDate ? format(new Date(dueDate), "yyyy-MM-dd") : "";

  const isToday = dueDate && format(new Date(dueDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const garageStatuses = ["scheduled", "in_progress", "blocked", "in_inspection"];
  const inGarage = garageStatuses.includes(status) && isToday;

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

  async function handleSendToday() {
    setSaving(true);
    try {
      const today = new Date();
      today.setHours(8, 0, 0, 0);
      await scheduleRepair(jobId, today.toISOString());
      toast.success("Sent to garage for today");
      router.refresh();
    } catch {
      toast.error("Failed to send to garage");
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

  return (
    <div className="space-y-3">
      {/* Planning date */}
      <div className="flex items-center justify-between group/plan">
        <span className="text-muted-foreground text-sm">
          Planning
        </span>
        {dueDate && !editing ? (
          <span className="flex items-center gap-1.5">
            <span className="text-right font-medium text-sm">{format(new Date(dueDate), "dd MMM yyyy")}</span>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover/plan:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            >
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </span>
        ) : !editing ? (
          <span className="text-xs text-muted-foreground">Not planned</span>
        ) : null}
      </div>

      {editing && (
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
      )}

      {/* Send to Garage / In Garage status */}
      {inGarage ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            In Garage Today
          </span>
          <Link
            href={`/garage/repairs/${jobId}`}
            target="_blank"
            className="text-xs text-primary hover:underline"
          >
            Open →
          </Link>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleSendToday}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-foreground text-background text-xs font-medium py-2.5 px-3 transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? "..." : "Garage Now"}
          </button>
          <button
            onClick={() => {
              if (futureRef.current) {
                futureRef.current.showPicker();
              }
            }}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium py-2.5 px-3 transition-colors disabled:opacity-50 relative overflow-hidden"
          >
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            Plan Future
            <input
              ref={futureRef}
              type="date"
              className="absolute inset-0 opacity-0 pointer-events-none"
              disabled={saving}
              min={format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) handleSet(e.target.value);
              }}
            />
          </button>
        </div>
      )}
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
    <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
      <details open={!!(job.holdedQuoteId || job.holdedInvoiceId)}>
        <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
          <span className="flex items-center gap-2">Documents{(job.holdedQuoteId || job.holdedInvoiceId) && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-40" />
        </summary>
      <div className="px-6 pb-6">

        {/* Unsent warning banner */}
        {hasUnsentDoc && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 mb-4 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {job.holdedQuoteId && !quoteSent && job.holdedInvoiceId && !invoiceSent
                ? "Quote and invoice not yet emailed"
                : job.holdedQuoteId && !quoteSent
                ? "Quote not yet emailed"
                : "Invoice not yet emailed"
              }
            </span>
          </div>
        )}

        {/* ── Quote section ── */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground">Quote</p>
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
                data-action="create-quote"
                variant="default" size="sm" className="w-full text-xs"
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
                {loading === "create-quote" ? <Spinner className="mr-1" /> : null}
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
                  {loading === "create-send-quote" ? <Spinner className="mr-1" /> : null}
                  Create & Send Quote
                </Button>
              )}
              {!job.customer && <p className="text-xs text-muted-foreground">Link a contact first</p>}
              {job.customer && costLines.length === 0 && <p className="text-xs text-muted-foreground">Add cost lines first</p>}
            </div>
          )}
        </div>

        {/* ── Invoice section ── */}
        <div className="border-t border-border/30 pt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Invoice</p>
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
                data-action="create-invoice"
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
                {loading === "create-invoice" ? <Spinner className="mr-1" /> : null}
                Create Invoice
              </Button>
              {!job.customer && <p className="text-xs text-muted-foreground mt-1.5">Link a contact first</p>}
              {job.customer && costLines.length === 0 && !actualCost && !estimatedCost && (
                <p className="text-xs text-muted-foreground mt-1.5">Add lines or a cost estimate first</p>
              )}
            </div>
          )}
        </div>

        {/* Verify Holded links */}
        {(job.holdedInvoiceId || job.holdedQuoteId) && (
          <div className="border-t border-border/30 pt-3 mt-3">
            <button
              className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
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
              {loading === "verify" ? <Spinner className="mr-1" /> : null}
              Verify links
            </button>
          </div>
        )}
      </div>
      </details>
    </div>
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
