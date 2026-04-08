"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FileText, Wrench, Receipt, Send, CheckCircle2, ChevronDown, ChevronUp,
  X, ArrowRight, HelpCircle, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ─── Workflow steps ──────────────────────────────────────────

export type WorkflowStep = "quote" | "repair" | "invoice" | "send" | "paid";

const STEPS: { key: WorkflowStep; label: string; icon: React.ReactNode; color: string; activeColor: string }[] = [
  { key: "quote", label: "Quote", icon: <FileText className="h-3.5 w-3.5" />, color: "text-muted-foreground", activeColor: "text-blue-600 dark:text-blue-400" },
  { key: "repair", label: "Repair", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-muted-foreground", activeColor: "text-amber-600 dark:text-amber-400" },
  { key: "invoice", label: "Invoice", icon: <Receipt className="h-3.5 w-3.5" />, color: "text-muted-foreground", activeColor: "text-purple-600 dark:text-purple-400" },
  { key: "send", label: "Send", icon: <Send className="h-3.5 w-3.5" />, color: "text-muted-foreground", activeColor: "text-sky-600 dark:text-sky-400" },
  { key: "paid", label: "Paid", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-muted-foreground", activeColor: "text-emerald-600 dark:text-emerald-400" },
];

// ─── Page-specific content ──────────────────────────────────

export type GuidePage =
  | "dashboard"
  | "repairs"
  | "repair-detail"
  | "repair-new"
  | "customers"
  | "parts"
  | "invoices"
  | "units";

interface GuideContent {
  title: string;
  steps: string[];
  tip: string;
  activeStep?: WorkflowStep;
}

function getGuideContent(page: GuidePage, context?: any): GuideContent {
  switch (page) {
    case "dashboard":
      return {
        title: "Welcome to your repair management system",
        steps: [
          "Create a new repair from the button top-right — this is your starting point.",
          "Build a cost estimate with parts + labour hours, then create a Quote in Holded.",
          "Send the quote to the customer. Once approved, start the repair.",
          "When done, convert the quote to an Invoice, send it, and payment is tracked automatically.",
        ],
        tip: "This system follows the same flow you know from Holded: Quote → Repair → Invoice → Send. Everything syncs automatically.",
      };

    case "repairs":
      return {
        title: "Your repairs overview",
        steps: [
          "Each repair follows: Quote → Repair → Invoice → Paid.",
          "Click on any repair to see its details, add parts, create quotes & invoices.",
          "Use filters to find repairs by status — e.g. 'Completed' to see what needs invoicing.",
          "Repairs update automatically when invoices are paid in Holded.",
        ],
        tip: "Start a new repair top-right. The system guides you through each step.",
        activeStep: "repair",
      };

    case "repair-new":
      return {
        title: "Creating a new repair",
        steps: [
          "Fill in customer, unit (caravan), and description of the issue.",
          "After creating, go to the repair detail to add parts and build a cost estimate.",
          "Then create a Quote in Holded from the sidebar — this sends a professional quote to the customer.",
          "Once the customer approves, start the repair work.",
        ],
        tip: "You can always add or change parts later during the repair — the quote/invoice can be updated.",
        activeStep: "quote",
      };

    case "repair-detail": {
      // Context-aware based on the repair's state
      const job = context?.job;
      if (!job) {
        return {
          title: "Repair workflow",
          steps: [
            "1. Build cost estimate: add parts (with markup) + labour hours.",
            "2. Create Quote → sends to Holded, you can email it to the customer.",
            "3. Do the repair. Found extra issues? Update the lines, amounts adjust automatically.",
            "4. Create Invoice → converts your estimate to a Holded invoice. Send it.",
            "5. Payment is tracked automatically from Holded.",
          ],
          tip: "Everything happens from this page. Use the sidebar on the right for Quote, Invoice, and Send actions.",
          activeStep: "quote",
        };
      }

      const hasQuote = !!job.holdedQuoteId;
      const hasInvoice = !!job.holdedInvoiceId;
      const isPaid = job.invoiceStatus === "paid";
      const isCompleted = ["completed", "invoiced"].includes(job.status);
      const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);

      if (isPaid) {
        return {
          title: "This repair is fully completed and paid",
          steps: [
            "✅ Quote was sent to customer.",
            "✅ Repair work completed.",
            "✅ Invoice created and sent.",
            "✅ Payment received — automatically synced from Holded.",
          ],
          tip: "Nothing more to do here. You can review the history in the timeline below.",
          activeStep: "paid",
        };
      }

      if (hasInvoice) {
        return {
          title: "Invoice created — waiting for payment",
          steps: [
            "✅ Quote sent and approved.",
            "✅ Repair work completed.",
            "✅ Invoice created in Holded.",
            "→ Send the invoice using the Email button in the sidebar.",
            "Payment will be marked automatically when the customer pays via Holded.",
          ],
          tip: "You can download the PDF or send the invoice again from the sidebar. Payment syncs automatically.",
          activeStep: "send",
        };
      }

      if (isCompleted && !hasInvoice) {
        return {
          title: "Repair done — time to invoice",
          steps: [
            "✅ Quote sent to customer.",
            "✅ Repair work completed.",
            "→ Review the cost estimate. Found extra issues? Update the lines now.",
            "→ Click 'Create Invoice' in the sidebar to generate a Holded invoice.",
            "Then send it to the customer.",
          ],
          tip: "If you changed parts or added labour during the repair, update the estimate before creating the invoice.",
          activeStep: "invoice",
        };
      }

      if (hasQuote && !isCompleted) {
        return {
          title: "Quote sent — do the repair",
          steps: [
            "✅ Quote created and sent via Holded.",
            "→ Perform the repair work. Update status to 'In Progress'.",
            "Found extra problems? Add parts or labour lines to the cost estimate — the invoice will reflect changes.",
            "When finished, set status to 'Completed', then create the invoice.",
          ],
          tip: "It's normal to find extra issues during a repair. Just add them to the estimate — the invoice amount updates automatically.",
          activeStep: "repair",
        };
      }

      if (hasEstimate && !hasQuote) {
        return {
          title: "Estimate ready — create a quote",
          steps: [
            "✅ Cost estimate built with parts and/or labour.",
            "→ Click 'Create Quote' in the sidebar to send it to Holded.",
            "The quote will be emailed to the customer for approval.",
            "Once approved, start the repair work.",
          ],
          tip: "The quote includes all your line items with markup. The customer sees the final price, not your cost price.",
          activeStep: "quote",
        };
      }

      return {
        title: "Start by building a cost estimate",
        steps: [
          "→ Add parts from your catalog (markup is applied automatically).",
          "→ Add labour hours (rate: €" + (context?.settings?.hourlyRate ?? "42.50") + "/hr excl. VAT).",
          "→ Optional: add a discount percentage.",
          "Then create a Quote in Holded from the sidebar and send it to the customer.",
        ],
        tip: "This replaces your Excel sheet. Parts, labour, markup, and VAT are all calculated automatically.",
        activeStep: "quote",
      };
    }

    case "customers":
      return {
        title: "Your contacts & customers",
        steps: [
          "Every repair needs a linked customer for quotes and invoices.",
          "When you create an invoice, the customer is auto-synced to Holded.",
          "Add email addresses so invoices and quotes can be sent directly.",
          "Suppliers from Holded appear under the 'Businesses' tab.",
        ],
        tip: "Customers are created automatically when you link them to a repair. You can also add them manually here.",
      };

    case "parts":
      return {
        title: "Parts catalog & pricing",
        steps: [
          "Add parts with their cost price from the supplier.",
          "Set a markup % per part (or use the default from Settings → Pricing).",
          "When you add a part to a repair estimate, the selling price is calculated automatically.",
          "Part requests from repairs show up in the 'Part Requests' tab.",
        ],
        tip: "Your margin is protected: customers see the selling price (cost + markup), never your purchase price.",
      };

    case "invoices":
      return {
        title: "All invoices from Holded",
        steps: [
          "Invoices are created from repair detail pages and synced to Holded.",
          "Click 'Unpaid' to mark an invoice as paid — this updates Holded automatically.",
          "Use filters to find unpaid invoices, filter by date, or search by customer.",
          "PDF download and email send are available per invoice.",
        ],
        tip: "Payment status syncs automatically from Holded. When a customer pays, it updates here too.",
        activeStep: "paid",
      };

    case "units":
      return {
        title: "Caravans & units",
        steps: [
          "Register each caravan/unit with brand, model, and registration number.",
          "Link units to repairs to track the full service history per vehicle.",
          "When creating a repair, select the customer's unit to auto-fill details.",
        ],
        tip: "One unit can have multiple repairs over time — the full history is visible on the unit page.",
      };

    default:
      return {
        title: "How this system works",
        steps: [
          "Quote → Repair → Invoice → Send → Paid — that's the flow.",
          "Everything syncs with Holded automatically.",
        ],
        tip: "Click on any repair to see the full workflow.",
      };
  }
}

// ─── Component ──────────────────────────────────────────────

interface WorkflowGuideProps {
  page: GuidePage;
  context?: any;
  className?: string;
  defaultExpanded?: boolean;
}

const STORAGE_KEY = "workflow-guide-dismissed";

export function WorkflowGuide({ page, context, className, defaultExpanded = false }: WorkflowGuideProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[page]) setDismissed(true);
      }
    } catch {}
  }, [page]);

  function handleDismiss() {
    setDismissed(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[page] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }

  function handleRestore() {
    setDismissed(false);
    setExpanded(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      delete parsed[page];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch {}
  }

  const guide = getGuideContent(page, context);
  const activeStepIndex = guide.activeStep ? STEPS.findIndex(s => s.key === guide.activeStep) : -1;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={handleRestore}
        className={cn(
          "flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors",
          className,
        )}
      >
        <HelpCircle className="h-3 w-3" />
        Show guide
      </button>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 overflow-hidden transition-all",
        className,
      )}
    >
      {/* Header with workflow steps */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40">
              <Lightbulb className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
              {guide.title}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Workflow progress bar */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isActive = i === activeStepIndex;
            const isCompleted = activeStepIndex >= 0 && i < activeStepIndex;
            const isFuture = activeStepIndex >= 0 && i > activeStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all",
                    isActive && "bg-white dark:bg-blue-900/60 shadow-sm border border-blue-200 dark:border-blue-700",
                    isCompleted && "text-emerald-600 dark:text-emerald-400",
                    isFuture && "text-muted-foreground/50",
                    !isActive && !isCompleted && !isFuture && step.color,
                    isActive && step.activeColor,
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={cn(
                    "h-2.5 w-2.5 mx-0.5 shrink-0",
                    isCompleted ? "text-emerald-400" : "text-muted-foreground/30",
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-blue-100 dark:border-blue-900/40 mt-1 pt-2.5">
          <div className="space-y-1.5 mb-2.5">
            {guide.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-blue-800 dark:text-blue-300 leading-relaxed">
                <span className="mt-0.5 shrink-0 w-4 text-center text-blue-400 dark:text-blue-600 font-bold text-[10px]">
                  {step.startsWith("✅") || step.startsWith("→") ? "" : `${i + 1}.`}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
            <Lightbulb className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              {guide.tip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
