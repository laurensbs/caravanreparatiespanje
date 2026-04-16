"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateRepairJob, adminApproveRepair, adminSendBackRepair } from "@/actions/repairs";
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
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS,
  CUSTOMER_RESPONSE_LABELS, INVOICE_STATUS_LABELS,
  FINDING_CATEGORY_LABELS, FINDING_CATEGORY_EMOJI, FINDING_SEVERITY_LABELS, BLOCKER_REASON_LABELS,
  JOB_TYPE_LABELS, JOB_TYPE_COLORS,
} from "@/types";
import type { RepairStatus, Priority, CustomerResponseStatus, InvoiceStatus, FindingCategory, FindingSeverity, BlockerReason, EstimateLineItem, DismissedWorkshopItem, JobType } from "@/types";
import { ArrowLeft, Save, Clock, User, FileText, Pencil, X as XIcon, MessageSquare, StickyNote, Wrench, Hash, CalendarDays, DollarSign, Flag, Receipt, Plus, Trash2, Package, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Camera, Download, Search, Sparkles, Settings, ClipboardCheck, Check, Play } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { SmartDate } from "@/components/ui/smart-date";
import { CommunicationLogPanel } from "@/components/communication-log";
import { toast } from "sonner";
import { PrioritySelect } from "@/components/repairs/priority-select";
import { createHoldedInvoice, sendHoldedInvoice, createHoldedQuote, sendHoldedQuote, verifyHoldedDocuments, deleteHoldedQuote, deleteHoldedInvoice } from "@/actions/holded";
import { deleteRepairJob } from "@/actions/repairs";
import { RepairPartsUsed, type PartRequestRow } from "@/components/parts/repair-parts-used";
import { RepairTimeLog } from "@/components/repairs/repair-time-log";
import { resolveBlocker as resolveBlockerAction, resolveFinding as resolveFindingAction, deleteFinding as deleteFindingAction } from "@/actions/garage";
import { generateEstimateFromWork, addEstimateLineItem, updateEstimateLineItem, removeEstimateLineItem, updateDiscountPercent, restoreWorkshopItem, restoreAllWorkshopItems } from "@/actions/estimates";
import { scheduleRepair, unscheduleRepair } from "@/actions/planning";
import { updateCustomer } from "@/actions/customers";
import { updateUnit } from "@/actions/units";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerSearch } from "@/components/customers/customer-search";
import { useAssistantContext } from "@/components/assistant-context";
import { TagPicker, type TagItem } from "@/components/tag-picker";
import { ICON_MAP, type PartCategory } from "@/components/parts/parts-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { addTagToRepair, removeTagFromRepair, createTag, deleteTag } from "@/actions/tags";
import { deleteRepairPhoto } from "@/actions/photos";
import { RepairTaskList } from "@/components/repairs/repair-task-list";
import { GarageSyncStrip, GarageActivityTimeline } from "@/components/garage-sync-ui";
import { sendMessageToGarage, clearGarageMessage } from "@/actions/garage-sync";
import type { RepairTask } from "@/types";

interface PartItem {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  supplierName: string | null;
  stockQuantity: number;
  minStockLevel: number;
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

type PartRequestItem = PartRequestRow;

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
  dismissedWorkshopItems?: DismissedWorkshopItem[];
  partCategories?: PartCategory[];
  photos?: { id: string; repairJobId: string; repairTaskId: string | null; findingId: string | null; url: string; thumbnailUrl: string | null; caption: string | null; photoType: string | null; uploadedByUserId: string | null; createdAt: Date | string; onedriveFolderUrl?: string | null; onedrivePath?: string | null }[];
  timeEntries?: any[];
  activeTimers?: any[];
  syncState?: any;
  garageActivity?: any[];
}

