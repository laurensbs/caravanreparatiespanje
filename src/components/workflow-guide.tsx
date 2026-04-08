"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileText, Wrench, Receipt, Send, CheckCircle2, ChevronDown, ChevronUp,
  X, ArrowRight, HelpCircle, Lightbulb, BookOpen, Play, ChevronRight,
  GraduationCap, Target, MousePointerClick,
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

// ─── Tutorial definitions ───────────────────────────────────

interface TutorialStep {
  title: string;
  description: string;
  action?: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "beginner" | "intermediate";
  pages: GuidePage[];
  steps: TutorialStep[];
}

const TUTORIALS: Tutorial[] = [
  {
    id: "first-repair",
    title: "Your first repair: from start to invoice",
    description: "Complete walkthrough: create a repair, build a cost estimate, send a quote, and create an invoice.",
    duration: "5 min",
    difficulty: "beginner",
    pages: ["dashboard", "repairs", "repair-new", "repair-detail"],
    steps: [
      {
        title: "Create a new repair",
        description: "Click '+ New Repair' in the top right corner. Fill in the customer name, unit (caravan), and a description of the problem.",
        action: "Click on 'Repairs' in the sidebar, then '+ New Repair'",
      },
      {
        title: "Add parts to the cost estimate",
        description: "In the repair detail page, scroll down to 'Cost Estimate'. Click '+ Add Line' to add parts. Select parts from the catalog — the markup is applied automatically. You can also add custom lines for labour.",
        action: "Click '+ Add Line' in the Cost Estimate section",
      },
      {
        title: "Add labour hours",
        description: "Click '+ Labour' to add work hours. The hourly rate is set in Settings → Pricing. Labour is automatically calculated based on hours × rate.",
        action: "Click '+ Labour' in the Cost Estimate section",
      },
      {
        title: "Create a quote in Holded",
        description: "In the right sidebar under 'Holded Documents', click 'Create Quote'. This sends the cost estimate to Holded as a professional quote.",
        action: "Click 'Create Quote' in the right sidebar",
      },
      {
        title: "Send the quote to the customer",
        description: "After the quote is created, PDF and Email buttons appear. Click 'Email' to send the quote directly to the customer's email address via Holded.",
        action: "Click 'Email' next to the quote",
      },
      {
        title: "Do the repair work",
        description: "Set the status to 'In Progress'. If you find extra issues during the repair, add more lines to the cost estimate — the amounts update automatically.",
        action: "Change status dropdown to 'In Progress'",
      },
      {
        title: "Create an invoice",
        description: "When the repair is done, set status to 'Completed'. Then click 'Create Invoice' in the sidebar. This converts your cost estimate into a Holded invoice.",
        action: "Click 'Create Invoice' in the right sidebar",
      },
      {
        title: "Send the invoice",
        description: "Click 'Email' next to the invoice to send it to the customer. Payment is tracked automatically — when the customer pays in Holded, the status updates here too.",
        action: "Click 'Email' next to the invoice",
      },
    ],
  },
  {
    id: "manage-customers",
    title: "Managing customers & contacts",
    description: "How customers sync with Holded, adding new contacts, and linking them to repairs.",
    duration: "3 min",
    difficulty: "beginner",
    pages: ["customers", "dashboard"],
    steps: [
      {
        title: "All customers sync from Holded",
        description: "Every 6 hours, all contacts from your Holded account are automatically synced to this system. You don't need to add them manually — they appear here automatically.",
        action: "Go to 'Contacts' in the sidebar to see all customers",
      },
      {
        title: "Add a new customer",
        description: "Click '+ New Customer' in the Contacts page. Fill in name, email, and phone. When you create a quote or invoice for this customer, they are automatically synced to Holded.",
        action: "Click '+ New Customer' on the Contacts page",
      },
      {
        title: "Link a customer to a repair",
        description: "When creating a new repair, select the customer from the dropdown. Their details (email for invoicing, address) are used automatically for quotes and invoices.",
        action: "Use the customer dropdown when creating a repair",
      },
      {
        title: "Customer email is important",
        description: "Make sure every customer has an email address — this is where quotes and invoices are sent. Without an email, you can still create documents but can't send them directly.",
        action: "Edit a customer to add their email address",
      },
    ],
  },
  {
    id: "parts-pricing",
    title: "Parts catalog & pricing strategy",
    description: "Set up your parts with cost prices and markup. The customer never sees your purchase price.",
    duration: "3 min",
    difficulty: "beginner",
    pages: ["parts", "repair-detail"],
    steps: [
      {
        title: "Add parts to the catalog",
        description: "Go to 'Parts' in the sidebar. Click '+ New Part'. Enter the name, your cost price (what you pay the supplier), and optionally a supplier and SKU number.",
        action: "Click '+ New Part' on the Parts page",
      },
      {
        title: "Set the markup percentage",
        description: "Each part can have its own markup %. If left empty, the default markup from Settings → Pricing is used. Example: cost €10 with 40% markup = selling price €14.",
        action: "Edit a part and set the 'Markup %' field",
      },
      {
        title: "Use parts in a repair estimate",
        description: "In a repair's cost estimate, click '+ Add Line' and select a part from the catalog. The selling price (cost + markup) is filled in automatically.",
        action: "Add a line to a repair's cost estimate",
      },
      {
        title: "Customer sees selling price only",
        description: "The quote and invoice always show the selling price (after markup). The customer never sees your purchase price. Your margin is fully protected.",
      },
    ],
  },
  {
    id: "holded-workflow",
    title: "How Holded integration works",
    description: "Understand the sync between this system and Holded: quotes, invoices, contacts, and payments.",
    duration: "4 min",
    difficulty: "intermediate",
    pages: ["dashboard", "repair-detail", "invoices"],
    steps: [
      {
        title: "This system talks to Holded automatically",
        description: "When you create a quote or invoice here, it's instantly created in Holded. You don't need to enter anything twice. Holded generates the official document numbers.",
      },
      {
        title: "Contacts sync both ways",
        description: "When you add a customer here, they're pushed to Holded. When a contact exists in Holded, it's pulled into this system. The sync runs automatically every 6 hours.",
      },
      {
        title: "Quotes and invoices via Holded",
        description: "Click 'Create Quote' on a repair → a Holded estimate is created. Click 'Email' → the quote is sent via Holded's email system with professional formatting and your company details.",
        action: "Try creating a quote on any repair with a cost estimate",
      },
      {
        title: "Payments sync automatically",
        description: "When a customer pays an invoice in Holded (bank transfer, iDEAL, etc.), the payment status is synced back here every 30 minutes. You never need to update it manually.",
      },
      {
        title: "Opening documents in Holded",
        description: "Every quote and invoice has an 'Open in Holded' link. Use this if you need to make manual changes in Holded. Changes to payment status sync back automatically.",
        action: "Click 'Open in Holded' on any quote or invoice",
      },
    ],
  },
  {
    id: "invoices-overview",
    title: "Tracking invoices & payments",
    description: "Use the invoices page to track what's paid, what's pending, and send reminders.",
    duration: "2 min",
    difficulty: "beginner",
    pages: ["invoices"],
    steps: [
      {
        title: "View all invoices",
        description: "The Invoices page shows all invoices from Holded. Green = paid, yellow = partially paid, red = unpaid.",
        action: "Go to 'Invoices' in the sidebar",
      },
      {
        title: "Filter by payment status",
        description: "Use the filter buttons (All / Unpaid / Partial / Paid) to quickly see which customers still need to pay.",
        action: "Click 'Unpaid' to see outstanding invoices",
      },
      {
        title: "Download PDF or email invoice",
        description: "Each invoice row has PDF and Email buttons. Download a PDF for your records, or send/resend the invoice to the customer.",
        action: "Click the PDF or Email icon on any invoice row",
      },
      {
        title: "Mark as paid manually",
        description: "If a customer pays cash or bank transfer and Holded hasn't synced yet, click the status badge to mark it as paid. This updates Holded too.",
        action: "Click the status badge on an unpaid invoice",
      },
    ],
  },
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
  quickActions?: { label: string; href: string }[];
}

