"use client";

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Zap,
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

const LEVEL_CONFIG: Record<
  SuggestionLevel,
  { icon: ReactNode; bg: string; border: string; text: string; iconColor: string }
> = {
  action: {
    icon: <Zap className="h-3.5 w-3.5" />,
    bg: "bg-blue-50/80 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-200",
    iconColor: "text-blue-500",
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    bg: "bg-amber-50/80 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-900 dark:text-amber-200",
    iconColor: "text-amber-500",
  },
  info: {
    icon: <Info className="h-3.5 w-3.5" />,
    bg: "bg-slate-50/80 dark:bg-slate-900/40",
    border: "border-slate-200 dark:border-slate-700",
    text: "text-slate-700 dark:text-slate-300",
    iconColor: "text-slate-400",
  },
  success: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    bg: "bg-emerald-50/80 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-200",
    iconColor: "text-emerald-500",
  },
};

function SuggestionRow({ suggestion }: { suggestion: Suggestion }) {
  const config = LEVEL_CONFIG[suggestion.level];

  const content = (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all",
        config.bg,
        config.border,
        config.text,
        (suggestion.href || suggestion.onClick) &&
          "cursor-pointer hover:shadow-sm hover:-translate-y-px active:translate-y-0"
      )}
    >
      <span className={cn("mt-0.5 shrink-0", config.iconColor)}>
        {config.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">{suggestion.title}</p>
        {suggestion.description && (
          <p className="text-[11px] mt-0.5 opacity-75 leading-snug">
            {suggestion.description}
          </p>
        )}
      </div>
      {(suggestion.href || suggestion.onClick) && (
        <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-40" />
      )}
    </div>
  );

  if (suggestion.href) {
    return <Link href={suggestion.href}>{content}</Link>;
  }

  if (suggestion.onClick) {
    return (
      <button type="button" onClick={suggestion.onClick} className="w-full text-left">
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

export function SmartSuggestions({
  suggestions,
  className,
  maxVisible = 5,
}: SmartSuggestionsProps) {
  if (suggestions.length === 0) return null;

  // Sort: actions first, then warnings, then info, then success
  const order: SuggestionLevel[] = ["action", "warning", "info", "success"];
  const sorted = [...suggestions].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level)
  );
  const visible = sorted.slice(0, maxVisible);

  return (
    <Card className={cn("rounded-xl border-dashed", className)}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-xs font-semibold">Smart Suggestions</p>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="space-y-1.5">
          {visible.map((s) => (
            <SuggestionRow key={s.id} suggestion={s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Suggestion generators ─────────────────────────────────────

export function getRepairSuggestions(job: any): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysSinceUpdated = Math.floor(
    (Date.now() - new Date(job.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);
  const hasActualCost = !!(job.actualCost && parseFloat(job.actualCost) > 0);
  const isActive = !["completed", "invoiced", "archived"].includes(job.status);
  const isCompleted = job.status === "completed" || job.status === "invoiced";

  // No customer linked
  if (!job.customer) {
    suggestions.push({
      id: "no-customer",
      level: "warning",
      title: "No customer linked",
      description: "Link a customer to enable communication and invoicing.",
    });
  }

  // No description
  if (!job.descriptionRaw && isActive) {
    suggestions.push({
      id: "no-description",
      level: "info",
      title: "Add a description",
      description: "Describe the issue to help track this repair.",
    });
  }

  // Completed but not invoiced
  if (job.status === "completed" && job.invoiceStatus === "not_invoiced" && !job.holdedInvoiceId) {
    suggestions.push({
      id: "completed-no-invoice",
      level: "action",
      title: "Ready to invoice",
      description: hasEstimate || hasActualCost
        ? `Create a Holded invoice for €${(parseFloat(job.actualCost || job.estimatedCost)).toFixed(2)}.`
        : "Add a cost estimate first, then create the invoice.",
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
    });
  }

  // Waiting for customer response for too long
  if (job.customerResponseStatus === "no_response" && isActive) {
    suggestions.push({
      id: "no-response",
      level: "warning",
      title: "No response from customer",
      description: "Follow up — the customer hasn't responded.",
    });
  }

  // Unassigned high/urgent priority
  if (!job.assignedUser && (job.priority === "high" || job.priority === "urgent") && isActive) {
    suggestions.push({
      id: "unassigned-priority",
      level: "warning",
      title: `${job.priority === "urgent" ? "Urgent" : "High priority"} repair is unassigned`,
      description: "Assign someone to start work on this.",
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
    });
  }

  // Follow-up required flag
  if (job.followUpRequiredFlag && isActive) {
    suggestions.push({
      id: "follow-up-flag",
      level: "action",
      title: "Follow-up required",
      description: "This repair is flagged for follow-up — schedule or complete it.",
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
    (j: any) => !["completed", "invoiced", "archived"].includes(j.status)
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

  // Not linked to Holded
  if (!customer.holdedContactId && (customer.email || customer.phone)) {
    suggestions.push({
      id: "no-holded",
      level: "action",
      title: "Not synced to Holded yet",
      description: "Save the contact to create it in Holded automatically.",
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
    });
  }

  return suggestions;
}
