"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileText, Wrench, Receipt, Send, CheckCircle2, ChevronDown, ChevronUp,
  X, ArrowRight, Lightbulb, BookOpen, Play, ChevronRight,
  MousePointerClick, Sparkles,
} from "lucide-react";
import Link from "next/link";

// ─── Workflow steps ──────────────────────────────────────────

export type WorkflowStep = "estimate" | "quote" | "work" | "invoice" | "paid";

const STEPS: { key: WorkflowStep; label: string; icon: React.ReactNode }[] = [
  { key: "estimate", label: "Estimate", icon: <FileText className="h-3.5 w-3.5" /> },
  { key: "quote", label: "Quote", icon: <Send className="h-3.5 w-3.5" /> },
  { key: "work", label: "Work", icon: <Wrench className="h-3.5 w-3.5" /> },
  { key: "invoice", label: "Invoice", icon: <Receipt className="h-3.5 w-3.5" /> },
  { key: "paid", label: "Paid", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
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
    id: "first-work-order",
    title: "Your first work order",
    description: "Create a work order, build a cost estimate, send a quote, and invoice — end to end.",
    duration: "5 min",
    difficulty: "beginner",
    pages: ["dashboard", "repairs", "repair-new", "repair-detail"],
    steps: [
      {
        title: "Create a new work order",
        description: "Click '+ New Work Order' in the top-right corner. Choose the type (Repair, Wax Treatment, Maintenance, or Inspection), select a customer, pick a unit, and describe the job.",
        action: "Click '+ New Work Order' → fill in the form → Create",
      },
      {
        title: "Add tags to categorise",
        description: "On the work order detail page, click the '+' in the status bar to open the tag picker. Select existing tags or create new ones with a custom name and colour.",
        action: "Click '+' next to the status badges",
      },
      {
        title: "Build the cost estimate",
        description: "Scroll to 'Cost Estimate'. Click '+ Add Line' to add parts from the catalog — markup is applied automatically. Use category tabs to filter parts (Tyres, Lights, Seals, etc.).",
        action: "Click '+ Add Line' in the Cost Estimate section",
      },
      {
        title: "Add labour hours",
        description: "Click '+ Labour' to add work hours. The hourly rate comes from Settings → Pricing and is calculated automatically.",
        action: "Click '+ Labour' in the Cost Estimate section",
      },
      {
        title: "Create a quote via Holded",
        description: "In the right sidebar under 'Holded Documents', click 'Create Quote'. This sends your cost estimate to Holded as a professional quote with your company branding.",
        action: "Click 'Create Quote' in the sidebar",
      },
      {
        title: "Email the quote to the customer",
        description: "After the quote is created, PDF and Email buttons appear. Click 'Email' to send the quote directly to the customer via Holded.",
        action: "Click 'Email' next to the quote",
      },
      {
        title: "Do the work",
        description: "Set the status to 'In Progress'. If you discover extra issues, add more lines to the cost estimate — amounts update automatically.",
        action: "Change status to 'In Progress'",
      },
      {
        title: "Create an invoice",
        description: "When done, set status to 'Completed'. Click 'Create Invoice' in the sidebar — converts your estimate to a Holded invoice.",
        action: "Click 'Create Invoice' in the sidebar",
      },
      {
        title: "Send the invoice and track payment",
        description: "Click 'Email' to send the invoice. Payment is tracked automatically — when paid in Holded, the status updates here within 30 minutes.",
        action: "Click 'Email' next to the invoice",
      },
    ],
  },
  {
    id: "work-order-types",
    title: "Work order types explained",
    description: "Understand the four types: Repair, Wax Treatment, Maintenance, and Inspection.",
    duration: "3 min",
    difficulty: "beginner",
    pages: ["dashboard", "repairs", "repair-new"],
    steps: [
      {
        title: "Repair — standard damage fix",
        description: "The default type. Use for any damage repair: water damage, structural issues, bodywork, etc. Follows the full workflow: estimate → quote → work → invoice → paid.",
        action: "Select 'Repair' when creating a new work order",
      },
      {
        title: "Wax Treatment — auto-generated tasks",
        description: "Select 'Wax Treatment' to create a wax job. The system automatically adds pre-configured wax tasks to save setup time. Great for seasonal caravan care.",
        action: "Select 'Wax Treatment' — tasks auto-populate",
      },
      {
        title: "Maintenance — regular service",
        description: "For scheduled maintenance: annual checkups, seal replacements, general servicing. Same workflow as repairs, but categorised separately for clear tracking.",
        action: "Select 'Maintenance' for service jobs",
      },
      {
        title: "Inspection — pre-sale or insurance",
        description: "For inspection-only work: pre-sale checks, insurance assessments, condition reports. Tag with 'Pre-Sale Inspection' or custom tags for easy filtering.",
        action: "Select 'Inspection' for assessment jobs",
      },
      {
        title: "Filter by type",
        description: "On the work orders overview, use the 'Type' filter to show only specific types. Each type has a colour-coded badge for quick identification. Combine with status and tag filters.",
        action: "Use the Type filter on the Work Orders page",
      },
    ],
  },
  {
    id: "garage-connection",
    title: "How the garage portal works",
    description: "How technicians use the garage view, and how it connects to the office.",
    duration: "4 min",
    difficulty: "beginner",
    pages: ["dashboard", "repairs", "repair-detail"],
    steps: [
      {
        title: "What technicians see",
        description: "The garage portal (/garage) is a mobile-optimised view. Technicians see today's assigned work orders with tasks, findings, and part requests — focused on doing the work.",
        action: "Visit /garage to see the technician view",
      },
      {
        title: "Tasks flow from office to garage",
        description: "When you create a work order and assign tasks, they appear in the garage. Technicians check off tasks as they complete them. For wax jobs, tasks are pre-populated automatically.",
      },
      {
        title: "Findings flow from garage to office",
        description: "Technicians report findings during work: unexpected damage, extra issues, things needing approval. Each finding has a category, severity, and approval flag. You see these immediately in the office.",
        action: "Tap '+ Finding' in the garage to report an issue",
      },
      {
        title: "Part requests with categories",
        description: "Technicians request parts by category (Tyres, Lights, Seals, etc.). Category chips appear instantly for quick selection. The office sees requests immediately and can action them.",
        action: "Tap '+ Request Part' → select category → type part name",
      },
      {
        title: "Real-time sync",
        description: "Everything syncs in real time. When the office adds a task, the garage sees it. When the garage reports a finding, the office sees it. No refresh needed.",
      },
    ],
  },
  {
    id: "manage-customers",
    title: "Managing customers & contacts",
    description: "How customers sync with Holded, adding new contacts, and linking them to work orders.",
    duration: "3 min",
    difficulty: "beginner",
    pages: ["customers", "dashboard"],
    steps: [
      {
        title: "Customers sync from Holded",
        description: "Every 6 hours, all contacts from your Holded account sync here automatically. You don't need to add them manually — they appear here automatically.",
        action: "Go to 'Contacts' in the sidebar",
      },
      {
        title: "Add a new customer",
        description: "Click '+ New Customer' on the Contacts page. Fill in name, email, and phone. When you create a quote or invoice for them, they're automatically synced to Holded.",
        action: "Click '+ New Customer'",
      },
      {
        title: "Link to a work order",
        description: "When creating a work order, select the customer from the dropdown. Their email is used for sending quotes and invoices via Holded.",
        action: "Use the customer dropdown when creating a work order",
      },
      {
        title: "Email is essential",
        description: "Make sure every customer has an email address — it's required for sending quotes and invoices. Without email, you can still create documents but can't email them.",
        action: "Edit a customer to add their email",
      },
    ],
  },
  {
    id: "parts-pricing",
    title: "Parts catalog & pricing",
    description: "Set up parts with cost prices, markup, and categories. Customers never see your purchase price.",
    duration: "3 min",
    difficulty: "beginner",
    pages: ["parts", "repair-detail"],
    steps: [
      {
        title: "Add parts to the catalog",
        description: "Go to 'Parts' in the sidebar. Click '+ New Part'. Enter the name, cost price (what you pay), and optionally supplier and SKU number.",
        action: "Click '+ New Part' on the Parts page",
      },
      {
        title: "Organise with categories",
        description: "Parts are grouped by categories (Lights, Tyres, Seals, etc.). Use filter tabs to browse by category. Add new categories directly from the filter bar.",
        action: "Click '+ Add Category' on the Parts page",
      },
      {
        title: "Set markup percentage",
        description: "Each part can have its own markup %. If left empty, the default from Settings → Pricing is used. Example: cost €10, markup 40% = selling price €14.",
        action: "Edit a part to set 'Markup %'",
      },
      {
        title: "Use in cost estimates",
        description: "In any work order's cost estimate, click '+ Add Line' → select a part from the catalog. Category tabs help filter quickly. The selling price fills automatically.",
        action: "Add a line to a cost estimate",
      },
      {
        title: "Protected margins",
        description: "Quotes and invoices always show selling prices (cost + markup). The customer never sees your cost price — your margin is fully protected.",
      },
    ],
  },
  {
    id: "tags-filters",
    title: "Tags, filters & finding things",
    description: "Organise with tags, use the 2-layer filter system, and find anything fast.",
    duration: "2 min",
    difficulty: "beginner",
    pages: ["repairs", "repair-detail"],
    steps: [
      {
        title: "Assign tags to work orders",
        description: "On any work order, click '+' in the status bar to open the tag picker. Tags help categorise: 'Warranty', 'Insurance', 'Pre-Sale', or custom labels.",
        action: "Click '+' next to the status badges",
      },
      {
        title: "Create tags on the fly",
        description: "In the tag picker, click 'New tag…' at the bottom. Type a name, pick a colour, click Create. Instantly available everywhere.",
        action: "Click 'New tag…' in the dropdown",
      },
      {
        title: "Quick filters (always visible)",
        description: "The top bar always shows: search, status filter, type filter, and a 'Filters' button for more options. These handle 90% of daily filtering.",
        action: "Use the quick filter bar on Work Orders page",
      },
      {
        title: "Advanced filters (popover panel)",
        description: "Click the 'Filters' button to open the advanced panel: priority, location, invoice status, response time, tags, and date range. Active filters show as removable pills.",
        action: "Click 'Filters' → set advanced options",
      },
    ],
  },
  {
    id: "holded-integration",
    title: "How Holded integration works",
    description: "Quotes, invoices, contacts, and payments — all synced with Holded automatically.",
    duration: "4 min",
    difficulty: "intermediate",
    pages: ["dashboard", "repair-detail", "invoices"],
    steps: [
      {
        title: "Instant quote & invoice creation",
        description: "When you click 'Create Quote' or 'Create Invoice' on a work order, it's instantly created in Holded with your company details and branding. No double entry.",
      },
      {
        title: "Contacts sync both ways",
        description: "Add a customer here → pushed to Holded. Customer exists in Holded → pulled here. Automatic sync every 6 hours. One source of truth.",
      },
      {
        title: "Email via Holded",
        description: "Click 'Email' on a quote or invoice → sent via Holded's email system with professional formatting. PDF download is also available for manual sending.",
        action: "Click 'Email' on any quote or invoice",
      },
      {
        title: "Automatic payment tracking",
        description: "When a customer pays (bank transfer, iDEAL, etc.), Holded marks it paid. Every 30 minutes, payment status syncs here. No manual tracking.",
      },
      {
        title: "Open in Holded anytime",
        description: "Every document has an 'Open in Holded' link for the full accounting view, PDF layout, or manual edits. Changes sync back automatically.",
        action: "Click 'Open in Holded' on any document",
      },
    ],
  },
  {
    id: "invoices-payments",
    title: "Tracking invoices & payments",
    description: "Monitor payment status, send reminders, and mark invoices as paid.",
    duration: "2 min",
    difficulty: "beginner",
    pages: ["invoices"],
    steps: [
      {
        title: "View all invoices",
        description: "The Invoices page shows all invoices from Holded. Green = paid, yellow = partial, red = unpaid. Filter by status to see what needs attention.",
        action: "Go to 'Invoices' in the sidebar",
      },
      {
        title: "Filter by payment status",
        description: "Use the status buttons (All / Unpaid / Partial / Paid) for a quick overview of outstanding amounts.",
        action: "Click 'Unpaid' to see what's due",
      },
      {
        title: "Download or email invoices",
        description: "Each invoice has PDF and Email buttons. Download for your records or resend to customers who haven't received it.",
        action: "Click PDF or Email on any invoice row",
      },
      {
        title: "Mark as paid manually",
        description: "Customer paid cash? Click the red 'Unpaid' badge to mark it paid immediately. Updates both this system and Holded.",
        action: "Click the status badge on an unpaid invoice",
      },
    ],
  },
  {
    id: "wax-workflow",
    title: "Wax treatment workflow",
    description: "How wax jobs work with auto-generated tasks and streamlined processing.",
    duration: "2 min",
    difficulty: "beginner",
    pages: ["repairs", "repair-new", "repair-detail"],
    steps: [
      {
        title: "Create a wax work order",
        description: "Click '+ New Work Order' and select 'Wax Treatment' as the type. Fill in the customer and unit as normal.",
        action: "Select 'Wax Treatment' in the new work order form",
      },
      {
        title: "Auto-generated tasks",
        description: "When a wax job is created, standard wax tasks are added automatically — cleaning, preparation, wax application, buffing, inspection. No manual setup needed.",
      },
      {
        title: "Garage technicians follow the tasks",
        description: "In the garage portal, technicians see the pre-populated task list. They check off each step as completed. Findings can still be reported if issues arise.",
      },
      {
        title: "Invoice the standard wax price",
        description: "Build a cost estimate (or use a standard wax price), create the invoice via Holded, and send it. Same workflow as any other work order.",
        action: "Create Invoice → Email to customer",
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
  | "quotes"
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
        title: "Your work order management hub",
        steps: [
          "Create a new work order — choose the type: Repair, Wax, Maintenance, or Inspection.",
          "Build a cost estimate with parts (auto-markup) + labour hours.",
          "Send a quote to the customer via Holded, then do the work.",
          "Create an invoice when done — payment syncs automatically from Holded.",
        ],
        tip: "Everything follows: Estimate → Quote → Work → Invoice → Paid. All synced with Holded in real time.",
        quickActions: [
          { label: "New Work Order", href: "/repairs/new" },
          { label: "Work Orders", href: "/repairs" },
          { label: "Invoices", href: "/invoices" },
        ],
      };

    case "repairs":
      return {
        title: "All work orders",
        steps: [
          "Each work order follows: Estimate → Quote → Work → Invoice → Paid.",
          "Filter by status, type (Repair, Wax, Maintenance, Inspection), tags, and more.",
          "Click any work order to manage it: parts, estimate, quotes, invoices.",
          "Use the Kanban board view for a visual overview by status.",
        ],
        tip: "Use the quick filters on top for daily work. Click 'Filters' for advanced options like priority, location, date range, and tags.",
        activeStep: "work",
        quickActions: [
          { label: "New Work Order", href: "/repairs/new" },
          { label: "Kanban Board", href: "/repairs/board" },
        ],
      };

    case "repair-new":
      return {
        title: "Creating a new work order",
        steps: [
          "Choose the type: Repair, Wax Treatment, Maintenance, or Inspection.",
          "Select a customer and unit (caravan). Describe the work needed.",
          "For wax jobs, standard tasks are auto-generated after creation.",
          "After creating, go to the detail page to build a cost estimate and create a quote.",
        ],
        tip: "Wax treatments auto-populate tasks. For all types, you can always add more parts and adjust the estimate later.",
        activeStep: "estimate",
      };

    case "repair-detail": {
      const job = context?.job;
      if (!job) {
        return {
          title: "Work order workflow",
          steps: [
            "1. Add tags to categorise this job — create new tags directly from the '+' button.",
            "2. Build cost estimate: add parts (with markup) + labour hours. Filter parts by category.",
            "3. Create Quote → sends to Holded, email it to the customer directly.",
            "4. Do the work. Found extra issues? Update the estimate — amounts adjust automatically.",
            "5. Create Invoice → converts your estimate to a Holded invoice. Send it via email.",
          ],
          tip: "Everything happens from this page. Parts, quotes, invoices, communication log — all inline.",
          activeStep: "estimate",
        };
      }

      const hasQuote = !!job.holdedQuoteId;
      const hasInvoice = !!job.holdedInvoiceId;
      const isPaid = job.invoiceStatus === "paid";
      const isCompleted = ["completed", "invoiced"].includes(job.status);
      const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);

      if (isPaid) {
        return {
          title: "Completed and paid",
          steps: [
            "✅ Cost estimate built and quote sent.",
            "✅ Work completed.",
            "✅ Invoice created and sent.",
            "✅ Payment received — synced from Holded.",
          ],
          tip: "This work order is fully done. Review the timeline below for the full history.",
          activeStep: "paid",
        };
      }

      if (hasInvoice) {
        return {
          title: "Invoice sent — waiting for payment",
          steps: [
            "✅ Quote approved, work completed, invoice created.",
            "→ Send the invoice via the Email button in the sidebar.",
            "Payment is tracked automatically — syncs from Holded every 30 minutes.",
            "Need to mark paid now? Go to Invoices page → click the 'Unpaid' badge.",
          ],
          tip: "Download the PDF or email the invoice from the sidebar. Cash payment? Mark it paid manually on the Invoices page.",
          activeStep: "paid",
        };
      }

      if (isCompleted && !hasInvoice) {
        return {
          title: "Work done — time to invoice",
          steps: [
            "✅ Quote sent, work completed.",
            "→ Review the cost estimate. Need to adjust for extra work? Update lines now.",
            "→ Click 'Create Invoice' in the sidebar to generate a Holded invoice.",
            "Then email it to the customer.",
          ],
          tip: "Make sure the estimate reflects all work done before creating the invoice.",
          activeStep: "invoice",
        };
      }

      if (hasQuote && !isCompleted) {
        return {
          title: "Quote sent — do the work",
          steps: [
            "✅ Quote created and sent via Holded.",
            "→ Set status to 'In Progress' and start the work.",
            "Found extra issues? Add parts or labour to the estimate — it updates automatically.",
            "When finished: set 'Completed' → Create Invoice → Send.",
          ],
          tip: "It's normal to find extra issues during work. Add them to the estimate — the invoice will reflect everything.",
          activeStep: "work",
        };
      }

      if (hasEstimate && !hasQuote) {
        return {
          title: "Estimate ready — create a quote",
          steps: [
            "✅ Cost estimate built with parts and labour.",
            "→ Click 'Create Quote' in the sidebar to send to Holded.",
            "Then click 'Email' to send the quote to the customer.",
            "Once approved, start the work.",
          ],
          tip: "The quote shows selling prices (with markup). Your cost prices are never visible to the customer.",
          activeStep: "quote",
        };
      }

      return {
        title: "Start with a cost estimate",
        steps: [
          "→ Add parts from the catalog using '+ Add Line' — markup is applied automatically.",
          "→ Add labour hours with '+ Labour' (rate from Settings → Pricing).",
          "→ Optional: set a discount percentage for the customer.",
          "Then create a Quote in Holded and send it to the customer.",
        ],
        tip: "Parts, labour, markup, and VAT — all calculated automatically. The customer only sees the final selling price.",
        activeStep: "estimate",
      };
    }

    case "customers":
      return {
        title: "Contacts & customers",
        steps: [
          "Customers from Holded sync here every 6 hours — no manual import needed.",
          "Add new customers manually. They're pushed to Holded when you create a quote or invoice.",
          "Every customer needs an email address for receiving quotes and invoices.",
          "Click a customer to see their full work order history and linked documents.",
        ],
        tip: "The sync is bidirectional — add customers in either system and they appear in both.",
        quickActions: [
          { label: "New Customer", href: "/customers/new" },
        ],
      };

    case "parts":
      return {
        title: "Parts catalog & pricing",
        steps: [
          "Add parts with cost prices (what you pay the supplier).",
          "Organise into categories — filter by category using the tabs at the top.",
          "Set markup % per part, or use the default from Settings → Pricing.",
          "When added to a cost estimate, the selling price is calculated automatically.",
          "Garage technicians request parts by category — your categories appear there too.",
        ],
        tip: "Quotes and invoices show selling prices only. Your cost prices and margins are fully protected.",
      };

    case "invoices":
      return {
        title: "Invoices — synced from Holded",
        steps: [
          "Invoices are created from work order detail pages and synced to Holded instantly.",
          "Green = paid, yellow = partial, red = unpaid. Filter to see what needs attention.",
          "PDF download and email available per invoice — directly from this page.",
          "Payment status syncs automatically every 30 minutes from Holded.",
        ],
        tip: "Cash payment? Click the 'Unpaid' badge to mark it paid immediately — updates Holded too.",
        activeStep: "paid",
      };

    case "quotes":
      return {
        title: "Quotes — synced from Holded",
        steps: [
          "Quotes are created from work order detail pages — build a cost estimate first.",
          "Each quote syncs to Holded instantly. Email it to the customer from the work order page.",
          "When approved, start the work. When done, convert to an invoice.",
          "Quote status syncs automatically from Holded.",
        ],
        tip: "Quotes show selling prices (cost + markup). Your purchase prices are never visible to the customer.",
        activeStep: "quote",
      };

    case "units":
      return {
        title: "Caravans & units",
        steps: [
          "Register each caravan/unit with brand, model, and registration number.",
          "Link units to work orders to track the full service history per vehicle.",
          "When creating a work order, select the customer's unit to auto-fill details.",
        ],
        tip: "One unit can have multiple work orders over time — the full history is visible on the unit page.",
        quickActions: [
          { label: "New Unit", href: "/units/new" },
        ],
      };

    default:
      return {
        title: "How this system works",
        steps: [
          "Estimate → Quote → Work → Invoice → Paid — that's the flow.",
          "Choose work order type: Repair, Wax, Maintenance, or Inspection.",
          "Everything syncs with Holded automatically.",
        ],
        tip: "Click any work order to see the full workflow.",
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
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border overflow-hidden">
      {/* Compact header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0CC0DF]/10">
            <BookOpen className="h-3 w-3 text-[#0CC0DF]" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900 dark:text-foreground leading-tight">
            {tutorial.title}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 dark:text-muted-foreground dark:hover:text-foreground transition-colors p-1 -mr-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress dots */}
      <div className="px-5 pb-3">
        <div className="flex gap-1">
          {tutorial.steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] flex-1 rounded-full transition-all duration-300",
                i <= currentStep ? "bg-[#0CC0DF]" : "bg-gray-100 dark:bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-muted-foreground mt-1.5 tracking-wide">
          Step {currentStep + 1} of {tutorial.steps.length}
        </p>
      </div>

      {/* Step content */}
      <div className="px-5 pb-5 border-t border-gray-50 dark:border-border pt-4">
        <div className="mb-4">
          <p className="text-[13px] font-medium text-gray-900 dark:text-foreground leading-snug">{step.title}</p>
          <p className="text-[12.5px] text-gray-500 dark:text-muted-foreground leading-relaxed mt-1.5">{step.description}</p>
        </div>

        {step.action && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-gray-50/80 dark:bg-muted/50 mb-4 border border-gray-100/80 dark:border-border/50">
            <MousePointerClick className="h-3.5 w-3.5 mt-0.5 text-[#0CC0DF] shrink-0" />
            <p className="text-[11.5px] text-gray-600 dark:text-muted-foreground leading-relaxed font-medium">
              {step.action}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            className="text-[12px] text-gray-400 hover:text-gray-600 dark:text-muted-foreground dark:hover:text-foreground transition-colors disabled:opacity-20"
            disabled={isFirst}
            onClick={() => setCurrentStep(currentStep - 1)}
          >
            ← Back
          </button>
          {isLast ? (
            <button
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#0CC0DF] hover:bg-[#0ab0cc] rounded-xl px-4 py-2 transition-all duration-150 active:scale-[0.97]"
              onClick={completeTutorial}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done
            </button>
          ) : (
            <button
              className="text-[12px] font-medium text-gray-900 dark:text-foreground hover:text-[#0CC0DF] transition-colors"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Next →
            </button>
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
    <div className="bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0CC0DF]/10">
            <BookOpen className="h-3 w-3 text-[#0CC0DF]" />
          </div>
          <span className="text-[13px] font-semibold text-gray-900 dark:text-foreground">
            Tutorials
          </span>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 dark:text-muted-foreground dark:hover:text-foreground transition-colors p-1 -mr-1">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 pb-4 space-y-0.5">
        {allTutorials.map((tutorial) => {
          const isCompleted = completedIds.includes(tutorial.id);
          const isRelevant = relevant.includes(tutorial);
          return (
            <button
              key={tutorial.id}
              onClick={() => onSelectTutorial(tutorial)}
              className="w-full text-left rounded-xl px-3 py-2.5 transition-all duration-150 hover:bg-gray-50 dark:hover:bg-accent group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-gray-300 dark:text-muted-foreground/40 shrink-0" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-gray-400 dark:text-muted-foreground shrink-0 group-hover:text-[#0CC0DF] transition-colors" />
                  )}
                  <span className={cn(
                    "text-[12.5px] font-medium leading-snug",
                    isCompleted ? "text-gray-400 dark:text-muted-foreground/60" : "text-gray-700 dark:text-foreground",
                  )}>
                    {tutorial.title}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-muted-foreground/30 shrink-0 group-hover:text-gray-400 transition-colors" />
              </div>
              <div className="flex items-center gap-3 mt-0.5 pl-[22px]">
                <span className="text-[10px] text-gray-400 dark:text-muted-foreground/60">{tutorial.duration}</span>
                <span className="text-[10px] text-gray-400 dark:text-muted-foreground/60">{tutorial.steps.length} steps</span>
                {isRelevant && !isCompleted && (
                  <span className="text-[10px] text-[#0CC0DF] font-medium">
                    relevant
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
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#0CC0DF] dark:text-muted-foreground dark:hover:text-[#0CC0DF] transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Show guide
        </button>
        <span className="text-gray-200 dark:text-muted-foreground/30">·</span>
        <button
          type="button"
          onClick={() => { setDismissed(false); setShowTutorials(true); }}
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#0CC0DF] dark:text-muted-foreground dark:hover:text-[#0CC0DF] transition-colors"
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
        "bg-white dark:bg-card rounded-2xl border border-gray-100 dark:border-border overflow-hidden transition-all",
        className,
      )}
    >
      {/* Header with workflow steps */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0CC0DF]/10">
              <Sparkles className="h-3 w-3 text-[#0CC0DF]" />
            </div>
            <span className="text-[13px] font-semibold text-gray-900 dark:text-foreground leading-tight">
              {guide.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="text-[10.5px] text-gray-400 hover:text-[#0CC0DF] dark:text-muted-foreground dark:hover:text-[#0CC0DF] transition-colors flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-accent"
              onClick={() => setShowTutorials(true)}
            >
              <BookOpen className="h-3 w-3" />
              Tutorials
            </button>
            <button
              className="text-gray-300 hover:text-gray-500 dark:text-muted-foreground dark:hover:text-foreground transition-colors p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-accent"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              className="text-gray-300 hover:text-gray-500 dark:text-muted-foreground dark:hover:text-foreground transition-colors p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-accent"
              onClick={handleDismiss}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Workflow progress — Mollie-style minimal pills */}
        <div className="flex items-center gap-0">
          {STEPS.map((step, i) => {
            const isActive = i === activeStepIndex;
            const isCompleted = activeStepIndex >= 0 && i < activeStepIndex;
            const isFuture = activeStepIndex >= 0 && i > activeStepIndex;
            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                    isActive && "bg-[#0CC0DF]/10 text-[#0CC0DF]",
                    isCompleted && "text-[#0CC0DF]",
                    isFuture && "text-gray-300 dark:text-muted-foreground/30",
                    !isActive && !isCompleted && !isFuture && "text-gray-400 dark:text-muted-foreground",
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-3 w-3" /> : step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight className={cn(
                    "h-2.5 w-2.5 mx-0.5 shrink-0",
                    isCompleted ? "text-[#0CC0DF]/30" : "text-gray-200 dark:text-muted-foreground/20",
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expandable content */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-50 dark:border-border pt-3.5">
          <div className="space-y-2 mb-3">
            {guide.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12.5px] text-gray-600 dark:text-muted-foreground leading-relaxed">
                <span className="mt-0.5 shrink-0 w-4 text-center text-gray-300 dark:text-muted-foreground/40 font-medium text-[11px]">
                  {step.startsWith("✅") || step.startsWith("→") ? "" : `${i + 1}.`}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#0CC0DF]/5 dark:bg-[#0CC0DF]/5 mb-3 border border-[#0CC0DF]/10">
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 text-[#0CC0DF] shrink-0" />
            <p className="text-[11.5px] text-gray-500 dark:text-muted-foreground leading-relaxed">
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
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg border border-gray-100 dark:border-border bg-white dark:bg-card text-gray-500 dark:text-muted-foreground hover:text-[#0CC0DF] hover:border-[#0CC0DF]/30 dark:hover:text-[#0CC0DF] transition-all"
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
              <div className="mt-3 pt-3 border-t border-gray-50 dark:border-border">
                <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground/60 uppercase tracking-wider mb-2">
                  Tutorials for this page
                </p>
                <div className="space-y-0.5">
                  {relevantTutorials.map((tutorial) => (
                    <button
                      key={tutorial.id}
                      onClick={() => setActiveTutorial(tutorial)}
                      className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-accent transition-all group"
                    >
                      <Play className="h-3 w-3 text-gray-400 dark:text-muted-foreground shrink-0 group-hover:text-[#0CC0DF] transition-colors" />
                      <span className="text-[12px] text-gray-600 dark:text-muted-foreground group-hover:text-gray-900 dark:group-hover:text-foreground transition-colors">{tutorial.title}</span>
                      <span className="text-[10px] text-gray-400 dark:text-muted-foreground/60 ml-auto shrink-0">{tutorial.duration}</span>
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
