"use client";

import { cn } from "@/lib/utils";
import {
  FileText, Wrench, Receipt, Send, CheckCircle2, ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface WorkflowStep {
  key: "quote" | "repair" | "invoice" | "sent" | "paid";
  label: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
  detail?: string;
  href?: string;
}

interface RepairWorkflowData {
  status: string;
  invoiceStatus: string;
  holdedQuoteId?: string | null;
  holdedQuoteNum?: string | null;
  holdedInvoiceId?: string | null;
  holdedInvoiceNum?: string | null;
}

// ─── Step builder ─────────────────────────────────────────────

function buildSteps(data: RepairWorkflowData): WorkflowStep[] {
  const hasQuote = !!data.holdedQuoteId;
  const repairActive = ["in_progress", "scheduled", "in_inspection", "waiting_parts", "waiting_customer", "blocked"].includes(data.status);
  const repairDone = ["completed", "invoiced", "archived"].includes(data.status);
  const hasInvoice = !!data.holdedInvoiceId;
  const isSent = data.invoiceStatus === "sent" || data.invoiceStatus === "paid";
  const isPaid = data.invoiceStatus === "paid";

  // Determine which step is "current active"
  let activeKey: string | null = null;
  if (!hasQuote) activeKey = "quote";
  else if (!repairDone) activeKey = "repair";
  else if (!hasInvoice) activeKey = "invoice";
  else if (!isSent) activeKey = "sent";
  else if (!isPaid) activeKey = "paid";

  return [
    {
      key: "quote",
      label: "Quote",
      icon: <FileText className="h-3 w-3" />,
      done: hasQuote,
      active: activeKey === "quote",
      detail: data.holdedQuoteNum ?? undefined,
      href: data.holdedQuoteId ? "https://app.holded.com/sales/revenue" : undefined,
    },
    {
      key: "repair",
      label: "Repair",
      icon: <Wrench className="h-3 w-3" />,
      done: repairDone,
      active: activeKey === "repair" || repairActive,
      detail: repairActive ? "In progress" : repairDone ? "Done" : undefined,
    },
    {
      key: "invoice",
      label: "Invoice",
      icon: <Receipt className="h-3 w-3" />,
      done: hasInvoice,
      active: activeKey === "invoice",
      detail: data.holdedInvoiceNum ?? undefined,
      href: data.holdedInvoiceId ? "https://app.holded.com/sales/revenue" : undefined,
    },
    {
      key: "sent",
      label: "Sent",
      icon: <Send className="h-3 w-3" />,
      done: isSent,
      active: activeKey === "sent",
    },
    {
      key: "paid",
      label: "Paid",
      icon: <CheckCircle2 className="h-3 w-3" />,
      done: isPaid,
      active: activeKey === "paid",
    },
  ];
}

// ─── Full-size tracker (repair detail page) ───────────────────

interface RepairProgressTrackerProps {
  data: RepairWorkflowData;
  className?: string;
}

export function RepairProgressTracker({ data, className }: RepairProgressTrackerProps) {
  const steps = buildSteps(data);

  return (
    <div className={cn("flex items-center gap-0 rounded-xl border bg-card p-2.5 overflow-x-auto", className)}>
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <StepPill step={step} />
          {i < steps.length - 1 && (
            <div className={cn(
              "w-4 h-px mx-0.5 shrink-0",
              step.done ? "bg-emerald-400" : "bg-border",
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepPill({ step }: { step: WorkflowStep }) {
  const content = (
    <div className={cn(
      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap",
      step.done && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      step.active && !step.done && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
      !step.done && !step.active && "text-muted-foreground/50",
    )}>
      {step.done ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : step.icon}
      <span>{step.label}</span>
      {step.detail && (
        <span className={cn(
          "text-[10px] font-normal",
          step.done ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-muted-foreground/60",
        )}>
          {step.detail}
        </span>
      )}
      {step.href && step.done && (
        <ExternalLink className="h-2.5 w-2.5 opacity-40" />
      )}
    </div>
  );

  if (step.href && step.done) {
    return (
      <a href={step.href} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
}

// ─── Compact tracker (for lists, customer detail) ─────────────

interface CompactProgressTrackerProps {
  data: RepairWorkflowData;
  className?: string;
}

export function CompactProgressTracker({ data, className }: CompactProgressTrackerProps) {
  const steps = buildSteps(data);

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div
            className={cn(
              "flex items-center justify-center rounded-full transition-all",
              "h-5 w-5",
              step.done && "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
              step.active && !step.done && "bg-blue-100 text-blue-600 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-700",
              !step.done && !step.active && "bg-muted/50 text-muted-foreground/30",
            )}
            title={`${step.label}${step.detail ? ` — ${step.detail}` : ""}${step.done ? " ✓" : step.active ? " (current)" : ""}`}
          >
            {step.done ? <CheckCircle2 className="h-2.5 w-2.5" /> : step.icon}
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              "w-1.5 h-px shrink-0",
              step.done ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border",
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pipeline summary (dashboard) ─────────────────────────────

interface PipelineData {
  quote: number;
  repair: number;
  invoice: number;
  sent: number;
  paid: number;
}

export function computePipeline(
  repairs: Array<{
    status: string;
    invoiceStatus: string;
    holdedQuoteId?: string | null;
    holdedInvoiceId?: string | null;
  }>,
): PipelineData {
  const pipeline: PipelineData = { quote: 0, repair: 0, invoice: 0, sent: 0, paid: 0 };

  for (const r of repairs) {
    const hasQuote = !!r.holdedQuoteId;
    const repairDone = ["completed", "invoiced", "archived"].includes(r.status);
    const hasInvoice = !!r.holdedInvoiceId;
    const isSent = r.invoiceStatus === "sent" || r.invoiceStatus === "paid";
    const isPaid = r.invoiceStatus === "paid";

    if (isPaid) pipeline.paid++;
    else if (isSent) pipeline.sent++;
    else if (hasInvoice) pipeline.invoice++;
    else if (repairDone || ["in_progress", "scheduled", "in_inspection", "waiting_parts", "waiting_customer", "blocked"].includes(r.status)) pipeline.repair++;
    else pipeline.quote++;
  }

  return pipeline;
}

interface PipelineSummaryProps {
  repairs: Array<{
    status: string;
    invoiceStatus: string;
    holdedQuoteId?: string | null;
    holdedInvoiceId?: string | null;
  }>;
  className?: string;
}

export function PipelineSummary({ repairs, className }: PipelineSummaryProps) {
  const pipeline = computePipeline(repairs);
  const total = repairs.length;
  if (total === 0) return null;

  const segments = [
    { key: "quote", label: "Quote", count: pipeline.quote, color: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", href: "/repairs?status=new,todo,quote_needed" },
    { key: "repair", label: "Repair", count: pipeline.repair, color: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", href: "/repairs?status=in_progress" },
    { key: "invoice", label: "Invoice", count: pipeline.invoice, color: "bg-purple-500", text: "text-purple-700 dark:text-purple-400", href: "/repairs?status=completed&invoiceStatus=not_invoiced" },
    { key: "sent", label: "Sent", count: pipeline.sent, color: "bg-sky-500", text: "text-sky-700 dark:text-sky-400", href: "/repairs?invoiceStatus=sent" },
    { key: "paid", label: "Paid", count: pipeline.paid, color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", href: "/repairs?invoiceStatus=paid" },
  ];

  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Pipeline — {total} active repairs
      </p>

      {/* Progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/50 mb-3">
        {segments.map(s => s.count > 0 && (
          <div
            key={s.key}
            className={cn("transition-all", s.color)}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex items-center gap-4 flex-wrap">
        {segments.map(s => (
          <a
            key={s.key}
            href={s.href}
            className={cn("flex items-center gap-1.5 text-[11px] font-medium hover:underline", s.text)}
          >
            <span className={cn("h-2 w-2 rounded-full", s.color)} />
            {s.count} {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}
