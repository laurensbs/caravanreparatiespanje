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
  FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS,
} from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus, InvoiceStatus, FindingCategory, FindingSeverity, BlockerReason, EstimateLineItem } from "@/types";
import { ArrowLeft, Save, Clock, User, FileText, Pencil, X as XIcon, MessageSquare, StickyNote, Wrench, Hash, CalendarDays, DollarSign, Flag, Receipt, Plus, Trash2, Package, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Camera, Download } from "lucide-react";
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
import { addRepairWorker, removeRepairWorker, resolveBlocker as resolveBlockerAction, resolveFinding as resolveFindingAction, deleteFinding as deleteFindingAction, updateRepairTaskPricing } from "@/actions/garage";
import { generateEstimateFromWork, addEstimateLineItem, updateEstimateLineItem, removeEstimateLineItem, updateDiscountPercent } from "@/actions/estimates";
import { scheduleRepair, unscheduleRepair } from "@/actions/planning";
import { updateCustomer } from "@/actions/customers";
import { updateUnit } from "@/actions/units";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearch } from "@/components/customers/customer-search";
import { useAssistantContext } from "@/components/assistant-context";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { ICON_MAP, type PartCategory } from "@/components/parts/parts-client";
import { cn } from "@/lib/utils";

import { addTagToRepair, removeTagFromRepair } from "@/actions/tags";
import { deleteRepairPhoto } from "@/actions/photos";
import { RepairTaskList } from "@/components/repairs/repair-task-list";
import type { RepairTask } from "@/types";

interface PartItem {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  supplierName: string | null;
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

interface FindingItem {
  id: string;
  category: string;
  description: string;
  severity: string;
  requiresFollowUp: boolean;
  requiresCustomerApproval: boolean;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  createdByName: string | null;
}

interface BlockerItem {
  id: string;
  reason: string;
  description: string | null;
  active: boolean;
  createdAt: Date | string;
  resolvedAt: Date | string | null;
  createdByName: string | null;
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
  findings?: FindingItem[];
  blockers?: BlockerItem[];
  estimateLines?: EstimateLineItem[];
  partCategories?: PartCategory[];
  photos?: { id: string; repairJobId: string; repairTaskId: string | null; findingId: string | null; url: string; thumbnailUrl: string | null; caption: string | null; photoType: string | null; uploadedByUserId: string | null; createdAt: Date | string }[];
}

export function RepairDetail({ job, communicationLogs = [], partsList = [], backTo, settings = { hourlyRate: 42.50, defaultMarkup: 25, defaultTax: 21 }, allTags = [], repairTags = [], customerRepairs = [], users = [], allCustomers = [], tasks = [], partRequests = [], repairWorkers = [], activeUsers = [], findings = [], blockers = [], estimateLines = [], partCategories = [], photos = [] }: RepairDetailProps) {
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
  const estimatedCost = job.estimatedCost ?? "";
  const actualCost = job.actualCost ?? "";
  const internalCost = job.internalCost ?? "";
  const [costLines, setCostLines] = useState<EstimateLineItem[]>(estimateLines);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partCategory, setPartCategory] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(parseFloat(job.discountPercent ?? "0"));
  const [nextAction, setNextAction] = useState(job.nextAction ?? "");
  const [currentBlocker, setCurrentBlocker] = useState(job.currentBlocker ?? "");

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

  const costLinesSubtotal = costLines.reduce((sum, l) => sum + parseFloat(l.quantity) * parseFloat(l.unitPrice), 0);
  const costLinesInternalTotal = costLines.reduce((sum, l) => sum + parseFloat(l.quantity) * parseFloat(l.internalCost), 0);
  const discountAmount = costLinesSubtotal * (discountPercent / 100);
  const costLinesTotal = costLinesSubtotal - discountAmount;
  const costLinesTotalInclTax = costLinesTotal * (1 + settings.defaultTax / 100);

  // Auto-compute next action from status when no manual override
  const computedNextAction = (() => {
    const map: Record<string, string> = {
      new: "Inspect and assess damage",
      todo: "Inspect and assess damage",
      in_inspection: "Complete inspection",
      no_damage: "Close or archive job",
      quote_needed: "Create and send quote",
      waiting_approval: "Follow up for approval",
      waiting_customer: "Wait for customer response",
      waiting_parts: "Check parts delivery",
      scheduled: "Begin repair work",
      in_progress: "Complete repair",
      blocked: "Resolve blocker",
      completed: job.holdedInvoiceId ? "Confirm payment" : "Create invoice",
      invoiced: "Confirm payment",
      rejected: "Archive job",
    };
    return map[status] ?? "";
  })();

  // Auto-compute blocker from status/flags
  const computedBlocker = (() => {
    if (status === "waiting_parts") return "Parts not yet delivered";
    if (status === "waiting_customer") return "Awaiting customer response";
    if (status === "blocked") return job.statusReason || "See notes for details";
    if (!job.customer && ["quote_needed", "waiting_approval", "completed", "invoiced"].includes(status)) return "No customer linked";
    if (partsRequiredFlag && partRequests.some(p => !["received", "cancelled"].includes(p.status))) return "Parts pending delivery";
    return "";
  })();

  const displayNextAction = nextAction || computedNextAction;
  const displayBlocker = currentBlocker || computedBlocker;