function getGuideContent(page: GuidePage, context?: any): GuideContent {
  switch (page) {
    case "dashboard":
      return {
        title: "Welcome to your repair management system",
        steps: [
          "Create a new repair from the button top-right — this is your starting point.",
          "Build a cost estimate with parts + labour hours, then create a Quote in Holded.",
          "Send the quote to the customer directly from this system.",
          "When done, convert to an Invoice, send it, and payment syncs automatically from Holded.",
        ],
        tip: "This system replaces your Excel sheet. Everything follows: Quote → Repair → Invoice → Send → Paid. All synced with Holded.",
        quickActions: [
          { label: "Create Repair", href: "/repairs/new" },
          { label: "View Repairs", href: "/repairs" },
          { label: "Invoices", href: "/invoices" },
        ],
      };

    case "repairs":
      return {
        title: "Your repairs overview",
        steps: [
          "Each repair follows: Quote → Repair → Invoice → Paid.",
          "Click on any repair to see its details, add parts, create quotes & invoices.",
          "Use filters to find repairs by status — e.g. 'Completed' to see what needs invoicing.",
          "Payment updates automatically from Holded — no manual tracking needed.",
        ],
        tip: "Start a new repair top-right. The system will guide you through each step on the repair detail page.",
        activeStep: "repair",
        quickActions: [
          { label: "New Repair", href: "/repairs/new" },
          { label: "Kanban Board", href: "/repairs/board" },
        ],
      };

    case "repair-new":
      return {
        title: "Creating a new repair",
        steps: [
          "Fill in customer, unit (caravan), and description of the issue.",
          "After creating, go to the repair detail to add parts and build a cost estimate.",
          "Then create a Quote in Holded from the sidebar — you can email it directly to the customer.",
          "Once approved, start the repair work. When done, create an invoice.",
        ],
        tip: "You can always add or change parts later — the quote/invoice amounts update automatically.",
        activeStep: "quote",
      };

    case "repair-detail": {
      const job = context?.job;
      if (!job) {
        return {
          title: "Repair workflow",
          steps: [
            "1. Build cost estimate: add parts (with markup) + labour hours.",
            "2. Create Quote → sends to Holded, you can email it to the customer directly.",
            "3. Do the repair. Found extra issues? Update the estimate — amounts adjust automatically.",
            "4. Create Invoice → converts your estimate to a Holded invoice. Send it via email.",
            "5. Payment is tracked automatically from Holded — no manual work needed.",
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
            "✅ Quote was created and sent to customer.",
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
            "→ Send the invoice using the Email button in the sidebar on the right.",
            "Payment is marked automatically when the customer pays in Holded.",
          ],
          tip: "Download the PDF or email the invoice from the sidebar. Payment syncs every 30 minutes from Holded.",
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
            "→ Click 'Create Invoice' in the sidebar (right side) to generate a Holded invoice.",
            "Then send it to the customer via the Email button.",
          ],
          tip: "If you changed parts or added labour during the repair, update the estimate before creating the invoice.",
          activeStep: "invoice",
        };
      }

      if (hasQuote && !isCompleted) {
        return {
          title: "Quote sent — do the repair",
          steps: [
            "✅ Quote created and sent to the customer via Holded.",
            "→ Perform the repair work. Update status to 'In Progress' at the top of the page.",
            "Found extra problems? Add parts or labour to the cost estimate — the invoice will reflect changes.",
            "When finished, set status to 'Completed', then create the invoice from the sidebar.",
          ],
          tip: "It's normal to find extra issues. Add them to the estimate — the final invoice amount updates automatically.",
          activeStep: "repair",
        };
      }

      if (hasEstimate && !hasQuote) {
        return {
          title: "Estimate ready — create a quote",
          steps: [
            "✅ Cost estimate built with parts and/or labour.",
            "→ Click 'Create Quote' in the sidebar on the right to send it to Holded.",
            "Then click 'Email' to send the quote directly to the customer from this system.",
            "Once approved, start the repair work.",
          ],
          tip: "The quote includes your line items with markup. The customer sees the final price, not your cost price.",
          activeStep: "quote",
        };
      }

      return {
        title: "Start by building a cost estimate",
        steps: [
          "→ Add parts from your catalog using '+ Add Line' below (markup is applied automatically).",
          "→ Add labour hours with '+ Labour' (rate: €" + (context?.settings?.hourlyRate ?? "42.50") + "/hr excl. VAT).",
          "→ Optional: add a discount percentage for the customer.",
          "Then create a Quote in Holded from the sidebar and send it to the customer.",
        ],
        tip: "This replaces your Excel sheet. Parts, labour, markup, and VAT are all calculated automatically. The customer only sees the final price.",
        activeStep: "quote",
      };
    }

    case "customers":
      return {
        title: "Your contacts & customers",
        steps: [
          "All customers from Holded are automatically synced here every 6 hours.",
          "When you create a quote or invoice, the customer is synced to Holded both ways.",
          "Add email addresses so invoices and quotes can be sent directly from this system.",
          "Click on a customer to see their full repair history and linked invoices.",
        ],
        tip: "Customers sync automatically from Holded. You can also add them manually — they'll be created in Holded too.",
        quickActions: [
          { label: "New Customer", href: "/customers/new" },
        ],
      };

    case "parts":
      return {
        title: "Parts catalog & pricing",
        steps: [
          "Add parts with their cost price (what you pay the supplier).",
          "Set a markup % per part — or use the default markup from Settings → Pricing.",
          "When you add a part to a repair estimate, the selling price is calculated automatically.",
          "The customer never sees your purchase price — only the selling price after markup.",
        ],
        tip: "Your margin is protected: quotes and invoices show selling prices (cost + markup), never your purchase price.",
      };

    case "invoices":
      return {
        title: "All invoices synced from Holded",
        steps: [
          "Invoices are created from repair detail pages and synced to Holded instantly.",
          "Green = paid, yellow = partially paid, red = unpaid. Filter to find what needs attention.",
          "PDF download and email send are available per invoice — directly from this page.",
          "Payment status syncs automatically every 30 minutes from Holded.",
        ],
        tip: "When a customer pays in Holded (bank, iDEAL, etc.), the status updates here automatically. You can also mark invoices paid manually.",
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
        quickActions: [
          { label: "New Unit", href: "/units/new" },
        ],
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

// ─── Tutorial step-by-step viewer ───────────────────────────

function TutorialViewer({ tutorial, onClose }: { tutorial: Tutorial; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = tutorial.steps[currentStep];
  const isLast = currentStep === tutorial.steps.length - 1;
  const isFirst = currentStep === 0;

  const completeTutorial = useCallback(() => {
    try {
      const stored = localStorage.getItem("tutorials-completed");
      const completed = stored ? JSON.parse(stored) : [];
      if (!completed.includes(tutorial.id)) {
        completed.push(tutorial.id);
        localStorage.setItem("tutorials-completed", JSON.stringify(completed));
      }
    } catch {}
    onClose();
  }, [tutorial.id, onClose]);

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
            <GraduationCap className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            {tutorial.title}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex gap-1">
          {tutorial.steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentStep ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-800",
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
          Step {currentStep + 1} of {tutorial.steps.length}
        </p>
      </div>

      <div className="px-4 pb-3 border-t border-emerald-100 dark:border-emerald-900/40 pt-2.5">
        <div className="flex items-start gap-2 mb-2">
          <Target className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-[12px] font-semibold text-emerald-900 dark:text-emerald-200">{step.title}</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed mt-1">{step.description}</p>
          </div>
        </div>

        {step.action && (
          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/30 mb-3">
            <MousePointerClick className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed font-medium">
              {step.action}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-emerald-600"
            disabled={isFirst}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            ← Previous
          </Button>
          {isLast ? (
            <Button
              size="sm"
              className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={completeTutorial}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Button>
          ) : (
            <Button
              size="sm"
              className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Next →
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tutorial list ──────────────────────────────────────────

function TutorialList({ page, onSelectTutorial, onClose }: {
  page: GuidePage;
  onSelectTutorial: (tutorial: Tutorial) => void;
  onClose: () => void;
}) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tutorials-completed");
      if (stored) setCompletedIds(JSON.parse(stored));
    } catch {}
  }, []);

  const relevant = TUTORIALS.filter(t => t.pages.includes(page));
  const others = TUTORIALS.filter(t => !t.pages.includes(page));
  const allTutorials = [...relevant, ...others];

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/40">
            <BookOpen className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Tutorials — Learn step by step
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="px-4 pb-3 border-t border-amber-100 dark:border-amber-900/40 pt-2.5 space-y-2">
        {allTutorials.map((tutorial) => {
          const isCompleted = completedIds.includes(tutorial.id);
          const isRelevant = relevant.includes(tutorial);
          return (
            <button
              key={tutorial.id}
              onClick={() => onSelectTutorial(tutorial)}
              className={cn(
                "w-full text-left rounded-lg px-3 py-2.5 transition-colors border",
                isCompleted
                  ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-800/50"
                  : isRelevant
                    ? "bg-white dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                    : "bg-white/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-900/20",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className={cn(
                    "text-[12px] font-medium",
                    isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-amber-900 dark:text-amber-200",
                  )}>
                    {tutorial.title}
                  </span>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center gap-3 mt-1 pl-5">
                <span className="text-[10px] text-muted-foreground">{tutorial.duration}</span>
                <span className="text-[10px] text-muted-foreground">{tutorial.steps.length} steps</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  tutorial.difficulty === "beginner"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                )}>
                  {tutorial.difficulty}
                </span>
                {isRelevant && !isCompleted && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    relevant for this page
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

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
  const [showTutorials, setShowTutorials] = useState(false);
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);

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

  if (activeTutorial) {
    return (
      <TutorialViewer
        tutorial={activeTutorial}
        onClose={() => {
          setActiveTutorial(null);
          setShowTutorials(false);
        }}
      />
    );
  }

  if (showTutorials) {
    return (
      <TutorialList
        page={page}
        onSelectTutorial={setActiveTutorial}
        onClose={() => setShowTutorials(false)}
      />
    );
  }

  const guide = getGuideContent(page, context);
  const activeStepIndex = guide.activeStep ? STEPS.findIndex(s => s.key === guide.activeStep) : -1;

  if (dismissed) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <button
          type="button"
          onClick={handleRestore}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3 w-3" />
          Show guide
        </button>
        <span className="text-muted-foreground/30">·</span>
        <button
          type="button"
          onClick={() => { setDismissed(false); setShowTutorials(true); }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Tutorials
        </button>
      </div>
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
              size="sm"
              className="h-5 text-[10px] px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
              onClick={() => setShowTutorials(true)}
            >
              <BookOpen className="h-3 w-3 mr-1" />
              Tutorials
            </Button>
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

          <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30 mb-2.5">
            <Lightbulb className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
            <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
              {guide.tip}
            </p>
          </div>

          {/* Quick actions */}
          {guide.quickActions && guide.quickActions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {guide.quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <ArrowRight className="h-2.5 w-2.5" />
                  {action.label}
                </Link>
              ))}
            </div>
          )}

          {/* Relevant tutorials */}
          {(() => {
            const relevantTutorials = TUTORIALS.filter(t => t.pages.includes(page));
            if (relevantTutorials.length === 0) return null;
            return (
              <div className="mt-2.5 pt-2.5 border-t border-blue-100 dark:border-blue-900/40">
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
                  Tutorials for this page
                </p>
                <div className="space-y-1">
                  {relevantTutorials.map((tutorial) => (
                    <button
                      key={tutorial.id}
                      onClick={() => setActiveTutorial(tutorial)}
                      className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Play className="h-3 w-3 text-blue-500 shrink-0" />
                      <span className="text-[11px] text-blue-700 dark:text-blue-300">{tutorial.title}</span>
                      <span className="text-[10px] text-blue-400 ml-auto shrink-0">{tutorial.duration}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
