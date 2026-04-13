"use client";

import { ReactNode, useState, useEffect } from "react";
import {
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Zap,
  X,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type SuggestionLevel = "action" | "warning" | "info" | "success";

export interface Suggestion {
  id: string;
  level: SuggestionLevel;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
}

const LEVEL_ICON: Record<SuggestionLevel, ReactNode> = {
  action: <Zap className="h-3.5 w-3.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5" />,
  info: <Info className="h-3.5 w-3.5" />,
  success: <CheckCircle2 className="h-3.5 w-3.5" />,
};

function SuggestionRow({ suggestion }: { suggestion: Suggestion }) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-1.5 transition-all shrink-0",
        (suggestion.href || suggestion.onClick) &&
          "cursor-pointer hover:bg-gray-100 hover:-translate-y-px active:translate-y-0"
      )}
    >
      <span className="shrink-0 text-gray-400">
        {LEVEL_ICON[suggestion.level]}
      </span>
      <p className="text-xs font-medium text-gray-600 leading-tight whitespace-nowrap">{suggestion.title}</p>
      {(suggestion.href || suggestion.onClick) && (
        <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
      )}
    </div>
  );

  if (suggestion.href) {
    return <Link href={suggestion.href}>{content}</Link>;
  }

  if (suggestion.onClick) {
    return (
      <button type="button" onClick={suggestion.onClick} className="text-left shrink-0">
        {content}
      </button>
    );
  }

  return content;
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  className?: string;
  maxVisible?: number;
}

const SUGGESTIONS_HIDDEN_KEY = "smart-suggestions-hidden";

