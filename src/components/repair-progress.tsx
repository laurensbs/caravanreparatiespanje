"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  FileText, Wrench, Receipt, CheckCircle2, ExternalLink,
  BanknoteIcon, XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

type StepKey = "quote" | "repair" | "invoice" | "paid";

interface WorkflowStep {
  key: StepKey;
  label: string;
  icon: React.ReactNode;
  done: boolean;
  active: boolean;
  rejected?: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────

const ACTIVE_STATUSES = ["in_progress", "scheduled", "in_inspection", "waiting_parts", "waiting_customer", "blocked"];
const DONE_STATUSES = ["completed", "invoiced", "archived"];

// ─── Step builder (4 steps: Quote → Repair → Invoice → Paid) ─

function buildSteps(data: RepairWorkflowData): WorkflowStep[] {
  const isRejected = data.status === "rejected" || data.invoiceStatus === "rejected";
  const hasQuote = !!data.holdedQuoteId;
  const repairActive = ACTIVE_STATUSES.includes(data.status);
  const repairDone = DONE_STATUSES.includes(data.status);
  const hasInvoice = !!data.holdedInvoiceId;
  const invoiced = hasInvoice || data.invoiceStatus === "sent" || data.invoiceStatus === "paid";
  const isPaid = data.invoiceStatus === "paid";

  // Determine current active step
  let activeKey: StepKey | null = null;
  if (!isRejected) {
    if (!hasQuote && !repairActive && !repairDone) activeKey = "quote";
    else if (!repairDone) activeKey = "repair";
    else if (!invoiced) activeKey = "invoice";
    else if (!isPaid) activeKey = "paid";
  }

  const invoiceDetail = data.holdedInvoiceNum
    ? data.holdedInvoiceNum
    : data.invoiceStatus === "sent"
    ? "Sent"
    : undefined;

  return [
    {
      key: "quote",
      label: "Quote",
      icon: <FileText className="h-3 w-3" />,
      done: hasQuote,
      active: activeKey === "quote",
      detail: data.holdedQuoteNum ?? undefined,
      href: data.holdedQuoteId ? `/api/holded/pdf?type=estimate&id=${data.holdedQuoteId}` : undefined,
    },
    {
      key: "repair",
      label: "Repair",
      icon: <Wrench className="h-3 w-3" />,
      done: repairDone && !isRejected,
      active: !isRejected && (activeKey === "repair" || repairActive),
      rejected: isRejected,
      detail: isRejected ? "Rejected" : repairActive ? "In progress" : repairDone ? "Done" : undefined,
    },
    {
      key: "invoice",
      label: "Invoice",
      icon: <Receipt className="h-3 w-3" />,
      done: invoiced,
      active: activeKey === "invoice",
      detail: invoiceDetail,
      href: data.holdedInvoiceId ? `/api/holded/pdf?type=invoice&id=${data.holdedInvoiceId}` : undefined,
    },
    {
      key: "paid",
      label: "Paid",
      icon: <BanknoteIcon className="h-3 w-3" />,
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
      step.rejected && "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
      step.done && !step.rejected && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
      step.active && !step.done && !step.rejected && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
      !step.done && !step.active && !step.rejected && "text-muted-foreground/50",
    )}>
      {step.rejected ? <XCircle className="h-3 w-3 text-rose-500" /> : step.done ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : step.icon}
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
              step.rejected && "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
              step.done && !step.rejected && "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
              step.active && !step.done && !step.rejected && "bg-blue-100 text-blue-600 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-700",
              !step.done && !step.active && !step.rejected && "bg-muted/50 text-muted-foreground/30",
            )}
            title={`${step.label}${step.detail ? ` — ${step.detail}` : ""}${step.done ? " ✓" : step.rejected ? " ✗" : step.active ? " (current)" : ""}`}
          >
            {step.rejected ? <XCircle className="h-2.5 w-2.5" /> : step.done ? <CheckCircle2 className="h-2.5 w-2.5" /> : step.icon}
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
  backlog: number;
  active: number;
  done: number;
  invoiced: number;
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
  const pipeline: PipelineData = { backlog: 0, active: 0, done: 0, invoiced: 0, paid: 0 };

  for (const r of repairs) {
    const isPaid = r.invoiceStatus === "paid";
    const hasInvoice = !!r.holdedInvoiceId || r.invoiceStatus === "sent";
    const repairDone = DONE_STATUSES.includes(r.status);
    const repairActive = ACTIVE_STATUSES.includes(r.status);

    if (isPaid) pipeline.paid++;
    else if (hasInvoice) pipeline.invoiced++;
    else if (repairDone) pipeline.done++;
    else if (repairActive) pipeline.active++;
    else pipeline.backlog++;
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

const PIPELINE_SEGMENTS = [
  {
    key: "backlog",
    label: "backlog",
    href: "/repairs?status=new,todo,quote_needed,waiting_approval",
  },
  {
    key: "active",
    label: "active",
    href: "/repairs?status=in_progress,scheduled,in_inspection,waiting_parts,waiting_customer,blocked",
  },
  {
    key: "done",
    label: "done",
    href: "/repairs?status=completed&invoiceStatus=not_invoiced",
  },
  {
    key: "invoiced",
    label: "invoiced",
    href: "/repairs?invoiceStatus=sent",
  },
  {
    key: "paid",
    label: "paid",
    href: "/repairs?invoiceStatus=paid",
  },
] as const;

export function PipelineSummary({ repairs, className }: PipelineSummaryProps) {
  const pipeline = computePipeline(repairs);
  const total = repairs.length;
  if (total === 0) return null;

  const counts: Record<string, number> = {
    backlog: pipeline.backlog,
    active: pipeline.active,
    done: pipeline.done,
    invoiced: pipeline.invoiced,
    paid: pipeline.paid,
  };

  // Progress = everything past backlog
  const progressPercent = total > 0
    ? Math.round(((counts.active + counts.done + counts.invoiced + counts.paid) / total) * 100)
    : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Thin progress bar */}
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#0CC0DF] transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Summary text */}
      <p className="text-xs text-gray-500">
        {PIPELINE_SEGMENTS.map((s, i) => (
          <span key={s.key}>
            {i > 0 && <span className="mx-1.5">·</span>}
            <Link href={s.href} className="hover:text-gray-900 transition-colors">
              {counts[s.key]} {s.label}
            </Link>
          </span>
        ))}
      </p>
    </div>
  );
}