/* ─── Add Item Dropdown ─── */
function AddItemDropdown({ onLabour, onCustom, onPart }: { onLabour: () => void; onCustom: () => void; onPart: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; placement: "bottom" | "top" }>({ top: 0, left: 0, placement: "bottom" });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the dropdown relative to the button via portal
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuH = 148; // approximate height of 3 items + padding
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement = spaceBelow >= menuH + gap ? "bottom" : "top";
    const top = placement === "bottom" ? rect.bottom + gap : rect.top - menuH - gap;
    // Align right edge of menu with right edge of button
    const left = Math.max(8, rect.right - 176); // 176 = w-44
    setPos({ top, left, placement });
  }, [open]);

  // Close on outside click or ESC
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function pick(fn: () => void) {
    fn();
    setOpen(false);
  }

  const isActive = open;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 text-sm px-3.5 rounded-xl font-medium shadow-sm transition-colors",
          isActive
            ? "bg-[#0CC0DF]/10 text-[#0CC0DF]"
            : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add item
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1000 }}
          className={cn(
            "w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1",
            "animate-in fade-in-0 duration-150",
            pos.placement === "bottom" ? "slide-in-from-top-1" : "slide-in-from-bottom-1"
          )}
        >
          <button type="button" onClick={() => pick(onLabour)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            Add labour
          </button>
          <button type="button" onClick={() => pick(onPart)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <Package className="h-3.5 w-3.5 text-gray-400" />
            Add part
          </button>
          <button type="button" onClick={() => pick(onCustom)} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <Pencil className="h-3.5 w-3.5 text-gray-400" />
            Add custom
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

export function RepairDetail({ job, communicationLogs = [], partsList = [], backTo, settings = { hourlyRate: 42.50, defaultMarkup: 25, defaultTax: 21 }, allTags = [], repairTags = [], customerRepairs = [], users = [], allCustomers = [], tasks = [], partRequests = [], repairWorkers = [], activeUsers = [], findings = [], blockers = [], estimateLines = [], dismissedWorkshopItems: initialDismissed = [], partCategories = [], photos = [], timeEntries = [], activeTimers = [], syncState = null, garageActivity = [] }: RepairDetailProps) {
  const router = useRouter();
  const { setRepairContext } = useAssistantContext();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [startedToday, setStartedToday] = useState(false);
  const [priority, setPriority] = useState(job.priority);
  const [jobType, setJobType] = useState<JobType>(job.jobType as JobType ?? "repair");
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
  const [customFlags, setCustomFlags] = useState<string[]>((job.customFlags as string[]) ?? []);
  const [newFlagName, setNewFlagName] = useState("");
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

  // Garage messaging
  const [garageMessage, setGarageMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

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
      ready_for_check: "Review and approve completion",
      completed: job.holdedInvoiceId ? "Confirm payment" : "Create invoice",
      invoiced: "Confirm payment",
      rejected: "Archive job",
    };
    return map[status] ?? "";
  })();

  // Smart context for next action
  const nextActionContext = (() => {
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === "done").length;
    const pendingPartReqs = partRequests.filter(p => !["received", "cancelled"].includes(p.status)).length;

    type ActionCtx = { icon: "search" | "clipboard" | "wrench" | "clock" | "package" | "check" | "receipt" | "flag"; subtext: string; cta?: string };
    const ctx: Partial<Record<string, ActionCtx>> = {
      new: { icon: "search", subtext: "Review the work order and start inspection" },
      todo: { icon: "search", subtext: "Review the work order and start inspection" },
      in_inspection: { icon: "clipboard", subtext: totalTasks > 0 ? `${doneTasks} of ${totalTasks} tasks completed` : "Document findings and create tasks" },
      no_damage: { icon: "check", subtext: "No damage found — close or reassign" },
      quote_needed: { icon: "receipt", subtext: "Build estimate and send quote to customer" },
      waiting_approval: { icon: "clock", subtext: "Customer has not yet responded to quote" },
      waiting_customer: { icon: "clock", subtext: "Awaiting customer response" },
      waiting_parts: { icon: "package", subtext: pendingPartReqs > 0 ? `${pendingPartReqs} part${pendingPartReqs !== 1 ? "s" : ""} pending delivery` : "All parts received" },
      scheduled: { icon: "wrench", subtext: "Job is scheduled — start when ready" },
      in_progress: { icon: "wrench", subtext: totalTasks > 0 ? `${doneTasks} of ${totalTasks} tasks completed` : "Work in progress" },
      blocked: { icon: "flag", subtext: job.statusReason || "Resolve the blocker to continue" },
      ready_for_check: { icon: "check", subtext: "Workshop marked this as done", cta: "Review" },
      completed: { icon: "receipt", subtext: job.holdedInvoiceId ? "Invoice sent — confirm when paid" : "Create and send the invoice" },
      invoiced: { icon: "receipt", subtext: "Waiting for payment confirmation" },
      rejected: { icon: "flag", subtext: "This job was rejected" },
    };
    return ctx[status] ?? { icon: "wrench" as const, subtext: "" };
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
  // Keep local estimateLines in sync with prop
  useEffect(() => {
    setCostLines(estimateLines);
  }, [estimateLines]);

  // General transition for inline actions (blockers, findings, review, etc.)
  const [reviewPending, startReviewTransition] = useTransition();
  const [, startPartTransition] = useTransition();

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
        jobType,
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
        customFlags,
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

  // Financial stage for badge display
  const financialStage = (() => {
    if (job.invoiceStatus === "paid") return { label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800" };
    if (job.holdedInvoiceId) return { label: "Invoiced", color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800" };
    if (job.holdedQuoteId) return { label: "Quoted", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800" };
    return null;
  })();

  const statusBadgeColor = (() => {
    const m: Record<string, string> = {
      new: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      todo: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      in_inspection: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
      quote_needed: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      waiting_approval: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      waiting_customer: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      waiting_parts: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      scheduled: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
      in_progress: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
      blocked: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
      ready_for_check: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      invoiced: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
      archived: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    };
    return m[status] ?? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  })();

  const priorityBadgeColor = (() => {
    const m: Record<string, string> = {
      low: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
      normal: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
      high: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      urgent: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    };
    return m[priority] ?? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  })();

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-background animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HEADER
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-8">
          {/* Left side */}
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-2 p-2 rounded-xl hover:bg-white dark:hover:bg-white/10 transition-all duration-150 shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </button>
            <div className="min-w-0 flex-1 space-y-2">
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-2xl font-semibold h-12 rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-4"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setEditingTitle(false); }}
                  />
                  <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10">
                    <XIcon className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="group text-left w-full"
                >
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                    {title || job.publicCode || "Untitled repair"}
                  </h1>
                </button>
              )}

              {/* Metadata row */}
              <div className="flex items-center gap-3 flex-wrap text-sm">
                {job.publicCode && title && (
                  <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{job.publicCode}</span>
                )}
                {job.customer ? (
                  <button
                    onClick={() => setExpandCustomer((v) => !v)}
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-150"
                  >
                    {job.customer.name}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCustomerLinker(true)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 italic transition-all duration-150"
                  >
                    No customer
                  </button>
                )}
                {job.unit && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <button
                      onClick={() => setExpandUnit((v) => !v)}
                      className="font-mono text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150"
                    >
                      {job.unit.registration || 'No plate'}
                    </button>
                  </>
                )}
                {job.location && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">{job.location.slug ? job.location.slug.toUpperCase() : job.location.name}</span>
                  </>
                )}
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <JobTypePicker value={jobType} onChange={setJobType} />
                <StatusPicker value={status} onChange={setStatus} badgeColor={statusBadgeColor} />
                {priority !== "normal" && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap border transition-all duration-150 ${priorityBadgeColor}`}>
                    {PRIORITY_LABELS[priority as Priority]}
                  </span>
                )}
                {financialStage && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap border transition-all duration-150 ${financialStage.color}`}>
                    {financialStage.label}
                  </span>
                )}
                <InlinePillPicker
                  value={customerResponseStatus}
                  onChange={setCustomerResponseStatus}
                  options={CUSTOMER_RESPONSE_LABELS}
                  colorMap={{
                    not_contacted: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                    contacted: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
                    waiting_response: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
                    approved: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
                    declined: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
                    no_response: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
                  }}
                />
                <InlinePillPicker
                  value={invoiceStatus}
                  onChange={(val) => {
                    setInvoiceStatus(val);
                    if (val === "rejected") {
                      setStatus("rejected");
                      setCustomerResponseStatus("declined");
                    }
                  }}
                  options={INVOICE_STATUS_LABELS}
                  colorMap={{
                    not_invoiced: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                    draft: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                    sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
                    paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
                    warranty: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
                    our_costs: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800",
                    rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
                    no_damage: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
                  }}
                />
                {repairWorkers.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <User className="h-3 w-3" />
                    {repairWorkers.map(w => w.userName.split(' ')[0]).join(', ')}
                  </span>
                )}
                {job.dueDate && format(new Date(job.dueDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && ["scheduled", "in_progress", "blocked", "in_inspection"].includes(status) ? (
                  <Link
                    href={`/garage/repairs/${job.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all duration-150"
                  >
                    <Wrench className="h-3 w-3" />
                    In Workshop
                  </Link>
                ) : (
                  <>
                    {job.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(job.dueDate), "d MMM")}
                        </span>
                        <button
                          onClick={async () => {
                            await unscheduleRepair(job.id);
                            if (["scheduled", "in_progress"].includes(status)) {
                              setStatus("todo");
                            }
                            toast.success("Removed from planning");
                            router.refresh();
                          }}
                          className="p-0.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-all duration-150"
                          title="Remove from planning"
                        >
                          <XIcon className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    {startedToday ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        In garage
                      </span>
                    ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150">
                          <Play className="h-3 w-3" />
                          Start / Schedule
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-56 p-3 space-y-2">
                        <button
                          onClick={async () => {
                            const today = new Date();
                            today.setHours(8, 0, 0, 0);
                            await scheduleRepair(job.id, today.toISOString());
                            setStatus("scheduled");
                            setStartedToday(true);
                            toast.success("Repair started for today");
                            router.refresh();
                          }}
                          className="w-full flex items-center gap-2 rounded-lg bg-foreground text-background text-xs font-medium py-2 px-3 transition-colors hover:bg-foreground/90"
                        >
                          <Play className="h-3 w-3" />
                          Start Repair Now
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => {
                              const input = document.getElementById('header-schedule-picker') as HTMLInputElement;
                              input?.showPicker();
                            }}
                            className="w-full flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium py-2 px-3 transition-colors"
                          >
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            Schedule Repair
                          </button>
                          <input
                            id="header-schedule-picker"
                            type="date"
                            className="absolute inset-0 opacity-0 pointer-events-none"
                            min={format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}
                            onChange={async (e) => {
                              if (e.target.value) {
                                const d = new Date(e.target.value);
                                d.setHours(8, 0, 0, 0);
                                await scheduleRepair(job.id, d.toISOString());
                                toast.success(`Planned for ${format(d, "dd MMM yyyy")}`);
                                router.refresh();
                              }
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    )}
                  </>
                )}
                <TagPicker
                  allTags={allTags}
                  activeTags={repairTags}
                  onAdd={(tagId) => addTagToRepair(job.id, tagId)}
                  onRemove={(tagId) => removeTagFromRepair(job.id, tagId)}
                  onCreate={async (data) => { await createTag(data); }}
                  onDelete={async (tagId) => { await deleteTag(tagId); }}
                />
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0 mt-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2.5 rounded-xl text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all duration-150"
              title="Delete"
            >
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
            </button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl h-10 px-6 font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 shadow-sm transition-all duration-150">
              {saving ? <Spinner className="mr-2" /> : null}
              Save
            </Button>
          </div>
        </div>

        {/* Inline edit panels */}
        {expandCustomer && job.customer && (
          <div className="ml-14">
            <InlineCustomerEdit customer={job.customer} onDone={() => setExpandCustomer(false)} />
          </div>
        )}
        {expandUnit && job.unit && (
          <div className="ml-14">
            <InlineUnitEdit unit={job.unit} onDone={() => setExpandUnit(false)} />
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          GARAGE SYNC STRIP
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <GarageSyncStrip syncState={syncState} />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SEND MESSAGE TO GARAGE
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-sky-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Send to Garage</h3>
        </div>
        {syncState?.garageAdminMessage && (
          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800/50 px-3 py-2.5 mb-3">
            <p className="text-sm text-sky-800 dark:text-sky-300 whitespace-pre-wrap">{syncState.garageAdminMessage}</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-sky-400">
                {syncState.garageAdminMessageAt ? format(new Date(syncState.garageAdminMessageAt), "HH:mm") : ""}
              </span>
              <button
                onClick={async () => {
                  await clearGarageMessage(job.id);
                  router.refresh();
                }}
                className="text-[11px] text-sky-400 hover:text-sky-600 dark:hover:text-sky-300 font-medium"
              >
                Clear message
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={garageMessage}
            onChange={(e) => setGarageMessage(e.target.value)}
            placeholder="Type a message for the garage team..."
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-700 dark:text-gray-100"
            onKeyDown={async (e) => {
              if (e.key === "Enter" && garageMessage.trim() && !sendingMessage) {
                setSendingMessage(true);
                await sendMessageToGarage(job.id, garageMessage.trim());
                setGarageMessage("");
                setSendingMessage(false);
                router.refresh();
                toast.success("Message sent to garage");
              }
            }}
          />
          <Button
            size="sm"
            disabled={!garageMessage.trim() || sendingMessage}
            onClick={async () => {
              setSendingMessage(true);
              await sendMessageToGarage(job.id, garageMessage.trim());
              setGarageMessage("");
              setSendingMessage(false);
              router.refresh();
              toast.success("Message sent to garage");
            }}
            className="rounded-xl h-9 px-4 bg-sky-500 hover:bg-sky-600 text-white"
          >
            {sendingMessage ? <Spinner className="h-3 w-3" /> : "Send"}
          </Button>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ADMIN REVIEW BAR (Ready for Check)
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {status === "ready_for_check" && (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">Ready for check</p>
                <p className="text-sm text-amber-700 dark:text-amber-400/80">Garage marked this job as done. Review and approve or send back.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={reviewPending}
                onClick={async () => {
                  const note = prompt("Reason for sending back (optional):");
                  if (note === null) return; // cancelled
                  startReviewTransition(async () => {
                    await adminSendBackRepair(job.id, note || undefined);
                    setStatus("in_progress" as RepairStatus);
                    router.refresh();
                  });
                }}
                className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Send back
              </Button>
              <Button
                size="sm"
                disabled={reviewPending}
                onClick={() => {
                  startReviewTransition(async () => {
                    await adminApproveRepair(job.id);
                    setStatus("completed" as RepairStatus);
                    router.refresh();
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve &amp; complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          NEXT ACTION BLOCK
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {(displayNextAction || displayBlocker) && (
        <div className="space-y-3">
          {displayNextAction && (
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-5 py-4 shadow-sm transition-all duration-150">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                    status === "blocked" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                      : status === "ready_for_check" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : ["completed", "invoiced"].includes(status) ? "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
                      : "bg-[#0CC0DF]/10 text-[#0CC0DF]"
                  )}>
                    {nextActionContext.icon === "search" && <Search className="h-4 w-4" />}
                    {nextActionContext.icon === "clipboard" && <ClipboardCheck className="h-4 w-4" />}
                    {nextActionContext.icon === "wrench" && <Wrench className="h-4 w-4" />}
                    {nextActionContext.icon === "clock" && <Clock className="h-4 w-4" />}
                    {nextActionContext.icon === "package" && <Package className="h-4 w-4" />}
                    {nextActionContext.icon === "check" && <CheckCircle className="h-4 w-4" />}
                    {nextActionContext.icon === "receipt" && <Receipt className="h-4 w-4" />}
                    {nextActionContext.icon === "flag" && <Flag className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-0.5">Next action</p>
                    {nextAction ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{nextAction}</p>
                        <button onClick={() => setNextAction("")} className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0">
                          <XIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const val = prompt("Next action:", computedNextAction);
                          if (val !== null) setNextAction(val);
                        }}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors truncate block"
                      >
                        {computedNextAction}
                      </button>
                    )}
                    {!nextAction && nextActionContext.subtext && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{nextActionContext.subtext}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const val = prompt("Set next action:", displayNextAction);
                    if (val !== null) setNextAction(val);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 font-medium shrink-0 transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
          {displayBlocker && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/60 px-6 py-4 transition-all duration-150">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-amber-700/70 dark:text-amber-400/70 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" /> Blocker
                  </p>
                  {currentBlocker ? (
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{currentBlocker}</p>
                      <button onClick={() => setCurrentBlocker("")} className="text-amber-400 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-1 rounded-lg transition-all duration-150">
                        <XIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const val = prompt("Current blocker:", computedBlocker);
                        if (val !== null) setCurrentBlocker(val);
                      }}
                      className="text-sm font-medium text-amber-900/80 dark:text-amber-200/80 hover:text-amber-900 dark:hover:text-amber-200 transition-all duration-150"
                    >
                      {computedBlocker}
                      <span className="text-xs text-amber-700/40 dark:text-amber-400/40 font-normal ml-2">auto</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past Repairs — compact horizontal */}
      {job.customer && customerRepairs.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold mb-3">Past Repairs</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {customerRepairs.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href={`/repairs/${r.id}`}
                className="flex items-center gap-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 shadow-sm px-4 py-3 min-w-[220px] transition-all duration-150 group"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">
                  {(r.publicCode ?? 'R').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                    {r.title ? r.title.slice(0, 35) + (r.title.length > 35 ? '…' : '') : r.publicCode ?? 'Repair'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {format(new Date(r.createdAt), "dd MMM yyyy")}
                    <span className="mx-1.5">·</span>
                    {STATUS_LABELS[r.status as RepairStatus] ?? r.status}
                  </p>
                </div>
              </Link>
            ))}
            {customerRepairs.length > 6 && (
              <div className="flex items-center text-xs text-gray-400 font-medium px-4 shrink-0">
                +{customerRepairs.length - 6} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          MAIN GRID — 8 / 4
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ─── LEFT COLUMN ─── */}
        <div className="space-y-6 lg:col-span-8">

          {/* DESCRIPTION CARD */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 transition-all duration-150" ref={descriptionRef}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Description</h3>
              {!editingDescription && (
                <button type="button" onClick={() => setEditingDescription(true)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150 font-medium">
                  Edit
                </button>
              )}
            </div>
            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      setEditingDescription(false);
                    }
                  }}
                  rows={5}
                  autoFocus
                  className="rounded-xl text-xs border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5"
                />
                <button onClick={() => setEditingDescription(false)} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150 font-medium">
                  Done
                </button>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">
                {description || <span className="text-gray-400 dark:text-gray-500 italic">No description</span>}
              </div>
            )}
            {job.descriptionNormalized && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 mb-1">Summary</p>
                <p className="text-xs text-muted-foreground">{job.descriptionNormalized}</p>
              </div>
            )}
            {/* Internal notes */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <details className="group" open={!!internalComments}>
                <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150 select-none flex items-center gap-1.5 font-medium">
                  Internal notes
                  {internalComments && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </summary>
                <Textarea
                  value={internalComments}
                  onChange={(e) => setInternalComments(e.target.value)}
                  rows={2}
                  placeholder="Private staff notes..."
                  className="rounded-xl text-xs resize-none mt-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5"
                />
              </details>
            </div>
          </div>

          {/* Parts needed */}
          {job.partsNeededRaw && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold mb-4">Parts Needed</h3>
              <div className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{job.partsNeededRaw}</div>
            </div>
          )}

          {/* ACTIVE BLOCKERS */}
          {blockers.filter(b => b.active).length > 0 && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/60 p-6 transition-all duration-150">
              <h3 className="text-xs uppercase tracking-wide text-red-600 dark:text-red-400 font-semibold mb-4 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Active Blockers
              </h3>
              <div className="space-y-3">
                {blockers.filter(b => b.active).map((b) => (
                  <div key={b.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/60 dark:bg-white/5 p-4 border border-red-100 dark:border-red-800/40">
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                        {BLOCKER_REASON_LABELS[b.reason as BlockerReason]}
                      </span>
                      {b.description && (
                        <p className="text-sm text-red-600/70 dark:text-red-400/70 mt-0.5">{b.description}</p>
                      )}
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        {b.createdByName} · {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs rounded-xl border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
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

          {/* WORKSHOP FINDINGS */}
          {findings.length > 0 && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <details open={findings.some(f => !f.resolvedAt)}>
                <summary className="px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150">
                  Workshop Findings ({findings.filter(f => !f.resolvedAt).length} open, {findings.filter(f => f.resolvedAt).length} resolved)
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </summary>
                <div className="px-6 pb-6 space-y-3">
                  {findings.map((f) => (
                    <div key={f.id} className={`flex items-start gap-3 rounded-xl p-4 border transition-all duration-150 ${f.resolvedAt ? "opacity-50 border-gray-100 dark:border-gray-800" : "bg-gray-50 dark:bg-white/5 border-gray-100 dark:border-gray-800"}`}>
                      <span className="text-lg mt-0.5 shrink-0">{FINDING_CATEGORY_EMOJI[f.category as FindingCategory]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{FINDING_CATEGORY_LABELS[f.category as FindingCategory]}</span>
                          <Badge className={
                            f.severity === "critical"
                              ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800"
                              : f.severity === "minor"
                              ? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                              : "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800"
                          }>
                            {FINDING_SEVERITY_LABELS[f.severity as FindingSeverity]}
                          </Badge>
                          {f.requiresCustomerApproval && (
                            <Badge className="bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800">Approval Needed</Badge>
                          )}
                          {f.requiresFollowUp && (
                            <Badge className="bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">Follow-up</Badge>
                          )}
                          {f.resolvedAt && (
                            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{f.description}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                          {f.createdByName} · {new Date(f.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!f.resolvedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg"
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
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 h-7 w-7 p-0 rounded-lg"
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

          {/* ━━━ WORKSHOP CARD ━━━ */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <details open>
              <summary className="px-6 py-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150">
                Workshop
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </summary>
            <div className="px-6 pb-7 space-y-7">

              {/* ── Tasks (main focus) ── */}
              <div>
                <RepairTaskList repairJobId={job.id} initialTasks={tasks} totalLoggedMinutes={timeEntries.reduce((acc, e) => acc + (e.roundedMinutes ?? 0), 0)} />
              </div>

              {/* ── Inspection Flags (always visible) ── */}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold mb-2">Flags</p>
                <div className="flex flex-wrap gap-1.5">
                  {allFlags.map((flag) => (
                    <button
                      key={flag.label}
                      type="button"
                      onClick={() => flag.set(!flag.value)}
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-all duration-150 ${
                        flag.value
                          ? flag.danger
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                            : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800"
                          : "bg-gray-50 text-gray-400 border-gray-150 dark:bg-gray-800/50 dark:text-gray-500 dark:border-gray-700 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-250"
                      }`}
                    >
                      {flag.label}
                    </button>
                  ))}
                  {customFlags.map((flag) => (
                    <span
                      key={flag}
                      className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-medium border bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"
                    >
                      {flag}
                      <button
                        type="button"
                        onClick={() => setCustomFlags((prev) => prev.filter((f) => f !== flag))}
                        className="ml-1 -mr-0.5 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const trimmed = newFlagName.trim();
                      if (trimmed && !customFlags.includes(trimmed)) {
                        setCustomFlags((prev) => [...prev, trimmed]);
                        setNewFlagName("");
                      }
                    }}
                    className="inline-flex items-center"
                  >
                    <input
                      type="text"
                      value={newFlagName}
                      onChange={(e) => setNewFlagName(e.target.value)}
                      placeholder="New flag..."
                      className="h-6 w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-2.5 text-[11px] placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:focus:ring-sky-800 focus:border-sky-300 dark:focus:border-sky-700"
                      maxLength={50}
                    />
                  </form>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-gray-100 dark:border-gray-800" />

              {/* ── Parts Used ── */}
              <RepairPartsUsed
                repairJobId={job.id}
                partRequests={partRequests}
                defaultMarkup={settings.defaultMarkup}
                partCategories={partCategories}
              />

              {/* ── Divider ── */}
              <div className="border-t border-gray-100 dark:border-gray-800" />

              {/* ── Time Log (conditional) ── */}
              {timeEntries.length > 0 && (
                <>
                <div className="border-t border-gray-100 dark:border-gray-800" />
                <div className="rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold mb-3">Time Log</p>
                  <RepairTimeLog
                    repairJobId={job.id}
                    timeEntries={timeEntries}
                    activeTimers={activeTimers}
                    activeUsers={activeUsers}
                  />
                </div>
                </>
              )}

              {/* ── Start / Schedule pills ── */}
              {startedToday ? (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-800" />
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium py-2.5 px-3">
                    <Check className="h-3.5 w-3.5" />
                    Is in garage now
                  </div>
                </>
              ) : !(job.dueDate && format(new Date(job.dueDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") && ["scheduled", "in_progress", "blocked", "in_inspection"].includes(status)) && (
                <>
                  <div className="border-t border-gray-100 dark:border-gray-800" />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const today = new Date();
                        today.setHours(8, 0, 0, 0);
                        await scheduleRepair(job.id, today.toISOString());
                        setStatus("scheduled");
                        setStartedToday(true);
                        toast.success("Repair started for today");
                        router.refresh();
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background text-xs font-medium py-2.5 px-3 transition-colors hover:bg-foreground/90"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start Repair Now
                    </button>
                    <div className="flex-1 relative">
                      <button
                        onClick={() => {
                          const input = document.getElementById('workshop-schedule-picker') as HTMLInputElement;
                          input?.showPicker();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium py-2.5 px-3 transition-colors"
                      >
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                        Schedule Repair
                      </button>
                      <input
                        id="workshop-schedule-picker"
                        type="date"
                        className="absolute inset-0 opacity-0 pointer-events-none"
                        min={format(new Date(Date.now() + 86400000), "yyyy-MM-dd")}
                        onChange={async (e) => {
                          if (e.target.value) {
                            const d = new Date(e.target.value);
                            d.setHours(8, 0, 0, 0);
                            await scheduleRepair(job.id, d.toISOString());
                            toast.success(`Planned for ${format(d, "dd MMM yyyy")}`);
                            router.refresh();
                          }
                        }}
                      />
                    </div>
                  </div>
                </>
              )}

            </div>
            </details>
          </div>

          {/* ━━━ FINANCIAL ━━━ */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden" ref={costRef}>
            <details>
              <summary className="px-6 py-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150">
                Financial
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </summary>
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
              tasks={tasks}
              partRequests={partRequests}
              findings={findings}
              initialDismissed={initialDismissed}
            />
            </details>
          </div>

          {/* Photos */}
          <PhotosSection photos={photos} tasks={tasks} jobId={job.id} />

          {/* Garage Activity Timeline */}
          {garageActivity.length > 0 && (
            <GarageActivityTimeline
              events={garageActivity}
              repairId={job.id}
            />
          )}

          {/* Timeline (compact scroll) */}
          {job.events.length > 0 && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <details>
                <summary className="px-6 py-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150">
                  <span className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Timeline
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full px-1.5 py-0.5 font-bold">{job.events.length}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </summary>
                <div className="px-6 pb-5 max-h-[400px] overflow-y-auto">
                  <div className="space-y-0">
                    {job.events.map((event: any, idx: number) => (
                      <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                        {idx < job.events.length - 1 && (
                          <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                        )}
                        <div className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 text-xs">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{event.userName ?? "System"}</span>
                            <span className="text-gray-400 dark:text-gray-500">{event.eventType.replace(/_/g, " ")}</span>
                            <span className="ml-auto text-[11px] text-gray-300 dark:text-gray-600 whitespace-nowrap">
                              <SmartDate date={event.createdAt} />
                            </span>
                          </div>
                          {event.fieldChanged && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                              {event.fieldChanged}: {event.oldValue} → {event.newValue}
                            </p>
                          )}
                          {event.comment && (
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{event.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="space-y-6 lg:col-span-4">

          {/* Job Status */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 space-y-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Job Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Status</Label>
                <div className="mt-1.5">
                  <StatusPicker value={status} onChange={setStatus} badgeColor={statusBadgeColor} variant="select" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Priority</Label>
                <PrioritySelect value={priority} onValueChange={setPriority} className="mt-1.5 h-11 text-sm rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5" />
              </div>
            </div>

            {/* Info rows */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2.5 text-xs">
              <div className="flex items-start justify-between py-0.5">
                <span className="text-muted-foreground">Location</span>
                {job.location?.name ? (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{job.location.name}</span>
                ) : (
                  <button onClick={() => setExpandUnit((v) => !v)} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors italic">No info</button>
                )}
              </div>
              <div className="flex items-start justify-between py-0.5">
                <span className="text-muted-foreground">Position</span>
                {job.unit?.currentPosition ? (
                  <span className="font-mono font-medium text-gray-800 dark:text-gray-200 text-right">{job.unit.currentPosition}</span>
                ) : (
                  <button onClick={() => setExpandUnit((v) => !v)} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors italic">No info</button>
                )}
              </div>
              <div className="flex items-start justify-between py-0.5">
                <span className="text-muted-foreground">Storage</span>
                {job.unit?.storageLocation ? (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{job.unit.storageLocation}{job.unit.storageType ? ` (${job.unit.storageType})` : ""}</span>
                ) : (
                  <button onClick={() => setExpandUnit((v) => !v)} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors italic">No info</button>
                )}
              </div>
              {job.unit ? (
                <div className="flex items-start justify-between py-0.5">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="flex items-center gap-1.5">
                    <Link href={`/units/${job.unit.id}`} className="font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 text-right transition-all duration-150">
                      {[job.unit.brand, job.unit.model].filter(Boolean).join(" ") || "Unit"}{job.unit.registration ? ` · ${job.unit.registration}` : ""}
                    </Link>
                    <button onClick={() => setExpandUnit((v) => !v)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-150" title="Edit unit">
                      <Pencil className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500" />
                    </button>
                  </span>
                </div>
              ) : (
                <div className="flex items-start justify-between py-0.5">
                  <span className="text-muted-foreground">Unit</span>
                  <button onClick={() => setExpandUnit((v) => !v)} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors italic">No info</button>
                </div>
              )}
              {expandUnit && job.unit && (
                <InlineUnitEdit unit={job.unit} onDone={() => setExpandUnit(false)} />
              )}
              <div className="flex items-start justify-between py-0.5">
                <span className="text-muted-foreground">Created</span>
                <span className="text-gray-800 dark:text-gray-200 text-right">{format(new Date(job.createdAt), "dd MMM yyyy")}</span>
              </div>
            </div>
            {job.sourceSheet && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Source</span>
                  <span className="text-gray-400 dark:text-gray-500">Imported</span>
                </div>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 space-y-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Customer</h3>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Contact</span>
                {job.customer ? (
                  <span className="flex items-center gap-1.5">
                    <Link href={`/customers/${job.customer.id}`} className="font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 text-right transition-all duration-150">
                      {job.customer.name}
                    </Link>
                    <button onClick={() => setExpandCustomer((v) => !v)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-150" title="Edit customer">
                      <Pencil className="h-2.5 w-2.5 text-gray-400 dark:text-gray-500" />
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setExpandCustomer((v) => !v)} className="text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors italic">No info</button>
                )}
              </div>
              {expandCustomer && job.customer && (
                <InlineCustomerEdit customer={job.customer} onDone={() => setExpandCustomer(false)} />
              )}

              {/* Customer response */}
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Response</Label>
                <Select value={customerResponseStatus} onValueChange={setCustomerResponseStatus}>
                  <SelectTrigger className="mt-1.5 h-11 text-sm rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CUSTOMER_RESPONSE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice + pricing */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Invoice</Label>
                  <Select value={invoiceStatus} onValueChange={(val) => {
                    setInvoiceStatus(val);
                    if (val === "rejected") {
                      setStatus("rejected");
                      setCustomerResponseStatus("declined");
                    }
                  }}>
                    <SelectTrigger className="mt-1.5 h-11 text-sm rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INVOICE_STATUS_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {job.holdedInvoiceDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Invoice Date</span>
                    <span className="text-gray-800 dark:text-gray-200 text-right">{format(new Date(job.holdedInvoiceDate), "dd MMM yyyy")}</span>
                  </div>
                )}
              </div>
              
              {/* Communication */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4" ref={communicationRef}>
                <CommunicationLogPanel
                  repairJobId={job.id}
                  logs={communicationLogs}
                  customerName={job.customer?.name}
                />
              </div>
          </div>
          {(job.holdedQuoteId || job.holdedInvoiceId) && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-3">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Documents</h3>
              <div className="space-y-2.5">
                {job.holdedQuoteId && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Receipt className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {job.status === "rejected" || job.customerResponseStatus === "declined"
                          ? "Rejected Quote"
                          : "Quote"}
                        {job.holdedQuoteNum && <span className="text-gray-500 dark:text-gray-400 ml-1">#{job.holdedQuoteNum}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-7 px-2 text-[11px] font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-md transition-colors"
                      >
                        PDF ↗
                      </a>
                      <a
                        href={`https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-7 px-2 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        Holded ↗
                      </a>
                    </div>
                  </div>
                )}
                {job.holdedInvoiceId && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        Invoice
                        {job.holdedInvoiceNum && <span className="text-gray-500 dark:text-gray-400 ml-1">#{job.holdedInvoiceNum}</span>}
                      </span>
                      {job.invoiceStatus === "paid" && (
                        <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">Paid</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-7 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-md transition-colors"
                      >
                        PDF ↗
                      </a>
                      <a
                        href={`https://app.holded.com/invoicing/invoice/${job.holdedInvoiceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center h-7 px-2 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
                      >
                        Holded ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Source & Import */}
          {(job.sourceSheet || job.sourceCategory || job.spreadsheetInternalId) && (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-4">
              <h3 className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">Source & Import</h3>
              <div className="space-y-3 text-sm">
                {job.sourceSheet && (
                  <div className="flex items-start justify-between py-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Sheet</span>
                    <span className="text-right text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[160px]">{job.sourceSheet}</span>
                  </div>
                )}
                {job.sourceCategory && (
                  <div className="flex items-start justify-between py-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Category</span>
                    <span className="text-right text-xs text-gray-800 dark:text-gray-200">{job.sourceCategory}</span>
                  </div>
                )}
                {job.spreadsheetInternalId && (
                  <div className="flex items-start justify-between py-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Ref ID</span>
                    <span className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">{job.spreadsheetInternalId}</span>
                  </div>
                )}
                {job.bayReference && (
                  <div className="flex items-start justify-between py-0.5">
                    <span className="text-gray-500 dark:text-gray-400">Location</span>
                    <span className="text-right font-mono text-xs text-gray-800 dark:text-gray-200">{job.bayReference}</span>
                  </div>
                )}
                {job.extraNotesRaw && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Extra notes (from import)</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{job.extraNotesRaw}</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Dialogs */}
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
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-150"
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
                <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                {u.name}
              </button>
            ))}
            {users.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No users available</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}

// ─── Photo Card ───

function PhotoCard({ photo }: { photo: { id: string; url: string; thumbnailUrl: string | null; caption: string | null; photoType: string | null; createdAt: Date | string } }) {
  const [deleting, startDelete] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/20">
        <button onClick={() => setExpanded(true)} className="w-full">
          <img
            src={photo.thumbnailUrl || photo.url}
            alt={photo.caption || "Photo"}
            className="aspect-square w-full object-cover"
          />
        </button>
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

      {/* Lightbox */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <button className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors" onClick={() => setExpanded(false)}>
            <XIcon className="h-5 w-5" />
          </button>
          <img src={photo.url} alt={photo.caption || ""} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ─── Photos Section with OneDrive link + upload ───

function PhotosSection({
  photos,
  tasks,
  jobId,
}: {
  photos: { id: string; repairJobId: string; repairTaskId: string | null; findingId: string | null; url: string; thumbnailUrl: string | null; caption: string | null; photoType: string | null; uploadedByUserId: string | null; createdAt: Date | string; onedriveFolderUrl?: string | null; onedrivePath?: string | null }[];
  tasks: RepairTask[];
  jobId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Get the OneDrive folder URL from the first photo that has it
  const onedriveFolderUrl = photos.find(p => p.onedriveFolderUrl)?.onedriveFolderUrl;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("repairJobId", jobId);
        formData.append("photoType", "general");
        const res = await fetch("/api/photos/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const text = await res.text();
          let msg = "Upload failed";
          try { msg = JSON.parse(text).error || msg; } catch {}
          throw new Error(msg);
        }
        successCount++;
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || "Upload failed"}`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount > 1 ? "s" : ""} uploaded to OneDrive`);
      router.refresh();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <details open={photos.length > 0}>
        <summary className="px-6 py-5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex items-center justify-between text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-150">
          <span className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Photos
            {photos.length > 0 && (
              <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full px-1.5 py-0.5 font-bold">{photos.length}</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {onedriveFolderUrl && (
              <a
                href={onedriveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-2.5 h-7 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M10.051 8.149L3.2 12.48l6.851 3.951 6.851-3.95-6.851-4.332zM20.8 12.48l-3.248-1.874-3.602 2.078 3.602 2.078L20.8 12.48zM3.2 13.598v4.164l6.851 3.951v-4.164L3.2 13.598zM10.949 17.549v4.164l6.851-3.951v-4.164l-6.851 3.951zM17.552 9.488L20.8 11.362V7.198l-3.248 1.874zM10.051 2.287L3.2 6.618l6.851 3.951 6.851-3.95-6.851-4.332z"/></svg>
                OneDrive Map
              </a>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 h-7 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <><RefreshCw className="h-3 w-3 animate-spin" /> Uploading...</>
              ) : (
                <><Plus className="h-3 w-3" /> Upload</>
              )}
            </button>
            <ChevronDown className="h-3.5 w-3.5 opacity-40" />
          </div>
        </summary>
        <div className="px-6 pb-6">

      {photos.length > 0 ? (
        <div className="space-y-4">
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
                    <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">{taskName(taskId)}</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {taskPics.map(photo => (
                        <PhotoCard key={photo.id} photo={photo} />
                      ))}
                    </div>
                  </div>
                ))}
                {generalPhotos.length > 0 && (
                  <div className="space-y-2">
                    {taskPhotos.length > 0 && <h4 className="text-xs font-medium text-gray-400 dark:text-gray-500">General</h4>}
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
        </div>
      ) : (
        <div className="text-center py-6">
          <Camera className="h-8 w-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">No photos yet</p>
          <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">Photos uploaded from the garage portal will appear here</p>
        </div>
      )}

        </div>
      </details>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
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
    <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden" ref={communicationRef}>
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/50 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setTab("comms")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all duration-150",
              tab === "comms"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Customer communication
            {communicationLogs.length > 0 && (
              <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-1.5 leading-relaxed">{communicationLogs.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("timeline")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold transition-all duration-150",
              tab === "timeline"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Timeline
            {events.length > 0 && (
              <span className="text-[10px] bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-1.5 leading-relaxed">{events.length}</span>
            )}
          </button>
        </div>
      </div>
      <div className="px-6 pb-5">
        {tab === "comms" ? (
          <CommunicationLogPanel
            repairJobId={repairJobId}
            logs={communicationLogs}
            customerName={customerName}
          />
        ) : (
          <div className="space-y-0">
            {events.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-6 text-center">
                <Clock className="mx-auto mb-2 h-5 w-5 text-gray-300 dark:text-gray-600" />
                <p className="text-xs text-gray-400 dark:text-gray-500">No timeline events yet</p>
              </div>
            ) : (
              events.map((event: any, idx: number) => (
                <div key={event.id} className="relative flex gap-3 pb-3 last:pb-0">
                  {idx < events.length - 1 && (
                    <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                  )}
                  <div className="relative mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 text-xs">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{event.userName ?? "System"}</span>
                      <span className="text-gray-400 dark:text-gray-500">{event.eventType.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-[11px] text-gray-300 dark:text-gray-600 whitespace-nowrap">
                        <SmartDate date={event.createdAt} />
                      </span>
                    </div>
                    {event.fieldChanged && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {event.fieldChanged}: {event.oldValue} → {event.newValue}
                      </p>
                    )}
                    {event.comment && (
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{event.comment}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Planning Date Row (with Send to Garage) ───

function PlanningDateRow({ jobId, dueDate, status, onStatusChange }: { jobId: string; dueDate: string | Date | null; status: string; onStatusChange?: (s: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function handleRemove() {
    setSaving(true);
    try {
      await unscheduleRepair(jobId);
      if (["scheduled", "in_progress"].includes(status)) {
        onStatusChange?.("todo");
      }
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

      {/* In Workshop status */}
      {inGarage && (
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
  tasks, partRequests, findings,
  initialDismissed,
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
  tasks: RepairTask[];
  partRequests: PartRequestItem[];
  findings: FindingItem[];
  initialDismissed: DismissedWorkshopItem[];
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmDeleteQuote, setConfirmDeleteQuote] = useState(false);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(false);
  const [dismissed, setDismissed] = useState<DismissedWorkshopItem[]>(initialDismissed);
  const [showDismissed, setShowDismissed] = useState(false);
  const isInvoiced = ["sent", "paid", "our_costs"].includes(invoiceStatus);
  const [ourCostsView, setOurCostsView] = useState(true);

  // Keep dismissed in sync with prop
  useEffect(() => { setDismissed(initialDismissed); }, [initialDismissed]);

  const hasEstimate = costLines.length > 0 || parseFloat(estimatedCost || "0") > 0;
  const hasQuote = !!job.holdedQuoteId;
  const hasInvoice = !!job.holdedInvoiceId;
  const isPaid = job.invoiceStatus === "paid";
  const quoteSent = !!job.holdedQuoteSentAt;
  const invoiceSent = !!job.holdedInvoiceSentAt;
  const hasUnsentDoc = (job.holdedQuoteId && !quoteSent) || (job.holdedInvoiceId && !invoiceSent);

  // Calculate pending workshop items (not yet imported AND not dismissed)
  const dismissedSet = new Set(dismissed.map(d => `${d.sourceType}:${d.sourceId}`));
  const importedSourceIds = new Set(costLines.filter(l => l.sourceType !== "manual" && l.sourceId).map(l => `${l.sourceType}:${l.sourceId}`));

  const completedTasks = tasks.filter(t => t.status === "done");
  const billableTasks = completedTasks.filter(t => t.billable && parseFloat(t.estimatedHours ?? "0") > 0);
  const activeParts = partRequests.filter(p => p.status !== "cancelled");

  const pendingTasks = billableTasks.filter(t => !importedSourceIds.has(`task:${t.id}`) && !dismissedSet.has(`task:${t.id}`));
  const pendingParts = activeParts.filter(p => !importedSourceIds.has(`part_request:${p.id}`) && !dismissedSet.has(`part_request:${p.id}`));
  const pendingImportCount = pendingTasks.length + pendingParts.length;
  const hasWorkshopPending = pendingImportCount > 0;
  const dismissedCount = dismissed.length;

  // Unsent doc warning
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

  async function handleRestore(dismissedId: string) {
    setDismissed(prev => prev.filter(d => d.id !== dismissedId));
    await restoreWorkshopItem(dismissedId);
    router.refresh();
  }

  async function handleRestoreAll() {
    setDismissed([]);
    await restoreAllWorkshopItems(job.id);
    router.refresh();
  }

  const activeStep = isPaid ? 3 : hasInvoice ? 2 : hasQuote ? 1 : 0;

  function sourceBadge(line: EstimateLineItem) {
    if (line.sourceType === "task") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400 font-medium">Workshop</span>;
    if (line.sourceType === "part_request") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400 font-medium">Part</span>;
    return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-medium">Manual</span>;
  }

  return (
    <div className="p-6 space-y-6">

      {/* ─── Step tabs ─── */}
      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-1">
        {[
          { label: "Estimate", step: 0 },
          { label: "Quote", step: 1 },
          { label: "Invoice", step: 2 },
          { label: "Paid", step: 3 },
        ].map((s) => (
          <div key={s.label} className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
            activeStep > s.step ? "text-emerald-600 dark:text-emerald-400" :
            activeStep === s.step ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm" :
            "text-gray-400 dark:text-gray-500"
          )}>
            {activeStep > s.step && <CheckCircle className="h-3 w-3" />}
            {s.label}
          </div>
        ))}
      </div>

      {/* ─── Workshop sync banner ─── */}
      {hasWorkshopPending && (
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-800/60 px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/50 shrink-0 mt-0.5">
              <RefreshCw className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sky-900 dark:text-sky-200">
                {pendingImportCount} item{pendingImportCount !== 1 ? "s" : ""} available from workshop
              </p>
              <p className="text-sm text-sky-700 dark:text-sky-400/80 mt-0.5">
                {pendingTasks.length > 0 && `${pendingTasks.length} task${pendingTasks.length !== 1 ? "s" : ""}`}
                {pendingTasks.length > 0 && pendingParts.length > 0 && ", "}
                {pendingParts.length > 0 && `${pendingParts.length} part${pendingParts.length !== 1 ? "s" : ""}`}
                {" can be added to this estimate."}
              </p>
            </div>
            <button
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0CC0DF] text-white text-sm font-medium shadow-sm hover:bg-[#0bb0cc] transition-colors disabled:opacity-50"
              onClick={() => handleAction("generate", async () => { await handleGenerateFromWork(); })}
              disabled={!!loading}
            >
              {loading === "generate" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Import
            </button>
          </div>
        </div>
      )}

      {/* ─── Totals row ─── */}
      <div className="flex items-baseline gap-10">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">Estimated</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums mt-0.5">
            €{costLines.length > 0 ? costLinesTotalInclTax.toFixed(2) : parseFloat(estimatedCost || "0").toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">Our Cost</p>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 tabular-nums mt-0.5">
            €{costLines.length > 0 ? costLinesInternalTotal.toFixed(2) : parseFloat(internalCost || "0").toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">Margin</p>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 tabular-nums mt-0.5">
            {costLinesInternalTotal > 0 ? `€${(costLinesTotal - costLinesInternalTotal).toFixed(2)}` : costLinesTotal > 0 ? `€${costLinesTotal.toFixed(2)}` : "—"}
            {costLinesInternalTotal > 0 && <span className="text-sm text-gray-400 dark:text-gray-500 ml-1">({Math.round((costLinesTotal - costLinesInternalTotal) / costLinesInternalTotal * 100)}%)</span>}
          </p>
        </div>
      </div>



      {/* ─── Line items section ─── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Line items</h3>
            <button
              onClick={() => {
                const next = !ourCostsView;
                setOurCostsView(next);
                if (next && invoiceStatus === "not_invoiced") {
                  setInvoiceStatus("our_costs");
                }
              }}
              className={cn(
                "inline-flex items-center h-6 text-[11px] px-2 rounded-lg font-medium transition-colors",
                ourCostsView
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"
              )}
            >
              Everything our costs
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {hasWorkshopPending && costLines.length > 0 && (
              <button
                className="inline-flex items-center gap-1 h-7 text-xs px-2.5 rounded-xl text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/50 transition-colors font-medium"
                onClick={() => handleAction("generate", async () => { await handleGenerateFromWork(); })}
                disabled={!!loading}
              >
                {loading === "generate" ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                Sync workshop
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 text-[9px] font-bold px-1">{pendingImportCount}</span>
              </button>
            )}
            {costLines.length > 0 && (
              <AddItemDropdown
                onLabour={addLabourLine}
                onCustom={addCustomLine}
                onPart={() => setShowPartPicker(!showPartPicker)}
              />
            )}
          </div>
        </div>

        {showPartPicker && (
          <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-2xl p-3 bg-gray-50/50 dark:bg-gray-900/30">
            <Input placeholder="Search parts..." value={partSearch} onChange={(e) => setPartSearch(e.target.value)} className="h-8 text-sm rounded-xl mb-2" autoFocus />
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                type="button"
                onClick={() => setPartCategory(null)}
                className={cn(
                  "inline-flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
                  !partCategory ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900" : "bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                      "inline-flex items-center gap-1 h-6 px-2.5 rounded-lg text-[11px] font-medium transition-colors",
                      partCategory === cat.key ? `${cat.color}` : "bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                <p className="text-sm text-gray-400 py-3 text-center">No parts found</p>
              ) : (
                filteredParts.map((p) => {
                  const baseCost = p.defaultCost ? parseFloat(p.defaultCost) : 0;
                  const markup = p.markupPercent ? parseFloat(p.markupPercent) : settings.defaultMarkup;
                  const sellPrice = baseCost * (1 + markup / 100);
                  return (
                    <button key={p.id} type="button" onClick={() => addPartLine(p)} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white dark:hover:bg-gray-800 transition-colors flex justify-between items-center">
                      <span className="truncate">{p.name}{p.partNumber && <span className="text-gray-400 ml-1">({p.partNumber})</span>}</span>
                      <span className="text-gray-500 shrink-0 ml-2 tabular-nums">€{sellPrice.toFixed(2)}{baseCost > 0 && <span className="text-[10px] ml-1 text-gray-400">+{markup}%</span>}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {costLines.length > 0 ? (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider px-4 pb-1">
              <span className="w-16 shrink-0">Source</span>
              <span className="flex-1">Description</span>
              <span className="w-14 text-center">Qty</span>
              <span className="w-20 text-right">Our cost</span>
              {!ourCostsView && <span className="w-20 text-right">Sell</span>}
              {!ourCostsView && <span className="w-16 text-right">Total</span>}
              <span className="w-7" />
            </div>

            {/* Line item rows */}
            {costLines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                <span className="w-16 shrink-0">{sourceBadge(line)}</span>
                <Input value={line.description} onChange={(e) => updateCostLine(line.id, "description", e.target.value)} placeholder={line.type === "labour" ? "Labour description" : "Description"} className="h-7 text-xs rounded-lg flex-1 border-gray-200 dark:border-gray-700" />
                <Input type="number" min="0.25" step={line.type === "labour" ? "0.25" : "1"} value={line.quantity} onChange={(e) => updateCostLine(line.id, "quantity", parseFloat(e.target.value) || 1)} className="h-7 text-xs rounded-lg w-14 text-center border-gray-200 dark:border-gray-700" />
                <div className="relative w-20">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">€</span>
                  <Input type="number" step="0.01" min="0" value={line.internalCost} onChange={(e) => updateCostLine(line.id, "internalCost", parseFloat(e.target.value) || 0)} className="h-7 text-xs pl-5 pr-2 text-right rounded-lg text-gray-500 border-gray-200 dark:border-gray-700" />
                </div>
                {!ourCostsView && (
                  <div className="relative w-20">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">€</span>
                    <Input type="number" step="0.01" min="0" value={line.unitPrice} onChange={(e) => updateCostLine(line.id, "unitPrice", parseFloat(e.target.value) || 0)} className="h-7 text-xs pl-5 pr-2 text-right rounded-lg border-gray-200 dark:border-gray-700" />
                  </div>
                )}
                {!ourCostsView && <span className="text-xs font-medium w-16 text-right tabular-nums text-gray-900 dark:text-gray-100">€{(parseFloat(line.quantity) * parseFloat(line.unitPrice)).toFixed(2)}</span>}
                <button className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 hover:text-red-500 transition-colors" onClick={() => removeCostLine(line.id)}><XIcon className="h-3 w-3" /></button>
              </div>
            ))}

            {/* Discount */}
            <div className="flex items-center justify-between pt-3 gap-2 px-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Discount</span>
                <div className="relative w-16">
                  <Input type="number" min="0" max="100" step="1" value={discountPercent} onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)} className="h-6 text-xs pr-5 text-right rounded-lg border-gray-200 dark:border-gray-700" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                </div>
              </div>
              {discountPercent > 0 && <span className="text-xs text-red-500 tabular-nums font-medium">-€{discountAmount.toFixed(2)}</span>}
            </div>

            {/* Summary totals */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/40 px-4 py-3 space-y-1.5 mt-2">
              {ourCostsView ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-violet-700 dark:text-violet-400">Total (our costs)</span>
                  <span className="text-sm font-bold tabular-nums text-violet-700 dark:text-violet-400">€{costLinesInternalTotal.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Subtotal excl. VAT</span>
                    <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">€{costLinesTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">VAT ({settings.defaultTax}%)</span>
                    <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">€{(costLinesTotal * settings.defaultTax / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total incl. VAT</span>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">€{costLinesTotalInclTax.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ─── Empty state ─── */
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20 py-10 text-center">
            <Receipt className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No line items yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
              Add labour, parts, or custom costs to create your estimate.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              {hasWorkshopPending && (
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0CC0DF] text-white text-sm font-medium shadow-sm hover:bg-[#0bb0cc] transition-colors disabled:opacity-50"
                  onClick={() => handleAction("generate", async () => { await handleGenerateFromWork(); })}
                  disabled={!!loading}
                >
                  {loading === "generate" ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Sync workshop
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-white/20 text-white text-[10px] font-bold px-1">{pendingImportCount}</span>
                </button>
              )}
              <AddItemDropdown
                onLabour={addLabourLine}
                onCustom={addCustomLine}
                onPart={() => setShowPartPicker(!showPartPicker)}
              />
            </div>
          </div>
        )}

        {/* Dismissed items management */}
        {dismissedCount > 0 && (
          <div className="mt-3">
            <button
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              onClick={() => setShowDismissed(!showDismissed)}
            >
              {dismissedCount} workshop item{dismissedCount !== 1 ? "s" : ""} hidden {showDismissed ? "▴" : "▾"}
            </button>
            {showDismissed && (
              <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Dismissed items</span>
                  <button
                    className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium transition-colors"
                    onClick={handleRestoreAll}
                  >
                    Restore all
                  </button>
                </div>
                {dismissed.map((d) => {
                  const sourceLabel = d.sourceType === "task"
                    ? billableTasks.find(t => t.id === d.sourceId)?.title ?? "Task"
                    : activeParts.find(p => p.id === d.sourceId)?.partName ?? "Part";
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-medium shrink-0">{d.sourceType === "task" ? "Task" : "Part"}</span>
                        <span className="truncate">{sourceLabel}</span>
                      </div>
                      <button
                        className="text-[11px] text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium shrink-0 transition-colors"
                        onClick={() => handleRestore(d.id)}
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Quote section ─── */}
      {(costLines.length > 0 || hasQuote) && (
      <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quote</h3>
          {hasQuote && (
            <div className="flex items-center gap-2">
              <a href={`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#0CC0DF] hover:underline">
                {job.holdedQuoteNum} ↗
              </a>
              {quoteSent ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 font-medium">Sent</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 font-medium">Not sent</span>
              )}
            </div>
          )}
        </div>

        {hasQuote ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl" onClick={() => window.open(`/api/holded/pdf?type=estimate&id=${job.holdedQuoteId}`, "_blank")}>
                View PDF
              </Button>
              {job.customer?.email && (
                <Button variant={quoteSent ? "outline" : "default"} size="sm" className="flex-1 text-xs rounded-xl" disabled={loading === "send-quote"}
                  onClick={() => handleAction("send-quote", async () => { await sendHoldedQuote(job.id); toast.success("Quote sent to " + job.customer.email); router.refresh(); })}>
                  {loading === "send-quote" ? <Spinner className="mr-1" /> : null}{quoteSent ? "Resend" : "Email Quote"}
                </Button>
              )}
              <a href={`https://app.holded.com/invoicing/estimate/${job.holdedQuoteId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 px-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                Holded ↗
              </a>
            </div>
            {confirmDeleteQuote ? (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/50">
                <span className="text-xs text-red-700 dark:text-red-400 flex-1">Delete quote {job.holdedQuoteNum}?</span>
                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 rounded-xl" disabled={loading === "delete-quote"}
                  onClick={() => handleAction("delete-quote", async () => { await deleteHoldedQuote(job.id); toast.success("Quote deleted"); setConfirmDeleteQuote(false); router.refresh(); })}>
                  {loading === "delete-quote" ? <Spinner /> : "Delete"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs px-3 rounded-xl" onClick={() => setConfirmDeleteQuote(false)}>Cancel</Button>
              </div>
            ) : (
              <button className="text-[11px] text-gray-400 hover:text-red-500 transition-colors" onClick={() => setConfirmDeleteQuote(true)}>Delete quote</button>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="flex-1 text-xs rounded-xl"
              disabled={!job.customer || costLines.length === 0 || !!loading}
              onClick={() => handleAction("create-quote", async () => {
                const result = await createHoldedQuote(job.id, costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 })), discountPercent);
                toast.success(`Quote ${result.quoteNum} created`);
                router.refresh();
              })}>
              {loading === "create-quote" ? <Spinner className="mr-1" /> : null}Create Quote
            </Button>
            {job.customer?.email && (
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl"
                disabled={!job.customer || costLines.length === 0 || !!loading}
                onClick={() => handleAction("create-send-quote", async () => {
                  const result = await createHoldedQuote(job.id, costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 })), discountPercent);
                  await sendHoldedQuote(job.id);
                  toast.success(`Quote ${result.quoteNum} created & sent`);
                  router.refresh();
                })}>
                {loading === "create-send-quote" ? <Spinner className="mr-1" /> : null}Create & Email
              </Button>
            )}
            {!job.customer && <p className="text-xs text-gray-400">Link a contact first</p>}
          </div>
        )}
      </div>
      )}

      {/* ─── Invoice section ─── */}
      {(hasQuote || hasInvoice) && (
      <div className="pt-6 border-t border-gray-100 dark:border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Invoice</h3>
          {hasInvoice && (
            <div className="flex items-center gap-2">
              <a href={`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#0CC0DF] hover:underline">
                {job.holdedInvoiceNum} ↗
              </a>
              {invoiceSent ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 font-medium">Sent</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 font-medium">Not sent</span>
              )}
              {isPaid && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 font-medium">Paid</span>
              )}
            </div>
          )}
        </div>

        {hasInvoice ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl" onClick={() => window.open(`/api/holded/pdf?type=invoice&id=${job.holdedInvoiceId}`, "_blank")}>
                View PDF
              </Button>
              {job.customer?.email && (
                <Button variant={invoiceSent ? "outline" : "default"} size="sm" className="flex-1 text-xs rounded-xl" disabled={loading === "send-invoice"}
                  onClick={() => handleAction("send-invoice", async () => { await sendHoldedInvoice(job.id); toast.success("Invoice sent to " + job.customer.email); router.refresh(); })}>
                  {loading === "send-invoice" ? <Spinner className="mr-1" /> : null}{invoiceSent ? "Resend" : "Email Invoice"}
                </Button>
              )}
              <a href={`https://app.holded.com/invoicing/invoice/${job.holdedInvoiceId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center h-8 px-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                Holded ↗
              </a>
            </div>
            {job.invoiceStatus !== "paid" && (
              confirmDeleteInvoice ? (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/50">
                  <span className="text-xs text-red-700 dark:text-red-400 flex-1">Delete invoice {job.holdedInvoiceNum}?</span>
                  <Button variant="destructive" size="sm" className="h-7 text-xs px-3 rounded-xl" disabled={loading === "delete-invoice"}
                    onClick={() => handleAction("delete-invoice", async () => { await deleteHoldedInvoice(job.id); toast.success("Invoice deleted"); setConfirmDeleteInvoice(false); router.refresh(); })}>
                    {loading === "delete-invoice" ? <Spinner /> : "Delete"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-3 rounded-xl" onClick={() => setConfirmDeleteInvoice(false)}>Cancel</Button>
                </div>
              ) : (
                <button className="text-[11px] text-gray-400 hover:text-red-500 transition-colors" onClick={() => setConfirmDeleteInvoice(true)}>Delete invoice</button>
              )
            )}
          </div>
        ) : (
          <Button variant="default" size="sm" className="w-full text-xs rounded-xl"
            disabled={!job.customer || costLines.length === 0 || !!loading}
            onClick={() => handleAction("create-invoice", async () => {
              const items = costLines.map(l => ({ name: l.description || "Line item", units: parseFloat(l.quantity), subtotal: parseFloat(l.unitPrice) * parseFloat(l.quantity), tax: settings.defaultTax, discount: 0 }));
              const result = await createHoldedInvoice(job.id, items, discountPercent);
              toast.success(`Invoice ${result.invoiceNum} created`);
              router.refresh();
            })}>
            {loading === "create-invoice" ? <Spinner className="mr-1" /> : null}Create Invoice
          </Button>
        )}
      </div>
      )}

      {/* Unsent warning */}
      {hasUnsentDoc && (
        <div className="pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
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
        <div className="pt-2">
          <button className="w-full text-[11px] text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors py-1"
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

// ─── Job Type Picker (inline dropdown badge) ────────────────────────────────

const JOB_TYPE_ICON: Record<JobType, React.ElementType> = {
  repair: Wrench,
  wax: Sparkles,
  maintenance: Settings,
  inspection: ClipboardCheck,
};

function JobTypePicker({ value, onChange }: { value: JobType; onChange: (v: JobType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const Icon = JOB_TYPE_ICON[value];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300",
          JOB_TYPE_COLORS[value]
        )}
      >
        <Icon className="h-3 w-3" />
        {JOB_TYPE_LABELS[value]}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1 min-w-[160px]">
          {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((type) => {
            const TypeIcon = JOB_TYPE_ICON[type];
            const active = value === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => { onChange(type); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {JOB_TYPE_LABELS[type]}
                {active && <CheckCircle className="h-3 w-3 ml-auto text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Status Picker (inline dropdown badge, same style as JobTypePicker) ───

const STATUS_GROUPS = [
  { label: "Intake", items: ["new", "todo", "in_inspection", "no_damage"] },
  { label: "Quote", items: ["quote_needed", "waiting_approval", "waiting_customer"] },
  { label: "Work", items: ["waiting_parts", "scheduled", "in_progress", "blocked", "ready_for_check"] },
  { label: "Done", items: ["completed", "invoiced", "rejected", "archived"] },
] as const;

const STATUS_DOT_COLORS: Record<string, string> = {
  new: "bg-gray-400",
  todo: "bg-gray-400",
  in_inspection: "bg-blue-500",
  quote_needed: "bg-amber-500",
  waiting_approval: "bg-amber-500",
  waiting_customer: "bg-orange-500",
  waiting_parts: "bg-amber-500",
  no_damage: "bg-gray-400",
  scheduled: "bg-blue-400",
  in_progress: "bg-sky-500",
  blocked: "bg-red-500",
  ready_for_check: "bg-amber-500",
  completed: "bg-emerald-500",
  invoiced: "bg-emerald-400",
  rejected: "bg-red-500",
  archived: "bg-gray-400",
};

function StatusPicker({ value, onChange, badgeColor, variant = "pill" }: { value: string; onChange: (v: string) => void; badgeColor?: string; variant?: "pill" | "select" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const triggerPill = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300",
        badgeColor
      )}
    >
      {STATUS_LABELS[value as RepairStatus]}
      <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
    </button>
  );

  const triggerSelect = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex items-center justify-between w-full h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 transition-all hover:border-gray-300 dark:hover:border-gray-600"
    >
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[value] ?? "bg-gray-400"}`} />
        {STATUS_LABELS[value as RepairStatus]}
      </span>
      <ChevronDown className={cn("h-3.5 w-3.5 text-gray-400 transition-transform", open && "rotate-180")} />
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      {variant === "select" ? triggerSelect : triggerPill}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1 min-w-[180px] max-h-[360px] overflow-y-auto">
          {STATUS_GROUPS.map((group) => (
            <div key={group.label} className="mb-0.5 last:mb-0">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-gray-300 dark:text-gray-600 px-3 pt-2 pb-0.5">{group.label}</p>
              {group.items.map((val) => {
                const active = value === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { onChange(val); setOpen(false); }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      active
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    )}
                  >
                    {STATUS_LABELS[val as RepairStatus]}
                    {active && <CheckCircle className="h-3 w-3 ml-auto text-green-500" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Generic Inline Pill Picker ───

function InlinePillPicker({ value, onChange, options, colorMap }: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const badgeColor = colorMap[value] ?? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 border",
          badgeColor
        )}
      >
        {options[value] ?? value}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1 min-w-[160px] max-h-[300px] overflow-y-auto">
          {Object.entries(options).map(([val, label]) => {
            const active = value === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => { onChange(val); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                )}
              >
                {label}
                {active && <CheckCircle className="h-3 w-3 ml-auto text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