export function SmartSuggestions({
  suggestions,
  className,
  maxVisible = 5,
}: SmartSuggestionsProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SUGGESTIONS_HIDDEN_KEY) === "true") setHidden(true);
    } catch {}
  }, []);

  if (suggestions.length === 0) return null;

  if (hidden) {
    return (
      <button
        type="button"
        onClick={() => {
          setHidden(false);
          try { localStorage.removeItem(SUGGESTIONS_HIDDEN_KEY); } catch {}
        }}
        className={cn(
          "flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors",
          className,
        )}
      >
        <Eye className="h-3.5 w-3.5" />
        Show suggestions ({suggestions.length})
      </button>
    );
  }

  // Sort: actions first, then warnings, then info, then success
  const order: SuggestionLevel[] = ["action", "warning", "info", "success"];
  const sorted = [...suggestions].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level)
  );
  const visible = sorted.slice(0, maxVisible);

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin", className)}>
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100 shrink-0">
        <Lightbulb className="h-3.5 w-3.5 text-gray-400" />
      </div>
      {visible.map((s) => (
        <SuggestionRow key={s.id} suggestion={s} />
      ))}
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500 transition-colors shrink-0"
        onClick={() => {
          setHidden(true);
          try { localStorage.setItem(SUGGESTIONS_HIDDEN_KEY, "true"); } catch {}
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Suggestion generators ─────────────────────────────────────

export interface RepairSuggestionActions {
  onLinkCustomer?: () => void;
  onAssignUser?: () => void;
  onCreateInvoice?: () => void;
  onCreateQuote?: () => void;
  onEditDescription?: () => void;
  onEditEstimate?: () => void;
  onOpenCommunication?: () => void;
  onClearFollowUp?: () => void;
}

export function getRepairSuggestions(job: any, actions?: RepairSuggestionActions): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysSinceUpdated = Math.floor(
    (Date.now() - new Date(job.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);
  const hasActualCost = !!(job.actualCost && parseFloat(job.actualCost) > 0);
  const isActive = !["completed", "invoiced", "archived", "rejected"].includes(job.status);
  const isCompleted = job.status === "completed" || job.status === "invoiced";
  const isRejected = job.status === "rejected" || job.invoiceStatus === "rejected";

  // Rejected by client
  if (isRejected) {
    suggestions.push({
      id: "rejected",
      level: "info",
      title: "Rejected by client",
      description: "Client declined the repair. Archive or reassess.",
    });
    // No further suggestions for rejected repairs
    return suggestions;
  }

  // No customer linked
  if (!job.customer) {
    suggestions.push({
      id: "no-customer",
      level: "warning",
      title: "No customer linked",
      description: "Link a customer to enable communication and invoicing.",
      onClick: actions?.onLinkCustomer,
    });
  }

  // No description
  if (!job.descriptionRaw && isActive) {
    suggestions.push({
      id: "no-description",
      level: "info",
      title: "Add a description",
      description: "Describe the issue to help track this repair.",
      onClick: actions?.onEditDescription,
    });
  }

  // Completed but not invoiced (skip warranty / internal cost)
  if (job.status === "completed" && job.invoiceStatus === "not_invoiced" && !job.holdedInvoiceId && !job.warrantyInternalCostFlag) {
    suggestions.push({
      id: "completed-no-invoice",
      level: "action",
      title: "Ready to invoice",
      description: hasEstimate || hasActualCost
        ? `Create invoice for €${(parseFloat(job.actualCost || job.estimatedCost)).toFixed(2)}`
        : "Add a cost estimate first, then create the invoice.",
      onClick: actions?.onCreateInvoice,
    });
  }

  // Has quote but waiting for approval — nudge
  if (job.status === "waiting_approval" && job.holdedQuoteId) {
    suggestions.push({
      id: "quote-awaiting",
      level: "action",
      title: "Quote sent — awaiting client approval",
    });
  }

  // Quote needed but no quote created yet
  if (job.status === "quote_needed" && !job.holdedQuoteId) {
    suggestions.push({
      id: "needs-quote",
      level: "action",
      title: "Create and send a quote",
      onClick: actions?.onCreateQuote,
    });
  }

  // Has invoice sent but not paid
  if (job.invoiceStatus === "sent" && job.holdedInvoiceId) {
    suggestions.push({
      id: "invoice-sent",
      level: "info",
      title: `Invoice ${job.holdedInvoiceNum ?? ""} sent — awaiting payment`,
    });
  }

  // Has estimate, active, no invoice yet — remind about invoice
  if (isActive && hasEstimate && !job.holdedInvoiceId && job.customer && job.status !== "new" && job.status !== "todo") {
    suggestions.push({
      id: "estimate-ready",
      level: "info",
      title: `Cost estimate: €${parseFloat(job.estimatedCost).toFixed(2)}`,
      description: "Invoice can be created once the repair is completed.",
    });
  }

  // Customer not contacted
  if (job.customerResponseStatus === "not_contacted" && job.customer && isActive) {
    suggestions.push({
      id: "not-contacted",
      level: "action",
      title: "Customer not contacted yet",
      description: "Reach out to inform them about the repair status.",
      onClick: actions?.onOpenCommunication,
    });
  }

  // Waiting for customer response for too long
  if (job.customerResponseStatus === "no_response" && isActive) {
    suggestions.push({
      id: "no-response",
      level: "warning",
      title: "No response from customer",
      description: "Follow up — the customer hasn't responded.",
      onClick: actions?.onOpenCommunication,
    });
  }

  // Unassigned high/urgent priority
  if (!job.assignedUser && (job.priority === "high" || job.priority === "urgent") && isActive) {
    suggestions.push({
      id: "unassigned-priority",
      level: "warning",
      title: `${job.priority === "urgent" ? "Urgent" : "High priority"} repair is unassigned`,
      description: "Assign someone to start work on this.",
      onClick: actions?.onAssignUser,
    });
  }

  // Waiting for parts — check if parts are ordered
  if (job.status === "waiting_parts" && job.partRequests?.length === 0) {
    suggestions.push({
      id: "waiting-no-parts-ordered",
      level: "warning",
      title: "Waiting for parts — none ordered",
      description: "Status is 'Waiting for Parts' but no parts have been requested.",
    });
  }

  // Parts required flag but status isn't waiting_parts
  if (job.partsRequiredFlag && job.status !== "waiting_parts" && isActive && !isCompleted) {
    suggestions.push({
      id: "parts-flag-status-mismatch",
      level: "info",
      title: "Parts required flag is set",
      description: "Consider changing status to 'Waiting for Parts' or order the parts needed.",
    });
  }

  // Safety or water damage flags
  if (job.safetyFlag && isActive) {
    suggestions.push({
      id: "safety-flag",
      level: "warning",
      title: "Safety concern flagged",
      description: "This repair has a safety flag — prioritize accordingly.",
    });
  }
  if (job.waterDamageRiskFlag && isActive) {
    suggestions.push({
      id: "water-damage-flag",
      level: "warning",
      title: "Water damage risk",
      description: "Address water damage risk before it worsens.",
    });
  }

  // Stale repair — no update in 14+ days
  if (daysSinceUpdated >= 14 && isActive) {
    suggestions.push({
      id: "stale-repair",
      level: "warning",
      title: `No updates for ${daysSinceUpdated} days`,
      description: "This repair hasn't been touched in a while — check if it's still active.",
    });
  }

  // Old repair — open for 30+ days
  if (daysSinceCreated >= 30 && isActive) {
    suggestions.push({
      id: "old-repair",
      level: "info",
      title: `Open for ${daysSinceCreated} days`,
      description: "Consider whether this repair should be completed or archived.",
    });
  }

  // No cost estimate on active repair in later stages
  if (!hasEstimate && !hasActualCost && isActive && ["in_progress", "scheduled", "blocked"].includes(job.status)) {
    suggestions.push({
      id: "no-estimate",
      level: "action",
      title: "No cost estimate",
      description: "Add parts or a manual estimate for this repair.",
      onClick: actions?.onEditEstimate,
    });
  }

  // Follow-up required flag
  if (job.followUpRequiredFlag && isActive) {
    suggestions.push({
      id: "follow-up-flag",
      level: "action",
      title: "Follow-up required",
      description: "This repair is flagged for follow-up — schedule or complete it.",
      onClick: actions?.onClearFollowUp,
    });
  }

  // Customer has no email — needed for invoicing
  if (job.customer && !job.customer.email && (hasEstimate || hasActualCost)) {
    suggestions.push({
      id: "customer-no-email",
      level: "info",
      title: "Customer has no email",
      description: "Add an email to send invoices directly from Holded.",
      href: `/customers/${job.customer.id}`,
    });
  }

  return suggestions;
}

export function getCustomerSuggestions(
  customer: any,
  holdedInvoices: any[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const openRepairs = customer.repairJobs?.filter(
    (j: any) => !["completed", "invoiced", "archived", "rejected"].includes(j.status)
  ) ?? [];
  const urgentRepairs = openRepairs.filter((j: any) => j.priority === "urgent");

  // Missing email
  if (!customer.email) {
    suggestions.push({
      id: "no-email",
      level: "warning",
      title: "No email address",
      description: "Add an email to enable invoice delivery via Holded.",
    });
  }

  // Missing phone
  if (!customer.phone && !customer.mobile) {
    suggestions.push({
      id: "no-phone",
      level: "warning",
      title: "No phone or mobile number",
      description: "Add a phone number for communication.",
    });
  }

  // Incomplete address
  if (!customer.address && !customer.city) {
    suggestions.push({
      id: "no-address",
      level: "info",
      title: "No address on file",
      description: "Add address details for invoicing and records.",
    });
  }

  // No VAT number for business
  if (customer.contactType === "business" && !customer.vatnumber) {
    suggestions.push({
      id: "no-vat",
      level: "info",
      title: "Missing VAT / NIF number",
      description: "Business contacts should have a VAT number for proper invoicing.",
    });
  }

  // Open repairs
  if (openRepairs.length > 0) {
    suggestions.push({
      id: "open-repairs",
      level: "info",
      title: `${openRepairs.length} active repair${openRepairs.length !== 1 ? "s" : ""}`,
      description: urgentRepairs.length > 0
        ? `Including ${urgentRepairs.length} urgent.`
        : "Check their progress.",
    });
  }

  // Rejected repairs
  const rejectedRepairs = customer.repairJobs?.filter(
    (j: any) => j.status === "rejected" || j.invoiceStatus === "rejected"
  ) ?? [];
  if (rejectedRepairs.length > 0) {
    suggestions.push({
      id: "rejected-repairs",
      level: "info",
      title: `${rejectedRepairs.length} rejected repair${rejectedRepairs.length !== 1 ? "s" : ""}`,
    });
  }

  // Completed repairs ready to invoice
  const completedNoInvoice = customer.repairJobs?.filter(
    (j: any) => j.status === "completed" && !j.holdedInvoiceId && !j.warrantyInternalCostFlag
  ) ?? [];
  if (completedNoInvoice.length > 0) {
    suggestions.push({
      id: "ready-to-invoice",
      level: "action",
      title: `${completedNoInvoice.length} completed repair${completedNoInvoice.length !== 1 ? "s" : ""} ready to invoice`,
      description: "Create invoices for finished work.",
      href: `/repairs/${completedNoInvoice[0].id}`,
    });
  }

  // Not linked to Holded
  if (!customer.holdedContactId && (customer.email || customer.phone)) {
    suggestions.push({
      id: "no-holded",
      level: "action",
      title: "Not synced to Holded yet",
      description: "Save the contact to create it in Holded automatically.",
    });
  }

  // No units linked
  if (!customer.units || customer.units.length === 0) {
    suggestions.push({
      id: "no-units",
      level: "info",
      title: "No units linked",
      description: "Add a caravan or trailer to track repairs per unit.",
    });
  }

  // Unit missing storage location
  const unitsNoStorage = customer.units?.filter(
    (u: any) => !u.storageLocation
  ) ?? [];
  if (unitsNoStorage.length > 0 && customer.units?.length > 0) {
    suggestions.push({
      id: "unit-no-storage",
      level: "info",
      title: `${unitsNoStorage.length} unit${unitsNoStorage.length !== 1 ? "s" : ""} without storage location`,
      description: "Set the stalling location to keep track of where units are stored.",
    });
  }

  // Unpaid invoices
  const unpaid = holdedInvoices.filter((inv: any) => inv.status !== 1);
  if (unpaid.length > 0) {
    const total = unpaid.reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0);
    suggestions.push({
      id: "unpaid-invoices",
      level: "warning",
      title: `${unpaid.length} unpaid invoice${unpaid.length !== 1 ? "s" : ""} (€${total.toFixed(2)})`,
      description: "Review outstanding invoices.",
      href: "/invoices",
    });
  }

  // Paid invoices total (success)
  const paid = holdedInvoices.filter((inv: any) => inv.status === 1);
  if (paid.length > 0 && unpaid.length === 0 && openRepairs.length === 0) {
    const total = paid.reduce((sum: number, inv: any) => sum + (inv.total ?? 0), 0);
    suggestions.push({
      id: "all-paid",
      level: "success",
      title: `All invoices paid (€${total.toFixed(2)} total)`,
      description: "This customer is fully up to date.",
    });
  }

  return suggestions;
}
