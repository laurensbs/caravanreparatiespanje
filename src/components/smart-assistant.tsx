"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  MessageCircleQuestion, X, ChevronRight, ArrowLeft, Search,
  Wrench, Receipt, Users, FileText, Package, Truck, Settings,
  Lightbulb, BookMarked, HelpCircle, Zap, CheckCircle2,
  AlertTriangle, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── FAQ data ─────────────────────────────────────────────────

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  keywords: string[];
  pages?: string[];
}

type FaqCategory =
  | "getting-started"
  | "repairs"
  | "quotes-invoices"
  | "holded"
  | "parts-pricing"
  | "customers"
  | "excel-migration"
  | "tips";

const CATEGORY_CONFIG: Record<FaqCategory, { label: string; icon: React.ReactNode; color: string }> = {
  "getting-started": { label: "Getting Started", icon: <Zap className="h-3.5 w-3.5" />, color: "text-blue-500" },
  "repairs": { label: "Repairs", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-amber-500" },
  "quotes-invoices": { label: "Quotes & Invoices", icon: <Receipt className="h-3.5 w-3.5" />, color: "text-purple-500" },
  "holded": { label: "Holded Integration", icon: <ArrowRight className="h-3.5 w-3.5" />, color: "text-sky-500" },
  "parts-pricing": { label: "Parts & Pricing", icon: <Package className="h-3.5 w-3.5" />, color: "text-emerald-500" },
  "customers": { label: "Customers", icon: <Users className="h-3.5 w-3.5" />, color: "text-rose-500" },
  "excel-migration": { label: "From Excel to This", icon: <FileText className="h-3.5 w-3.5" />, color: "text-orange-500" },
  "tips": { label: "Tips & Tricks", icon: <Lightbulb className="h-3.5 w-3.5" />, color: "text-yellow-500" },
};

const FAQ_ITEMS: FaqItem[] = [
  // ── Getting Started ────────────────────────────────
  {
    id: "what-is-this",
    question: "What is this system and how does it replace my Excel?",
    answer: "This is your new repair management system. It replaces the Excel spreadsheet you used before. Instead of manually tracking repairs, customers, parts, and invoices in separate Excel tabs, everything is now in one place — connected and automated.\n\nThe main flow is: Create a repair → Build a cost estimate (parts + labour) → Create a quote → Send it to the customer → Do the repair → Create an invoice → Get paid.\n\nThe big difference from Excel: amounts are calculated automatically, documents sync to Holded, and payment tracking happens without manual work.",
    category: "getting-started",
    keywords: ["start", "begin", "excel", "what", "how", "system", "replace"],
  },
  {
    id: "main-workflow",
    question: "What is the main workflow? How do I go from start to finish?",
    answer: "Every repair follows this flow:\n\n1. **Create a repair** — Click '+ New Repair', fill in customer, unit (caravan), and problem description.\n2. **Build cost estimate** — Add parts from catalog (markup applied automatically) and labour hours.\n3. **Create a Quote** — Click 'Create Quote' in the sidebar → it's created in Holded instantly.\n4. **Send the Quote** — Click 'Email' to send the quote to the customer.\n5. **Do the repair** — Change status to 'In Progress'. Add extra parts if you find more issues.\n6. **Create Invoice** — When done, set status to 'Completed', then 'Create Invoice'.\n7. **Send Invoice** — Click 'Email' to send it.\n8. **Payment** — When the customer pays in Holded, the status updates here automatically (every 30 min).\n\nYou can see which step each repair is at from the workflow bar at the top of every page.",
    category: "getting-started",
    keywords: ["workflow", "flow", "steps", "process", "start", "finish", "how"],
    pages: ["dashboard", "repairs", "repair-detail"],
  },
  {
    id: "where-to-start",
    question: "I just logged in — where do I start?",
    answer: "Start at the **Dashboard** (you're probably here already). You'll see:\n\n• **KPI cards** at the top — how many active, in progress, waiting, etc.\n• **Recent Activity** — your latest repairs.\n• A **guide** below the KPIs explaining what to do.\n\nTo create your first repair: click **'+ New Repair'** in the top right. Pick the customer, caravan, and describe the issue. Then go to the repair detail page to add parts and build a cost estimate.\n\nTip: The sidebar on the left is your navigation. Repairs, Contacts, Parts, Invoices — everything is there.",
    category: "getting-started",
    keywords: ["start", "begin", "first", "login", "where", "new"],
    pages: ["dashboard"],
  },
  {
    id: "navigation",
    question: "How do I navigate the system?",
    answer: "Use the **sidebar on the left**:\n\n• **Dashboard** — Overview of all repairs and stats.\n• **Repairs** — All repairs, filterable by status/priority/location.\n• **Contacts** — All customers, synced from Holded.\n• **Units** — Caravans/vehicles registered in the system.\n• **Parts** — Your parts catalog with cost prices and markup.\n• **Invoices** — All invoices from Holded with payment status.\n• **Settings** — Locations, tags, users, pricing.\n\nYou can collapse the sidebar by clicking the arrow at the bottom. On mobile, it works as a slide-out menu.\n\nTip: There's a search (Cmd+K or Ctrl+K) to quickly find repairs, customers, and parts.",
    category: "getting-started",
    keywords: ["navigate", "sidebar", "menu", "find", "where", "pages"],
  },

  // ── Repairs ────────────────────────────────────────
  {
    id: "create-repair",
    question: "How do I create a new repair?",
    answer: "Two ways:\n\n1. **From the Dashboard** — Click '+ New Repair' in the top right.\n2. **From Repairs page** — Same button, top right.\n\nFill in:\n• **Customer** — Select from the dropdown (they come from Holded).\n• **Unit** — The caravan/vehicle being repaired.\n• **Title** — Brief description (e.g. 'Leaking window').\n• **Description** — Full details of the problem.\n• **Location** — Which workshop (Cruïllas, Peratallada, Sant Climent).\n• **Priority** — Normal, High, or Urgent.\n\nAfter creating, you'll land on the repair detail page where you build the cost estimate.",
    category: "repairs",
    keywords: ["create", "new", "repair", "add", "make"],
    pages: ["repairs", "repair-new", "dashboard"],
  },
  {
    id: "repair-statuses",
    question: "What do the repair statuses mean?",
    answer: "Each repair goes through these statuses:\n\n• **New** — Just created, not started yet.\n• **To Do** — Acknowledged, in the queue.\n• **Scheduled** — Has a planned date.\n• **In Progress** — Currently being worked on.\n• **Waiting Parts** — Repair paused, waiting for parts to arrive.\n• **Waiting Customer** — Waiting for the customer to respond (about quote, pickup, etc.).\n• **Blocked** — Can't proceed for some reason.\n• **Completed** — Repair work is done, ready for invoicing.\n• **Invoiced** — Invoice created in Holded.\n• **Archived** — Closed/finished.\n\nTip: The status is near the top of the repair detail page. Click it to change.",
    category: "repairs",
    keywords: ["status", "statuses", "meaning", "new", "progress", "waiting", "completed"],
    pages: ["repairs", "repair-detail"],
  },
  {
    id: "cost-estimate",
    question: "How do I build a cost estimate?",
    answer: "On the repair detail page, scroll down to the **Cost Estimate** section:\n\n1. **Add parts** — Click '+ Add Line'. Select a part from your catalog → the selling price (cost + markup) is filled in automatically.\n2. **Add labour** — Click '+ Labour'. Enter the hours worked. The hourly rate comes from Settings → Pricing.\n3. **Custom lines** — You can also add custom items with a description and price.\n4. **Discount** — Optionally set a discount percentage.\n\nThe total is calculated automatically: parts + labour – discount + VAT.\n\nThe customer only ever sees the selling price (after markup). Your purchase price and margin stay private.",
    category: "repairs",
    keywords: ["cost", "estimate", "build", "parts", "labour", "price", "total"],
    pages: ["repair-detail"],
  },
  {
    id: "edit-repair",
    question: "How do I edit a repair's details?",
    answer: "On the repair detail page:\n\n• **Title** — Click it to edit inline.\n• **Description** — Click 'Edit' next to it.\n• **Status, Priority** — Use the dropdowns at the top.\n• **Cost estimate** — Add/remove/edit lines directly.\n• **Notes** — Use the internal notes field.\n\nAfter making changes, click **'Save'** (top right) to save everything.\n\nTip: The timeline at the bottom shows the history of all changes.",
    category: "repairs",
    keywords: ["edit", "change", "update", "modify", "title", "description"],
    pages: ["repair-detail"],
  },
  {
    id: "repair-filters",
    question: "How do I find a specific repair?",
    answer: "On the **Repairs** page:\n\n• **Search bar** — Type a customer name, repair code, or description.\n• **Status filter** — Filter by Todo, In Progress, Waiting, etc.\n• **Location filter** — Filter by workshop.\n• **Priority filter** — Find urgent repairs.\n\nOr use the **global search** (Cmd+K / Ctrl+K) from anywhere in the system.\n\nTip: The KPI cards on the Dashboard are clickable — click 'Urgent' to see all urgent repairs.",
    category: "repairs",
    keywords: ["find", "search", "filter", "specific", "looking", "where"],
    pages: ["repairs"],
  },

  // ── Quotes & Invoices ──────────────────────────────
  {
    id: "create-quote",
    question: "How do I create and send a quote?",
    answer: "From the **repair detail page**:\n\n1. First, build your cost estimate (parts + labour).\n2. In the **right sidebar**, under 'Holded Documents', click **'Create Quote'**.\n3. The quote is instantly created in Holded with all your line items.\n4. Two buttons appear: **PDF** (download) and **Email** (send to customer).\n5. Click **'Email'** to send the quote to the customer's email address.\n\nThe quote shows the selling prices (after markup), VAT, and total. Your purchase prices are never visible.\n\nTip: If the customer doesn't have an email, add it in their contact page first.",
    category: "quotes-invoices",
    keywords: ["quote", "create", "send", "email", "pdf", "offerte"],
    pages: ["repair-detail"],
  },
  {
    id: "create-invoice",
    question: "How do I create and send an invoice?",
    answer: "From the **repair detail page**:\n\n1. Make sure your cost estimate is complete.\n2. Set the repair status to **'Completed'** (or you can do it before).\n3. In the **right sidebar**, click **'Create Invoice'**.\n4. The invoice is created in Holded instantly.\n5. Click **'Email'** to send the invoice to the customer.\n\nThe invoice amounts come from your cost estimate. If you need to change something, update the estimate first, then create a new invoice.\n\nPayment tracking is automatic — when the customer pays in Holded, it updates here within 30 minutes.",
    category: "quotes-invoices",
    keywords: ["invoice", "create", "send", "factuur", "bill", "payment"],
    pages: ["repair-detail", "invoices"],
  },
  {
    id: "invoice-page",
    question: "What is the Invoices page for?",
    answer: "The **Invoices** page shows all invoices from Holded in one overview:\n\n• **Green** = Paid\n• **Yellow** = Partially paid\n• **Red** = Unpaid (click to mark as paid)\n\nYou can:\n• Filter by status (Paid / Unpaid / Partial)\n• Search by invoice number or customer name\n• Filter by date range\n• Download PDFs\n• Resend invoices via email\n\nPayment status syncs automatically from Holded every 30 minutes. If a customer pays cash and you want to update immediately, click the 'Unpaid' badge to mark it as paid.",
    category: "quotes-invoices",
    keywords: ["invoices", "page", "overview", "paid", "unpaid", "payment"],
    pages: ["invoices"],
  },
  {
    id: "quote-vs-invoice",
    question: "What's the difference between a quote and an invoice?",
    answer: "• A **quote** (offerte) is sent BEFORE the work — so the customer can approve the cost.\n• An **invoice** (factuur) is sent AFTER the work — so the customer pays.\n\nBoth are created in Holded from the same cost estimate. The typical flow:\n1. Build estimate → Create quote → Send to customer\n2. Customer approves → Do the repair\n3. Repair done → Create invoice → Send to customer → Get paid\n\nIf you find extra issues during the repair, update the cost estimate. The invoice will reflect the latest amounts.",
    category: "quotes-invoices",
    keywords: ["quote", "invoice", "difference", "offerte", "factuur"],
    pages: ["repair-detail"],
  },

  // ── Holded Integration ─────────────────────────────
  {
    id: "what-is-holded",
    question: "What is Holded and how does it connect?",
    answer: "**Holded** is the accounting/invoicing system used by the business. This repair system connects to Holded via API:\n\n• **Quotes** — Created here → appear instantly in Holded.\n• **Invoices** — Created here → appear instantly in Holded.\n• **Contacts** — Synced both ways every 6 hours.\n• **Payments** — When a customer pays an invoice in Holded, the payment status syncs back here every 30 minutes.\n\nYou do NOT need to log into Holded to create quotes or invoices — you do everything from this system. But you CAN open Holded to see the official documents, change payment methods, or do manual edits.\n\nEvery quote and invoice has an 'Open in Holded' link.",
    category: "holded",
    keywords: ["holded", "what", "connect", "sync", "integration", "accounting"],
  },
  {
    id: "holded-sync",
    question: "How does the sync with Holded work?",
    answer: "The sync is automatic:\n\n• **Quotes & Invoices** — Created INSTANTLY when you click the button. No delay.\n• **Contacts** — Synced every **6 hours** in both directions. New customers in Holded appear here, and new customers here are pushed to Holded.\n• **Payments** — Synced every **30 minutes**. When a customer pays in Holded (bank transfer, iDEAL, etc.), it shows here as 'Paid'.\n\nYou can also trigger a manual sync or mark an invoice as paid directly.\n\nThe sync runs on Vercel cron jobs — it happens in the background, you don't need to do anything.",
    category: "holded",
    keywords: ["sync", "automatic", "how", "when", "contacts", "payments", "cron"],
  },
  {
    id: "holded-link",
    question: "Can I still open things in Holded directly?",
    answer: "Yes! Every quote and invoice has an **'Open in Holded'** button/link. This opens the document directly in the Holded web app.\n\nUse this when you need to:\n• See the official PDF layout\n• Add payment information manually\n• Make edits that are only available in Holded\n• Check the full accounting view\n\nChanges to payment status in Holded sync back here automatically.",
    category: "holded",
    keywords: ["holded", "open", "link", "directly", "website"],
    pages: ["repair-detail", "invoices"],
  },
  {
    id: "payment-tracking",
    question: "How does payment tracking work?",
    answer: "Payment tracking is mostly **automatic**:\n\n1. You create and send an invoice from this system.\n2. The customer pays via bank transfer, iDEAL, or another method in Holded.\n3. Every **30 minutes**, this system checks Holded for payment updates.\n4. When paid, the invoice shows as **green/Paid** here.\n\nIf you need to mark something paid immediately (e.g. customer paid cash):\n• On the **Invoices page** — click the red 'Unpaid' badge\n• This marks it as paid in both this system and Holded.\n\nNo more manual Excel tracking!",
    category: "holded",
    keywords: ["payment", "paid", "tracking", "automatic", "bank", "cash"],
    pages: ["invoices"],
  },

  // ── Parts & Pricing ────────────────────────────────
  {
    id: "how-parts-work",
    question: "How does the parts catalog work?",
    answer: "The **Parts** page is your catalog of all parts/materials you use:\n\n• Each part has a **cost price** (what you pay the supplier).\n• Each part can have a **markup %** (how much you charge on top).\n• If no markup is set, the **default markup** from Settings → Pricing is used.\n\n**Example:** Part costs €10, markup is 40% → selling price is €14.\n\nWhen you add a part to a repair's cost estimate, the **selling price** is calculated and filled in automatically. The customer only ever sees this selling price — never your cost.\n\nYou can also add a **supplier** and **SKU number** to each part for your records.",
    category: "parts-pricing",
    keywords: ["parts", "catalog", "cost", "price", "how"],
    pages: ["parts"],
  },
  {
    id: "markup-explained",
    question: "How does markup work? Will the customer see my cost price?",
    answer: "**No, the customer never sees your cost price.** Here's how it works:\n\n• You set the **cost price** (what you pay) per part.\n• You set a **markup percentage** per part (or use the default from Settings).\n• The **selling price** = cost × (1 + markup/100).\n\n**Example:** Cost €50, markup 40% → Selling price €70. Your margin: €20.\n\nQuotes and invoices always show the **selling price**. Your cost price and markup are only visible to you in the system.\n\nLabour works differently — you set a flat hourly rate in Settings → Pricing (e.g. €42.50/hr excl. VAT).",
    category: "parts-pricing",
    keywords: ["markup", "cost", "selling", "margin", "customer", "see", "price"],
    pages: ["parts", "repair-detail"],
  },
  {
    id: "add-parts-repair",
    question: "How do I add parts to a repair?",
    answer: "On the repair detail page, in the **Cost Estimate** section:\n\n1. Click **'+ Add Line'**.\n2. Select a part from the dropdown — the selling price fills in automatically.\n3. Set the **quantity**.\n4. The line total is calculated: quantity × selling price.\n\nYou can also:\n• Click **'+ Labour'** to add work hours.\n• Add a **custom line** with your own description and price.\n• Set a **discount %** at the bottom.\n\nThe estimate total includes all lines + VAT. This total is used for both quotes and invoices.",
    category: "parts-pricing",
    keywords: ["add", "parts", "repair", "estimate", "line", "labour"],
    pages: ["repair-detail"],
  },
  {
    id: "hourly-rate",
    question: "Where do I set the hourly labour rate?",
    answer: "Go to **Settings** (bottom of sidebar) → **Pricing** section.\n\nHere you can set:\n• **Hourly rate** — The rate charged per hour of labour (excl. VAT).\n• **Default markup %** — Used for parts that don't have their own markup.\n\nWhen you add labour hours to a repair, the total is: hours × hourly rate.\n\nFor example: 3 hours × €42.50/hr = €127.50 + VAT.",
    category: "parts-pricing",
    keywords: ["hourly", "rate", "labour", "labor", "settings", "pricing"],
    pages: ["settings"],
  },

  // ── Customers ──────────────────────────────────────
  {
    id: "customer-sync",
    question: "Where do customers come from?",
    answer: "Customers (contacts) come from **two sources**:\n\n1. **Holded** — Every 6 hours, all contacts from Holded are synced here automatically. Any new contacts added in Holded will appear.\n2. **Manual** — You can add customers directly via Contacts → '+ New Customer'. When you create a quote/invoice for them, they're automatically pushed to Holded.\n\nSo you don't need to maintain customers in two places — the sync handles it.\n\nImportant: Make sure every customer has an **email address** — this is needed to send quotes and invoices.",
    category: "customers",
    keywords: ["customer", "contact", "where", "come", "sync", "add"],
    pages: ["customers"],
  },
  {
    id: "customer-email-important",
    question: "Why does the system keep asking for customer email?",
    answer: "The email address is how quotes and invoices are delivered. When you click 'Email' on a quote or invoice, Holded sends it to that email address.\n\n**Without an email:**\n• You can still create quotes and invoices\n• You can download PDFs\n• But you CAN'T send them directly from the system\n\nTo add/update an email: Go to **Contacts** → click the customer → edit their email field.\n\nThe system will show a suggestion/warning when a customer is missing their email.",
    category: "customers",
    keywords: ["email", "why", "important", "customer", "send", "missing"],
    pages: ["customers", "repair-detail"],
  },

  // ── Excel Migration ────────────────────────────────
  {
    id: "excel-vs-this",
    question: "What did I use to do in Excel, and where is it now?",
    answer: "Here's the mapping from your Excel workflow:\n\n| **Excel** | **This System** |\n|---|---|\n| Repair tracking rows | → **Repairs** page (with statuses, filters) |\n| Customer list | → **Contacts** (synced with Holded) |\n| Parts/price list | → **Parts** catalog (with automatic markup) |\n| Cost calculations | → **Cost Estimate** on each repair (auto-calculated) |\n| Manual invoice creation | → **Create Invoice** button (creates in Holded) |\n| Payment tracking columns | → **Automatic** from Holded (every 30 min) |\n| Status columns | → **Status dropdown** (with workflow guide) |\n\nThe biggest wins: no more manual calculations, no copy-paste to Holded, payments track themselves, and everything is searchable/filterable.",
    category: "excel-migration",
    keywords: ["excel", "used", "before", "old", "spreadsheet", "migration", "where"],
  },
  {
    id: "no-amounts-visible",
    question: "Why can't I see amounts on the invoices page?",
    answer: "The invoices page shows **counts and statuses** instead of amounts. This keeps the overview clean and focused on what matters: which invoices are paid and which need attention.\n\nTo see the full details of an invoice:\n• Click the **invoice number** to open it in Holded\n• Or go to the **repair detail page** (linked in the 'Repair' column) to see the cost breakdown\n\nAll amount details are always available in Holded — this system focuses on workflow and tracking.",
    category: "excel-migration",
    keywords: ["amounts", "money", "total", "can't see", "where", "numbers", "invoices"],
    pages: ["invoices"],
  },
  {
    id: "data-safe",
    question: "Is my data safe? Where is it stored?",
    answer: "Your data is stored in **two places**:\n\n1. **This system's database** — Hosted securely on Neon (PostgreSQL in the cloud). Repairs, customers, parts, cost estimates, notes, and audit logs are all here.\n2. **Holded** — All official documents (quotes, invoices, contacts) are in your Holded account.\n\nThe system is hosted on **Vercel** — a professional cloud platform used by large companies.\n\nBackups: Neon has automatic database backups. Holded has its own backup system for your documents.\n\nIn short: much safer than a local Excel file!",
    category: "excel-migration",
    keywords: ["data", "safe", "backup", "stored", "where", "secure"],
  },

  // ── Tips & Tricks ──────────────────────────────────
  {
    id: "quick-search",
    question: "How do I quickly find anything?",
    answer: "Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) from anywhere in the system. This opens the **command palette / search**.\n\nYou can search for:\n• Repairs (by code, customer name, title)\n• Customers\n• Parts\n• Pages (Dashboard, Settings, etc.)\n\nIt's the fastest way to navigate.",
    category: "tips",
    keywords: ["search", "find", "quick", "fast", "cmd", "ctrl", "k"],
  },
  {
    id: "kanban-board",
    question: "Is there a visual overview of all repairs?",
    answer: "Yes! Go to **Repairs** → click **'Board'** (or go to /repairs/board).\n\nThis shows a **Kanban board** where repairs are grouped by status in columns. You can see at a glance what's new, in progress, waiting, and completed.\n\nGreat for daily planning: quickly see which repairs need attention.",
    category: "tips",
    keywords: ["board", "kanban", "visual", "overview", "columns"],
    pages: ["repairs"],
  },
  {
    id: "communication-log",
    question: "How do I track communications with a customer?",
    answer: "On each **repair detail page**, there's a **Communication Log** section:\n\n• Log phone calls, emails, and messages.\n• Each entry is timestamped and saved.\n• This creates a history of all contact with the customer about this repair.\n\nUse it to track: when you called, what was discussed, what was agreed.",
    category: "tips",
    keywords: ["communication", "log", "phone", "call", "email", "track", "history"],
    pages: ["repair-detail"],
  },
  {
    id: "mark-paid-manually",
    question: "How do I manually mark an invoice as paid?",
    answer: "On the **Invoices** page:\n\n• Find the unpaid invoice (red 'Unpaid' badge).\n• Click the **'Unpaid' badge** → it marks the invoice as paid.\n• This updates both this system AND Holded.\n\nUse this when:\n• Customer paid cash\n• Bank transfer just came in but Holded hasn't synced yet\n• You want to update the status immediately\n\nNormally you don't need to do this — payments sync automatically from Holded every 30 minutes.",
    category: "tips",
    keywords: ["mark", "paid", "manually", "cash", "update", "status"],
    pages: ["invoices"],
  },
  {
    id: "discount",
    question: "How do I apply a discount?",
    answer: "In the repair's **Cost Estimate** section, at the bottom, there's a **Discount %** field.\n\nSet a percentage (e.g. 10%) and the discount is applied to the total before VAT. The discounted amount shows on the quote and invoice.\n\nExample: Estimate €500, discount 10% = €450 + VAT.",
    category: "tips",
    keywords: ["discount", "percentage", "reduce", "price", "lower"],
    pages: ["repair-detail"],
  },
  {
    id: "delete-repair",
    question: "Can I delete a repair?",
    answer: "Yes, but carefully. On the repair detail page, scroll to the bottom — there's a **delete button**.\n\nNote:\n• Deleting a repair removes it from this system.\n• If a quote/invoice was already created in Holded, it still exists there.\n• This action cannot be undone.\n\nAlternative: Instead of deleting, you can set the status to **'Archived'** to hide it from the active list while keeping the history.",
    category: "tips",
    keywords: ["delete", "remove", "repair", "undo", "archive"],
    pages: ["repair-detail"],
  },
];

// ─── Context-aware tips for repair detail ──────────────────────

interface RepairContext {
  job?: any;
  settings?: any;
}

function getRepairTips(context?: RepairContext): FaqItem[] {
  const job = context?.job;
  if (!job) return [];

  const tips: FaqItem[] = [];
  const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);
  const hasQuote = !!job.holdedQuoteId;
  const hasInvoice = !!job.holdedInvoiceId;
  const isPaid = job.invoiceStatus === "paid";

  if (!hasEstimate && !hasInvoice) {
    tips.push({
      id: "tip-no-estimate",
      question: "This repair has no cost estimate yet",
      answer: "Add parts from the catalog with '+ Add Line' and labour hours with '+ Labour'. The total is calculated automatically with markup and VAT. Once the estimate is ready, you can create a quote to send to the customer.",
      category: "tips",
      keywords: [],
    });
  }

  if (hasEstimate && !hasQuote && !hasInvoice) {
    tips.push({
      id: "tip-ready-for-quote",
      question: "Estimate ready — create a quote next",
      answer: "Your cost estimate is ready. Click 'Create Quote' in the right sidebar to generate a Holded quote. Then click 'Email' to send it to the customer for approval.",
      category: "tips",
      keywords: [],
    });
  }

  if (hasQuote && !hasInvoice && !isPaid) {
    const isActive = !["completed", "invoiced", "archived"].includes(job.status);
    if (isActive) {
      tips.push({
        id: "tip-doing-repair",
        question: "Quote sent — working on the repair",
        answer: "The quote was sent. If you find extra issues during the repair, add more lines to the cost estimate — amounts update automatically. When the repair is finished, change status to 'Completed' and then create the invoice.",
        category: "tips",
        keywords: [],
      });
    } else {
      tips.push({
        id: "tip-ready-for-invoice",
        question: "Repair done — time to create the invoice",
        answer: "The repair is completed. Click 'Create Invoice' in the right sidebar. This converts your cost estimate into a Holded invoice. Then send it to the customer via email.",
        category: "tips",
        keywords: [],
      });
    }
  }

  if (hasInvoice && !isPaid) {
    tips.push({
      id: "tip-waiting-payment",
      question: "Invoice sent — waiting for payment",
      answer: "The invoice has been created and can be sent via email. Payment tracking is automatic — when the customer pays in Holded, it shows here within 30 minutes. You can also click 'Unpaid' on the Invoices page to mark it as paid manually (e.g. for cash payments).",
      category: "tips",
      keywords: [],
    });
  }

  if (isPaid) {
    tips.push({
      id: "tip-all-done",
      question: "This repair is fully completed and paid",
      answer: "Everything is done! The quote was sent, repair completed, invoice sent, and payment received. You can archive this repair or keep it as a reference.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.customer && !job.customer.email) {
    tips.push({
      id: "tip-no-email",
      question: "Customer has no email address",
      answer: "This customer doesn't have an email address. You can still create quotes and invoices, but you won't be able to send them via email. Add the email in the customer's contact page.",
      category: "tips",
      keywords: [],
    });
  }

  return tips;
}

// ─── Component ────────────────────────────────────────────────

export type AssistantPage =
  | "dashboard"
  | "repairs"
  | "repair-detail"
  | "repair-new"
  | "customers"
  | "parts"
  | "invoices"
  | "units"
  | "settings";

const PAGE_RELEVANT_CATEGORIES: Record<AssistantPage, FaqCategory[]> = {
  "dashboard": ["getting-started", "excel-migration"],
  "repairs": ["repairs", "getting-started"],
  "repair-detail": ["repairs", "quotes-invoices", "parts-pricing"],
  "repair-new": ["repairs", "getting-started"],
  "customers": ["customers", "holded"],
  "parts": ["parts-pricing"],
  "invoices": ["quotes-invoices", "holded"],
  "units": ["getting-started"],
  "settings": ["parts-pricing", "tips"],
};

interface SmartAssistantProps {
  page: AssistantPage;
  context?: RepairContext;
}

export function SmartAssistant({ page, context }: SmartAssistantProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFaq, setSelectedFaq] = useState<FaqItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory | null>(null);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        if (selectedFaq) setSelectedFaq(null);
        else if (selectedCategory) setSelectedCategory(null);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedFaq, selectedCategory]);

  // Context-aware tips for repair detail
  const repairTips = useMemo(
    () => page === "repair-detail" ? getRepairTips(context) : [],
    [page, context],
  );

  // Filter FAQ items
  const filteredFaq = useMemo(() => {
    let items = FAQ_ITEMS;

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.keywords.some((k) => k.includes(q)),
      );
    } else if (selectedCategory) {
      items = items.filter((f) => f.category === selectedCategory);
    }

    return items;
  }, [search, selectedCategory]);

  // Relevant FAQs for current page
  const relevantCategories = PAGE_RELEVANT_CATEGORIES[page] ?? [];
  const relevantFaq = useMemo(
    () => FAQ_ITEMS.filter(
      (f) =>
        relevantCategories.includes(f.category) ||
        f.pages?.includes(page),
    ),
    [page, relevantCategories],
  );

  function handleBack() {
    if (selectedFaq) {
      setSelectedFaq(null);
    } else if (selectedCategory) {
      setSelectedCategory(null);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "h-12 w-12 hover:scale-105 active:scale-95",
          open
            ? "bg-foreground text-background"
            : "bg-blue-600 text-white hover:bg-blue-700",
        )}
        title="Ask Jake's Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              {(selectedFaq || selectedCategory) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">
                  {selectedFaq
                    ? "Answer"
                    : selectedCategory
                      ? CATEGORY_CONFIG[selectedCategory].label
                      : "Jake's Assistant"}
                </h3>
                {!selectedFaq && !selectedCategory && (
                  <p className="text-[11px] text-white/70">Ask anything about the system</p>
                )}
              </div>
            </div>
          </div>

          {/* Search (not on answer view) */}
          {!selectedFaq && (
            <div className="px-3 py-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedCategory(null);
                  }}
                  className="h-8 pl-8 text-xs rounded-lg"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedFaq ? (
              // ── Answer view ──
              <div className="p-4">
                <div className="flex items-start gap-2 mb-3">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <p className="text-[13px] font-semibold leading-snug">{selectedFaq.question}</p>
                </div>
                <div className="pl-6 text-[12px] leading-relaxed text-muted-foreground whitespace-pre-line">
                  {selectedFaq.answer.split("\n").map((line, i) => {
                    // Bold markdown
                    const parts = line.split(/(\*\*[^*]+\*\*)/g);
                    return (
                      <p key={i} className={line === "" ? "h-2" : "mb-1"}>
                        {parts.map((part, j) =>
                          part.startsWith("**") && part.endsWith("**") ? (
                            <strong key={j} className="font-semibold text-foreground">
                              {part.slice(2, -2)}
                            </strong>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : search.trim() ? (
              // ── Search results ──
              <div className="p-2">
                {filteredFaq.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <HelpCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No matching questions found</p>
                    <p className="text-[10px] mt-1">Try different keywords</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredFaq.map((faq) => (
                      <FaqButton key={faq.id} faq={faq} onClick={() => setSelectedFaq(faq)} />
                    ))}
                  </div>
                )}
              </div>
            ) : selectedCategory ? (
              // ── Category view ──
              <div className="p-2">
                <div className="space-y-0.5">
                  {filteredFaq.map((faq) => (
                    <FaqButton key={faq.id} faq={faq} onClick={() => setSelectedFaq(faq)} />
                  ))}
                </div>
              </div>
            ) : (
              // ── Home view ──
              <div className="p-3 space-y-4">
                {/* Context tips for repair detail */}
                {repairTips.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      For this repair
                    </p>
                    <div className="space-y-0.5">
                      {repairTips.map((tip) => (
                        <FaqButton key={tip.id} faq={tip} onClick={() => setSelectedFaq(tip)} highlight />
                      ))}
                    </div>
                  </div>
                )}

                {/* Relevant for this page */}
                {relevantFaq.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      Relevant for this page
                    </p>
                    <div className="space-y-0.5">
                      {relevantFaq.slice(0, 4).map((faq) => (
                        <FaqButton key={faq.id} faq={faq} onClick={() => setSelectedFaq(faq)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* All categories */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    Browse by topic
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(CATEGORY_CONFIG) as [FaqCategory, typeof CATEGORY_CONFIG[FaqCategory]][]).map(
                      ([key, config]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedCategory(key)}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]"
                        >
                          <span className={config.color}>{config.icon}</span>
                          <span className="text-[11px] font-medium">{config.label}</span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── FAQ Button ─────────────────────────────────────────────

function FaqButton({ faq, onClick, highlight }: { faq: FaqItem; onClick: () => void; highlight?: boolean }) {
  const config = CATEGORY_CONFIG[faq.category];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-2.5 group",
        highlight
          ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/50"
          : "hover:bg-muted/60",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", highlight ? "text-blue-500" : config?.color ?? "text-muted-foreground")}>
        {highlight ? <Lightbulb className="h-3.5 w-3.5" /> : <HelpCircle className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium leading-snug group-hover:text-foreground transition-colors">
          {faq.question}
        </p>
        {!highlight && config && (
          <span className="text-[10px] text-muted-foreground mt-0.5 inline-block">
            {config.label}
          </span>
        )}
      </div>
      <ChevronRight className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}