  // Financial stage for summary bar
  const financialStage = (() => {
    if (job.invoiceStatus === "paid") return { label: "Paid", color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30" };
    if (job.holdedInvoiceId) return { label: "Invoiced", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30" };
    if (job.holdedQuoteId) return { label: "Quoted", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30" };
    if (parseFloat(estimatedCost || "0") > 0) return { label: "Estimated", color: "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800" };
    return { label: "No estimate", color: "text-muted-foreground bg-muted/50" };
  })();

  // Keep local estimateLines in sync with prop
  useEffect(() => {
    setCostLines(estimateLines);
  }, [estimateLines]);

  // Part requests state
  const [addingPartName, setAddingPartName] = useState("");
  const [showAddPart, setShowAddPart] = useState(false);
  const [partRequestsPending, startPartTransition] = useTransition();

  // Push repair context to the global assistant
  useEffect(() => {
    setRepairContext({ job, settings });
    return () => setRepairContext(null);
  }, [job, settings, setRepairContext]);

  async function addPartLine(part: PartItem) {
    const baseCost = part.defaultCost ? parseFloat(part.defaultCost) : 0;
    const markup = part.markupPercent ? parseFloat(part.markupPercent) : settings.defaultMarkup;
    const sellingPrice = baseCost * (1 + markup / 100);
    // Optimistic: add placeholder line immediately
    const tempId = crypto.randomUUID();
    const now = new Date();
    setCostLines(prev => [...prev, { id: tempId, repairJobId: job.id, type: "part", sourceType: "manual", sourceId: null, description: part.name, quantity: "1", unitPrice: String(Math.round(sellingPrice * 100) / 100), internalCost: String(baseCost), sortOrder: prev.length, createdAt: now, updatedAt: now } as any]);
    setShowPartPicker(false);
    setPartSearch("");
    await addEstimateLineItem(job.id, { type: "part", description: part.name, quantity: 1, unitPrice: Math.round(sellingPrice * 100) / 100, internalCost: baseCost, sourceType: "manual" });
    router.refresh();
  }

  async function addLabourLine() {
    const tempId = crypto.randomUUID();
    const now = new Date();
    setCostLines(prev => [...prev, { id: tempId, repairJobId: job.id, type: "labour", sourceType: "manual", sourceId: null, description: "Labour", quantity: "1", unitPrice: String(settings.hourlyRate), internalCost: "0", sortOrder: prev.length, createdAt: now, updatedAt: now } as any]);
    await addEstimateLineItem(job.id, { type: "labour", description: "Labour", quantity: 1, unitPrice: settings.hourlyRate, internalCost: 0, sourceType: "manual" });
    router.refresh();
  }

  async function addCustomLine() {
    const tempId = crypto.randomUUID();
    const now = new Date();
    setCostLines(prev => [...prev, { id: tempId, repairJobId: job.id, type: "custom", sourceType: "manual", sourceId: null, description: "", quantity: "1", unitPrice: "0", internalCost: "0", sortOrder: prev.length, createdAt: now, updatedAt: now } as any]);
    await addEstimateLineItem(job.id, { type: "custom", description: "", quantity: 1, unitPrice: 0, internalCost: 0, sourceType: "manual" });
    router.refresh();
  }

  async function removeCostLine(id: string) {
    // Optimistic: remove immediately
    setCostLines(prev => prev.filter(l => l.id !== id));
    await removeEstimateLineItem(id);
    router.refresh();
  }

  // Debounced server sync for line edits
  const updateTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  function updateCostLine(id: string, field: string, value: string | number) {
    // Optimistic: update local state immediately
    setCostLines(prev => prev.map(l => l.id === id ? { ...l, [field]: field === "description" ? String(value) : String(value) } : l));
    // Debounce server call (500ms)
    const timerKey = `${id}-${field}`;
    if (updateTimers.current[timerKey]) clearTimeout(updateTimers.current[timerKey]);
    updateTimers.current[timerKey] = setTimeout(async () => {
      const updates: Record<string, number | string> = {};
      if (field === "description") updates.description = String(value);
      else if (field === "quantity") updates.quantity = parseFloat(String(value)) || 1;
      else if (field === "unitPrice") updates.unitPrice = parseFloat(String(value)) || 0;
      else if (field === "internalCost") updates.internalCost = parseFloat(String(value)) || 0;
      await updateEstimateLineItem(id, updates);
      router.refresh();
    }, 500);
  }

  async function handleGenerateFromWork() {
    const result = await generateEstimateFromWork(job.id, settings.hourlyRate, settings.defaultMarkup);
    toast.success(`Generated ${result.labourCount} labour + ${result.partCount} part lines`);
    router.refresh();
  }

  async function handleDiscountChange(percent: number) {
    const clamped = Math.min(100, Math.max(0, percent));
    setDiscountPercent(clamped);
    // Debounce discount server call
    if (updateTimers.current['discount']) clearTimeout(updateTimers.current['discount']);
    updateTimers.current['discount'] = setTimeout(async () => {
      await updateDiscountPercent(job.id, clamped);
      router.refresh();
    }, 500);
  }

  const filteredParts = (() => {
    let result = partsList;
    if (partCategory) {
      result = result.filter((p) => p.category === partCategory);
    }
    if (partSearch.length > 0) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
          p.partNumber?.toLowerCase().includes(partSearch.toLowerCase())
      );
    }
    // Show all when filtering by category, limit to 8 when browsing all without search
    if (!partCategory && !partSearch) return result.slice(0, 8);
    return result;
  })();

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
        nextAction: nextAction || null,
        currentBlocker: currentBlocker || null,
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

        {/* Status chips + tags — all in one line */}
        <div className="flex items-center gap-2 flex-wrap pl-10">
          {/* Clickable customer name */}
          {job.customer ? (
            <button
              onClick={() => setExpandCustomer((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors underline decoration-dotted underline-offset-2 ${expandCustomer ? 'bg-primary/10 text-primary decoration-primary' : 'text-foreground decoration-muted-foreground/40 hover:decoration-foreground hover:bg-muted'}`}
              title="Click to view / edit customer"
            >
              {job.customer.name}
              <Pencil className="h-2.5 w-2.5 opacity-40" />
            </button>
          ) : (
            <button
              onClick={() => setShowCustomerLinker(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors italic underline decoration-dotted underline-offset-2"
            >
              No customer
            </button>
          )}

          <span className="text-muted-foreground/30">·</span>

          {/* Clickable license plate / unit + location */}
          {job.unit ? (
            <button
              onClick={() => setExpandUnit((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors underline decoration-dotted underline-offset-2 ${expandUnit ? 'bg-primary/10 text-primary decoration-primary' : 'text-muted-foreground decoration-muted-foreground/40 hover:text-foreground hover:decoration-foreground hover:bg-muted'}`}
              title="Click to view / edit unit"
            >
              <span className="font-mono">{job.unit.registration || 'No license plate'}</span>
              <Pencil className="h-2.5 w-2.5 opacity-40" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground/50 italic">
              No unit
              {job.location && <span className="text-muted-foreground/60 not-italic">· {job.location.slug ? job.location.slug.toUpperCase() : job.location.name}</span>}
            </span>
          )}

          <span className="text-muted-foreground/30">·</span>

          <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[status as RepairStatus] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABELS[status as RepairStatus]}
          </span>
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority as Priority] ?? 'bg-muted text-muted-foreground'}`}>
            {PRIORITY_LABELS[priority as Priority]}
          </span>
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${financialStage.color}`}>
            {financialStage.label}
          </span>

          {repairWorkers.length > 0 && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground bg-muted/50">
                <User className="h-3 w-3" />
                {repairWorkers.map(w => w.userName.split(' ')[0]).join(', ')}
              </span>
            </>
          )}

          {allTags.length > 0 && (
            <TagPicker
              allTags={allTags}
              activeTags={repairTags}
              onAdd={(tagId) => addTagToRepair(job.id, tagId)}
              onRemove={(tagId) => removeTagFromRepair(job.id, tagId)}
            />
          )}
        </div>

        {/* Inline edit panels — expand below the chips */}
        {expandCustomer && job.customer && (
          <div className="pl-10">
            <InlineCustomerEdit customer={job.customer} onDone={() => setExpandCustomer(false)} />
          </div>
        )}
        {expandUnit && job.unit && (
          <div className="pl-10">
            <InlineUnitEdit unit={job.unit} onDone={() => setExpandUnit(false)} />
          </div>
        )}
      </div>

      {/* ── Summary Bar — next action, blocker ── */}
      {(displayNextAction || displayBlocker) && (
        <div className="rounded-xl border border-border/50 bg-muted/20 px-6 py-4 space-y-3">
          {displayNextAction && (
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 shrink-0 w-28">
                <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">Next action</span>
              </div>
              <div className="flex-1 min-w-0">
                {nextAction ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{nextAction}</span>
                    <button onClick={() => setNextAction("")} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const val = prompt("Next action:", computedNextAction);
                      if (val !== null) setNextAction(val);
                    }}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {computedNextAction}
                    <span className="text-[10px] text-muted-foreground/40 ml-1.5">· auto</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {displayBlocker && (
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-2 shrink-0 w-28">
                <div className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Blocker</span>
              </div>
              <div className="flex-1 min-w-0">
                {currentBlocker ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{currentBlocker}</span>
                    <button onClick={() => setCurrentBlocker("")} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const val = prompt("Current blocker:", computedBlocker);
                      if (val !== null) setCurrentBlocker(val);
                    }}
                    className="text-sm text-amber-700/80 dark:text-amber-300/80 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                  >
                    {computedBlocker}
                    <span className="text-[10px] text-muted-foreground/40 ml-1.5">· auto</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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

          {/* ═══ DESCRIPTION & NOTES ═══ */}

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

          {/* ── ACTIVE BLOCKERS — prominent red section ── */}
          {blockers.filter(b => b.active).length > 0 && (
            <div className="rounded-xl bg-red-50/80 dark:bg-red-950/20 border-2 border-red-300/60 p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Active Blockers
              </h3>
              <div className="space-y-3">
                {blockers.filter(b => b.active).map((b) => (
                  <div key={b.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                      </span>
                      {b.description && (
                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-0.5">{b.description}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => {
                        startPartTransition(async () => {
                          await resolveBlockerAction(b.id);
                          router.refresh();
                        });
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── WORKSHOP FINDINGS ── */}
          {findings.length > 0 && (
            <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
              <details open={findings.some(f => !f.resolvedAt)}>
                <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  Workshop Findings ({findings.filter(f => !f.resolvedAt).length} open, {findings.filter(f => f.resolvedAt).length} resolved)
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </summary>
                <div className="px-6 pb-6 space-y-3">
                  {findings.map((f) => (
                    <div key={f.id} className={`flex items-start gap-3 rounded-lg p-3 ${f.resolvedAt ? "opacity-50" : "bg-background/60"}`}>
                      <span className="text-lg mt-0.5 shrink-0">{FINDING_CATEGORY_EMOJI[f.category as FindingCategory]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{FINDING_CATEGORY_LABELS[f.category as FindingCategory]}</span>
                          <Badge className={
                            f.severity === "critical"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : f.severity === "minor"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }>
                            {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                          </Badge>
                          {f.requiresCustomerApproval && (
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200">Approval Needed</Badge>
                          )}
                          {f.requiresFollowUp && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">Follow-up</Badge>
                          )}
                          {f.resolvedAt && (
                            <Badge className="bg-green-100 text-green-700 border-green-200">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          {f.createdByName} · {new Date(f.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!f.resolvedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-green-700 hover:bg-green-50"
                            onClick={() => {
                              startPartTransition(async () => {
                                await resolveFindingAction(f.id);
                                router.refresh();
                              });
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                          onClick={() => {
                            startPartTransition(async () => {
                              await deleteFindingAction(f.id);
                              toast.success("Finding removed");
                              router.refresh();
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* ── WORKSHOP — workers, planning, flags, tasks, parts ── */}
          <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
            <details open>
              <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                Workshop
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </summary>
            <div className="px-6 pb-5 space-y-4">

              {/* Assigned + Planning — side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assigned workers */}
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1.5">Assigned</p>
                  {repairWorkers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {repairWorkers.map((w) => (
                        <span key={w.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs group">
                          <span className="flex items-center justify-center h-4 w-4 rounded-full bg-foreground/10 text-[9px] font-bold text-foreground/70">
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
                            <XIcon className="h-2.5 w-2.5" />
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
                        <SelectTrigger className="h-7 text-xs rounded-lg border-border/50"><SelectValue placeholder="+ Assign technician..." /></SelectTrigger>
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
              <div className="border-t border-border/30 pt-3">
                <div className="flex items-center justify-between mb-1.5">
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
                    <span
                      key={flag.label}
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-all border ${
                        flag.danger
                          ? "bg-red-50 text-red-600 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/60"
                          : "bg-muted text-foreground/80 border-border/60"
                      }`}
                    >
                      <span className="mr-1">✓</span>
                      {flag.label}
                      <button
                        type="button"
                        onClick={() => flag.set(false)}
                        className="ml-1.5 -mr-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={`Remove ${flag.label}`}
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </button>
                    </span>
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
                    <span className="text-xs text-muted-foreground/60">None</span>
                  )}
                </div>
              </div>

              {/* Tasks */}
              <div className="border-t border-border/30 pt-3">
                <RepairTaskList repairJobId={job.id} initialTasks={tasks} defaultHourlyRate={settings.hourlyRate} />
              </div>

              {/* Parts Used */}
              <div className="border-t border-border/30 pt-3">
                <div className="flex items-center justify-between mb-1.5">
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

          {/* ═══ FINANCIAL ═══ */}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mt-2">Financial</p>

          {/* Unified Financial Workflow */}
          <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden" ref={costRef}>
            <FinancialWorkflow
              job={job}
              estimatedCost={estimatedCost}
              actualCost={actualCost}
              internalCost={internalCost}
              costLines={costLines}
              costLinesSubtotal={costLinesSubtotal}
              costLinesInternalTotal={costLinesInternalTotal}
              costLinesTotal={costLinesTotal}
              costLinesTotalInclTax={costLinesTotalInclTax}
              discountPercent={discountPercent}
              discountAmount={discountAmount}
              warrantyFlag={warrantyFlag}
              setWarrantyFlag={setWarrantyFlag}
              invoiceStatus={invoiceStatus}
              setInvoiceStatus={setInvoiceStatus}
              status={status}
              setStatus={setStatus}
              settings={settings}
              showPartPicker={showPartPicker}
              setShowPartPicker={setShowPartPicker}
              partSearch={partSearch}
              setPartSearch={setPartSearch}
              partCategory={partCategory}
              setPartCategory={setPartCategory}
              partCategories={partCategories}
              filteredParts={filteredParts}
              addLabourLine={addLabourLine}
              addCustomLine={addCustomLine}
              addPartLine={addPartLine}
              removeCostLine={removeCostLine}
              updateCostLine={updateCostLine}
              handleGenerateFromWork={handleGenerateFromWork}
              handleDiscountChange={handleDiscountChange}
              router={router}
            />
          </div>

          {/* ── Photos ── */}
          {photos.length > 0 && (
            <Card className="rounded-xl border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photos
                  <Badge variant="secondary" className="text-xs">{photos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const taskPhotos = photos.filter(p => p.repairTaskId);
                  const generalPhotos = photos.filter(p => !p.repairTaskId);
                  const grouped = taskPhotos.reduce<Record<string, typeof photos>>((acc, p) => {
                    const key = p.repairTaskId!;
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(p);
                    return acc;
                  }, {});
                  const taskName = (taskId: string) => tasks.find(t => t.id === taskId)?.title ?? "Task";
                  return (
                    <>
                      {Object.entries(grouped).map(([taskId, taskPics]) => (
                        <div key={taskId} className="space-y-2">
                          <h4 className="text-xs font-medium text-muted-foreground">{taskName(taskId)}</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {taskPics.map(photo => (
                              <PhotoCard key={photo.id} photo={photo} />
                            ))}
                          </div>
                        </div>
                      ))}
                      {generalPhotos.length > 0 && (
                        <div className="space-y-2">
                          {taskPhotos.length > 0 && <h4 className="text-xs font-medium text-muted-foreground">General</h4>}
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                            {generalPhotos.map(photo => (
                              <PhotoCard key={photo.id} photo={photo} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

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

          {/* ── Job Status ── */}
          <div className="rounded-xl bg-muted/30 border border-border/50 p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Job Status</h3>
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
                  <span className="text-xs text-muted-foreground">Imported</span>
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

          {/* ── Source & Import ── */}
          {(job.sourceSheet || job.sourceCategory || job.spreadsheetInternalId) && (
            <div className="rounded-xl bg-muted/30 border border-border/50 p-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source & Import</h3>
              <div className="space-y-2 text-sm">
                {job.sourceSheet && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sheet</span>
                    <span className="text-right text-xs font-medium truncate max-w-[160px]">{job.sourceSheet}</span>
                  </div>
                )}
                {job.sourceCategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-right text-xs">{job.sourceCategory}</span>
                  </div>
                )}
                {job.spreadsheetInternalId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ref ID</span>
                    <span className="text-right font-mono text-xs">{job.spreadsheetInternalId}</span>
                  </div>
                )}
                {job.bayReference && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-right font-mono text-xs">{job.bayReference}</span>
                  </div>
                )}
                {job.extraNotesRaw && (
                  <div className="border-t border-border/40 pt-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Extra notes (from import)</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{job.extraNotesRaw}</p>
                  </div>
                )}
              </div>
            </div>
          )}

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

// ─── Photo Card ───

function PhotoCard({ photo }: { photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null; photoType: string | null; createdAt: Date | string } }) {
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  return (
    <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/20">
      <a href={photo.url} target="_blank" rel="noopener noreferrer">
        <img
          src={photo.thumbnailUrl || photo.url}
          alt={photo.caption || "Photo"}
          className="aspect-square w-full object-cover"
        />
      </a>
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center gap-1 p-1 opacity-0 group-hover:opacity-100">
        <a
          href={photo.url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-white/90 p-1.5 hover:bg-white transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-foreground" />
        </a>
        <button
          disabled={deleting}
          onClick={() => {
            startDelete(async () => {
              try {
                await deleteRepairPhoto(photo.id);
                toast.success("Photo deleted");
                router.refresh();
              } catch {
                toast.error("Failed to delete photo");
              }
            });
          }}
          className="rounded-md bg-white/90 p-1.5 hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5 text-red-600" />
        </button>
      </div>
      {photo.caption && (
        <p className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">{photo.caption}</p>
      )}
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
      toast.success("Repair started for today");
      router.refresh();
    } catch {
      toast.error("Failed to start repair");
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
    <div className="space-y-2">
      {/* Planning date */}
      <div className="flex items-center justify-between group/plan">
        <p className="text-xs text-muted-foreground font-medium">Planning</p>
        {dueDate && !editing ? (
          <span className="flex items-center gap-1.5">
            <span className="text-right font-medium text-xs">{format(new Date(dueDate), "dd MMM yyyy")}</span>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover/plan:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
            >
              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
            </button>
          </span>
        ) : !editing ? (
          <span className="text-xs text-muted-foreground/60">Not planned</span>
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
            <button onClick={handleRemove} disabled={saving} className="p-1 rounded hover:bg-destructive/10" title="Remove from planning">
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          )}
          <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-muted" title="Cancel">
            <XIcon className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Start Repair / In Workshop status */}
      {inGarage ? (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            In Workshop Today
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
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-foreground text-background text-xs font-medium py-2 px-2.5 transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {saving ? "..." : "Start Repair Now"}
          </button>
          <button
            onClick={() => {
              if (futureRef.current) {
                futureRef.current.showPicker();
              }
            }}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium py-2 px-2.5 transition-colors disabled:opacity-50 relative overflow-hidden"
          >
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            Schedule Repair
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

  const STORAGE_LOCATIONS = ["Cruïllas", "Sant Climent", "Peratallada"];
  const STORAGE_TYPES = ["Inside", "Outside"];

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

  const textFields: [string, string, (v: string) => void, string?][] = [
    ["License Plate", registration, setRegistration, "font-mono"],
    ["Brand", brand, setBrand], ["Model", model, setModel],
    ["Year", year, setYear], ["Chassis", chassisId, setChassisId, "font-mono"],
    ["Length", length, setLength],
    ["Position", currentPosition, setCurrentPosition],
    ["NFC Tag", nfcTag, setNfcTag, "font-mono"],
  ];

  return (
    <div className="rounded-lg border bg-muted/30 p-2.5 space-y-2 animate-slide-up">
      <div className="grid grid-cols-2 gap-2">
        {textFields.map(([label, value, setter, extra]) => (
          <div key={label}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
            <Input value={value} onChange={(e) => setter(e.target.value)} className={`h-7 text-xs rounded-md mt-0.5 ${extra ?? ""}`} />
          </div>
        ))}
        {/* Storage Location — dropdown */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Storage Location</label>
          <Select value={storageLocation} onValueChange={setStorageLocation}>
            <SelectTrigger className="h-7 text-xs rounded-md mt-0.5">
              <SelectValue placeholder="Select location..." />
            </SelectTrigger>
            <SelectContent>
              {STORAGE_LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Storage Type — dropdown */}
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Storage Type</label>
          <Select value={storageType} onValueChange={setStorageType}>
            <SelectTrigger className="h-7 text-xs rounded-md mt-0.5">
              <SelectValue placeholder="Inside / Outside" />
            </SelectTrigger>
            <SelectContent>
              {STORAGE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

// ─── Unified Financial Workflow ───

function FinancialWorkflow({
  job, estimatedCost, actualCost, internalCost,
  costLines, costLinesSubtotal, costLinesInternalTotal,
  costLinesTotal, costLinesTotalInclTax,
  discountPercent, discountAmount,
  warrantyFlag, setWarrantyFlag, invoiceStatus, setInvoiceStatus,
  status, setStatus, settings, showPartPicker, setShowPartPicker,
  partSearch, setPartSearch, partCategory, setPartCategory, partCategories, filteredParts, addLabourLine, addCustomLine,
  addPartLine, removeCostLine, updateCostLine, handleGenerateFromWork,
  handleDiscountChange, router,
}: {
  job: any;
  estimatedCost: string;
  actualCost: string;
  internalCost: string;
  costLines: EstimateLineItem[];
  costLinesSubtotal: number;
  costLinesInternalTotal: number;
  costLinesTotal: number;
  costLinesTotalInclTax: number;
  discountPercent: number;
  discountAmount: number;
  warrantyFlag: boolean;
  setWarrantyFlag: (v: boolean) => void;
  invoiceStatus: string;
  setInvoiceStatus: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  settings: PricingSettings;
  showPartPicker: boolean;
  setShowPartPicker: (v: boolean) => void;
  partSearch: string;
  setPartSearch: (v: string) => void;
  partCategory: string | null;
  setPartCategory: (v: string | null) => void;
  partCategories: PartCategory[];
  filteredParts: PartItem[];
  addLabourLine: () => void;
  addCustomLine: () => void;
  addPartLine: (p: PartItem) => void;
  removeCostLine: (id: string) => void;
  updateCostLine: (id: string, field: string, value: string | number) => void;
  handleGenerateFromWork: () => Promise<void>;
  handleDiscountChange: (v: number) => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(false);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(false);

  const hasEstimate = costLines.length > 0 || parseFloat(estimatedCost || "0") > 0;
  const hasQuote = !!job.holdedQuoteId;
  const hasInvoice = !!job.holdedInvoiceId;
  const isPaid = job.invoiceStatus === "paid";
  const quoteSent = !!job.holdedQuoteSentAt;
  const invoiceSent = !!job.holdedInvoiceSentAt;
  const hasUnsentDoc = (job.holdedQuoteId && !quoteSent) || (job.holdedInvoiceId && !invoiceSent);

  // Unsent document warning — beforeunload
  useEffect(() => {
    if (!hasUnsentDoc) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsentDoc]);

  async function handleAction(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try { await fn(); } catch (e: any) { toast.error(e.message ?? "Action failed"); } finally { setLoading(null); }
  }

  // Determine active workflow step: 0=estimate, 1=quote, 2=invoice, 3=paid
  const activeStep = isPaid ? 3 : hasInvoice ? 2 : hasQuote ? 1 : 0;

  // Source badge helper
  function sourceBadge(line: EstimateLineItem) {
    if (line.sourceType === "task") return <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">task</span>;
    if (line.sourceType === "part_request") return <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400">part</span>;
    return <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">manual</span>;
  }

  return (
    <div className="divide-y divide-border/30">

      {/* ─── Step indicator ─── */}
      <div className="px-6 py-3 flex items-center gap-0">
        {[
          { label: "Estimate", step: 0 },
          { label: "Quote", step: 1 },
          { label: "Invoice", step: 2 },
          { label: "Paid", step: 3 },
        ].map((s, i, arr) => (
          <div key={s.label} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeStep > s.step ? "text-emerald-600 dark:text-emerald-400" :
              activeStep === s.step ? "text-foreground bg-muted" :
              "text-muted-foreground/30"
            }`}>
              {activeStep > s.step && <CheckCircle className="h-3 w-3" />}
              {s.label}
            </div>
            {i < arr.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${activeStep > s.step ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border/40"}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Estimate ─── */}
      <div className="px-6 py-5 space-y-5">
        {/* Auto-calculated pricing summary */}
        <div className="flex items-center gap-6 text-xs">
          <span className="text-muted-foreground">Estimated{costLines.length > 0 && <span className="opacity-40 ml-0.5">· auto</span>}</span>
          <span className="font-bold tabular-nums text-sm">€{costLines.length > 0 ? costLinesTotalInclTax.toFixed(2) : parseFloat(estimatedCost || "0").toFixed(2)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground">Our Cost</span>
          <span className="tabular-nums text-muted-foreground">€{costLines.length > 0 ? costLinesInternalTotal.toFixed(2) : parseFloat(internalCost || "0").toFixed(2)}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="text-muted-foreground/50">Margin</span>
          <span className="tabular-nums text-muted-foreground/60">{costLinesInternalTotal > 0 ? `€${(costLinesTotal - costLinesInternalTotal).toFixed(2)} (${Math.round((costLinesTotal - costLinesInternalTotal) / costLinesInternalTotal * 100)}%)` : costLinesTotal > 0 ? `€${costLinesTotal.toFixed(2)}` : "—"}</span>
        </div>

        {/* Warranty toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
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

        {/* Line items */}
        <div className="border-t border-border/30 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">Line items</span>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center h-6 text-[11px] px-2 rounded-md text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                onClick={() => handleAction("generate", async () => { await handleGenerateFromWork(); })}
                disabled={!!loading}
              >
                {loading === "generate" ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 mr-0.5" />}
                Generate
              </button>
              <button className="inline-flex items-center h-6 text-[11px] px-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={addLabourLine}>Labour</button>
              <button className="inline-flex items-center h-6 text-[11px] px-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={addCustomLine}>Custom</button>
              <button className="inline-flex items-center h-6 text-[11px] px-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setShowPartPicker(!showPartPicker)}>Part</button>
            </div>
          </div>

          {showPartPicker && (
            <div className="mb-3 border border-border/50 rounded-lg p-2 bg-background/50">
              <Input placeholder="Search parts..." value={partSearch} onChange={(e) => setPartSearch(e.target.value)} className="h-7 text-xs rounded-lg mb-2" autoFocus />
              {/* Category tabs */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button
                  type="button"
                  onClick={() => setPartCategory(null)}
                  className={cn(
                    "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-colors",
                    !partCategory ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  All
                </button>
                {partCategories.filter(c => c.active).map((cat) => {
                  const CatIcon = ICON_MAP[cat.icon] ?? Package;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setPartCategory(partCategory === cat.key ? null : cat.key)}
                      className={cn(
                        "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-colors",
                        partCategory === cat.key ? `${cat.color}` : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <CatIcon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {filteredParts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">No parts found</p>
                ) : (
                  filteredParts.map((p) => {
                    const baseCost = p.defaultCost ? parseFloat(p.defaultCost) : 0;
                    const markup = p.markupPercent ? parseFloat(p.markupPercent) : settings.defaultMarkup;
                    const sellPrice = baseCost * (1 + markup / 100);
                    return (
                      <button key={p.id} type="button" onClick={() => addPartLine(p)} className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors flex justify-between items-center">
                        <span className="truncate">{p.name}{p.partNumber && <span className="text-muted-foreground ml-1">({p.partNumber})</span>}</span>
                        <span className="text-muted-foreground shrink-0 ml-2">€{sellPrice.toFixed(2)}{baseCost > 0 && <span className="text-[10px] ml-1 opacity-60">+{markup}%</span>}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {costLines.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/30">
                <span className="w-14 shrink-0">Source</span>
                <span className="flex-1">Description</span>
                <span className="w-14 text-center">Qty</span>
                <span className="w-20 text-right">Our cost</span>
                <span className="w-20 text-right">Sell</span>
                <span className="w-16 text-right">Total</span>
                <span className="w-6" />
              </div>
              {costLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2">
                  <span className="w-14 shrink-0">{sourceBadge(line)}</span>
                  <Input value={line.description} onChange={(e) => updateCostLine(line.id, "description", e.target.value)} placeholder={line.type === "labour" ? "Labour description" : "Description"} className="h-7 text-xs rounded-lg flex-1" />
                  <Input type="number" min="0.25" step={line.type === "labour" ? "0.25" : "1"} value={line.quantity} onChange={(e) => updateCostLine(line.id, "quantity", parseFloat(e.target.value) || 1)} className="h-7 text-xs rounded-lg w-14 text-center" />
                  <div className="relative w-20">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">€</span>
                    <Input type="number" step="0.01" min="0" value={line.internalCost} onChange={(e) => updateCostLine(line.id, "internalCost", parseFloat(e.target.value) || 0)} className="h-7 text-xs pl-5 pr-2 text-right rounded-lg text-muted-foreground" />
                  </div>
                  <div className="relative w-20">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">€</span>
                    <Input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateCostLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)} className="h-7 text-xs pl-5 pr-2 text-right rounded-lg" />
                  </div>
                  <span className="text-xs font-medium w-16 text-right tabular-nums">€{(parseFloat(line.quantity) * parseFloat(line.unitPrice)).toFixed(2)}</span>
                  <button className="h-6 w-6 shrink-0 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" onClick={() => removeCostLine(line.id)}><XIcon className="h-3 w-3" /></button>
                </div>
              ))}

              {/* Discount */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Discount</span>
                  <div className="relative w-16">
                    <Input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)} className="h-6 text-xs pr-5 text-right rounded-lg" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">%</span>
                  </div>
                </div>
                {discountPercent > 0 && <span className="text-xs text-destructive tabular-nums">-€{discountAmount.toFixed(2)}</span>}
              </div>

              {/* Totals */}
              <div className="space-y-1 pt-1">
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
                  <span className="text-sm font-bold tabular-nums">€{costLinesTotalInclTax.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">No estimate lines yet</p>
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <button
                  className="inline-flex items-center h-7 text-xs px-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  onClick={() => handleAction("generate", async () => { await handleGenerateFromWork(); })}
                  disabled={!!loading}
                >
                  {loading === "generate" ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Generate
                </button>
                <button className="inline-flex items-center h-7 text-xs px-2.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={addLabourLine}>+ Labour</button>
                <button className="inline-flex items-center h-7 text-xs px-2.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" onClick={() => setShowPartPicker(!showPartPicker)}>+ Part</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── STEP 2: Quote ─── */}
      {(costLines.length > 0 || hasQuote) && (
      <div className="px-6 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Quote</p>
          {hasQuote && (
            <div className="flex items-center gap-2">
              <a href={`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                {job.holdedQuoteNum} ↗
              </a>
              {quoteSent ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">Sent</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">Not sent</Badge>
              )}
            </div>
          )}
        </div>

        {hasQuote ? (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => window.open(`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`, "_blank")}>
                View PDF
              </Button>
              {job.customer?.email && (
                <Button variant={quoteSent ? "outline" : "default"} size="sm" className="flex-1 text-xs" disabled={loading === "send-quote"}
                  onClick={() => handleAction("send-quote", async () => { await sendHoldedQuote(job.id); toast.success("Quote sent to " + job.customer.email); router.refresh(); })}>
                  {loading === "send-quote" ? <Spinner className="mr-1" /> : null}{quoteSent ? "Resend" : "Email Quote"}
                </Button>
              )}
              <a href={`https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Holded ↗
              </a>
            </div>
            {confirmDeleteQuote ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 dark:border-red-900 dark:bg-red-950/50">
                <span className="text-[11px] text-red-700 dark:text-red-400 flex-1">Delete quote {job.holdedQuoteNum}?</span>
                <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" disabled={loading === "delete-quote"}
                  onClick={() => handleAction("delete-quote", async () => { await deleteHoldedQuote(job.id); toast.success("Quote deleted"); setConfirmDeleteQuote(false); router.refresh(); })}>
                  {loading === "delete-quote" ? <Spinner /> : "Delete"}
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDeleteQuote(false)}>Cancel</Button>
              </div>
            ) : (
              <button className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors" onClick={() => setConfirmDeleteQuote(true)}>Delete quote</button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="flex-1 text-xs"
              disabled={!job.customer || costLines.length === 0 || !!loading}
              onClick={() => handleAction("create-quote", async () => {
                const result = await createHoldedQuote(job.id, costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 })), discountPercent);
                toast.success(`Quote ${result.quoteNum} created`);
                router.refresh();
              })}>
              {loading === "create-quote" ? <Spinner className="mr-1" /> : null}Send Quote (through Holded)
            </Button>
            {job.customer?.email && (
              <Button variant="outline" size="sm" className="flex-1 text-xs"
                disabled={!job.customer || costLines.length === 0 || !!loading}
                onClick={() => handleAction("create-send-quote", async () => {
                  const result = await createHoldedQuote(job.id, costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 })), discountPercent);
                  await sendHoldedQuote(job.id);
                  toast.success(`Quote ${result.quoteNum} created & sent`);
                  router.refresh();
                })}>
                {loading === "create-send-quote" ? <Spinner className="mr-1" /> : null}Send & Email Quote
              </Button>
            )}
            {!job.customer && <p className="text-[11px] text-muted-foreground">Link a contact first</p>}
          </div>
        )}
      </div>
      )}

      {/* ─── STEP 3: Invoice ─── */}
      {(hasQuote || hasInvoice) && (
      <div className="px-6 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Invoice</p>
          {hasInvoice && (
            <div className="flex items-center gap-2">
              <a href={`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                {job.holdedInvoiceNum} ↗
              </a>
              {invoiceSent ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">Sent</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">Not sent</Badge>
              )}
              {isPaid && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">Paid</Badge>
              )}
            </div>
          )}
        </div>

        {hasInvoice ? (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => window.open(`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`, "_blank")}>
                View PDF
              </Button>
              {job.customer?.email && (
                <Button variant={invoiceSent ? "outline" : "default"} size="sm" className="flex-1 text-xs" disabled={loading === "send-invoice"}
                  onClick={() => handleAction("send-invoice", async () => { await sendHoldedInvoice(job.id); toast.success("Invoice sent to " + job.customer.email); router.refresh(); })}>
                  {loading === "send-invoice" ? <Spinner className="mr-1" /> : null}{invoiceSent ? "Resend" : "Email Invoice"}
                </Button>
              )}
              <a href={`https://app.holded.com/invoicing/invoice/${job.holdedInvoiceId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                Holded ↗
              </a>
            </div>
            {job.invoiceStatus !== "paid" && (
              confirmDeleteInvoice ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 dark:border-red-900 dark:bg-red-950/50">
                  <span className="text-[11px] text-red-700 dark:text-red-400 flex-1">Delete invoice {job.holdedInvoiceNum}?</span>
                  <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" disabled={loading === "delete-invoice"}
                    onClick={() => handleAction("delete-invoice", async () => { await deleteHoldedInvoice(job.id); toast.success("Invoice deleted"); setConfirmDeleteInvoice(false); router.refresh(); })}>
                    {loading === "delete-invoice" ? <Spinner /> : "Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDeleteInvoice(false)}>Cancel</Button>
                </div>
              ) : (
                <button className="text-[11px] text-muted-foreground/50 hover:text-destructive transition-colors" onClick={() => setConfirmDeleteInvoice(true)}>Delete invoice</button>
              )
            )}
          </div>
        ) : (
          <Button variant="default" size="sm" className="w-full text-xs"
            disabled={!job.customer || costLines.length === 0 || !!loading}
            onClick={() => handleAction("create-invoice", async () => {
              const items = costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 }));
              const result = await createHoldedInvoice(job.id, items, discountPercent);
              toast.success(`Invoice ${result.invoiceNum} created`);
              router.refresh();
            })}>
            {loading === "create-invoice" ? <Spinner className="mr-1" /> : null}Send Invoice (through Holded)
          </Button>
        )}
      </div>
      )}

      {/* Unsent warning */}
      {hasUnsentDoc && (
        <div className="px-6 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              {job.holdedQuoteId && !quoteSent && job.holdedInvoiceId && !invoiceSent ? "Quote and invoice not yet emailed" :
               job.holdedQuoteId && !quoteSent ? "Quote not yet emailed" : "Invoice not yet emailed"}
            </span>
          </div>
        </div>
      )}

      {/* Verify links */}
      {(job.holdedInvoiceId || job.holdedQuoteId) && (
        <div className="px-6 py-2">
          <button className="w-full text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors py-1"
            onClick={() => handleAction("verify", async () => {
              const result = await verifyHoldedDocuments(job.id);
              if (result.fixed) { toast.success(result.issues.join(". ")); router.refresh(); }
              else { toast.success("All links verified ✓"); }
            })}>
            {loading === "verify" ? <Spinner className="mr-1" /> : null}Verify Holded links
          </button>
        </div>
      )}
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
