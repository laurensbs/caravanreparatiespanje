"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X, ChevronRight, ArrowLeft,
  Wrench, Receipt, Users, FileText, Package, Lightbulb, HelpCircle,
  Zap, CheckCircle2, ArrowRight, Send, RotateCcw, Sparkles, Bot,
  ExternalLink, Truck, ClipboardList, Search, Plus, AlertCircle,
  ArrowUpRight, BarChart3, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAssistantContext, type AssistantPage, type AssistantAction, type RepairContext } from "@/components/assistant-context";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  keywords: string[];
  synonyms?: string[];
  relatedIds?: string[];
  pages?: string[];
  quickAction?: { label: string; href: string };
}

type FaqCategory =
  | "getting-started"
  | "work-orders"
  | "quotes-invoices"
  | "holded"
  | "parts-pricing"
  | "customers"
  | "garage"
  | "tips";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  faqId?: string;
  relatedIds?: string[];
  quickAction?: { label: string; href: string };
  action?: AssistantAction;
  timestamp: number;
}

// ─── Intent system ────────────────────────────────────────────

type IntentType = "question" | "navigate" | "action" | "debug";

interface Intent {
  type: IntentType;
  action?: AssistantAction;
  response?: string;
  faq?: FaqItem;
}

interface QuickActionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  intent: Intent;
  pages?: AssistantPage[];
  keywords: string[];
}

// ─── Category configuration ─────────────────────────────────

const CATEGORY_CONFIG: Record<FaqCategory, { label: string; icon: React.ReactNode; color: string }> = {
  "getting-started": {
    label: "Getting Started",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-[#0CC0DF]",
  },
  "work-orders": {
    label: "Work Orders",
    icon: <ClipboardList className="h-3.5 w-3.5" />,
    color: "text-blue-500",
  },
  "quotes-invoices": {
    label: "Quotes & Invoices",
    icon: <Receipt className="h-3.5 w-3.5" />,
    color: "text-emerald-500",
  },
  "holded": {
    label: "Holded Integration",
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-violet-500",
  },
  "parts-pricing": {
    label: "Parts & Pricing",
    icon: <Package className="h-3.5 w-3.5" />,
    color: "text-orange-500",
  },
  "customers": {
    label: "Customers",
    icon: <Users className="h-3.5 w-3.5" />,
    color: "text-pink-500",
  },
  "garage": {
    label: "Garage Portal",
    icon: <Truck className="h-3.5 w-3.5" />,
    color: "text-amber-500",
  },
  "tips": {
    label: "Tips & Tricks",
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    color: "text-yellow-500",
  },
};

// ─── FAQ data ─────────────────────────────────────────────────

const FAQ_ITEMS: FaqItem[] = [
  // ── Getting Started ────────────────────────────────
  {
    id: "what-is-this",
    question: "What is this system?",
    answer: "This is your **work order management system** for caravan repairs, wax treatments, maintenance, and inspections.\n\nIt replaces Excel spreadsheets with a professional workflow:\n• **Estimate** → **Quote** → **Work** → **Invoice** → **Paid**\n\nEverything syncs with **Holded** (quotes, invoices, contacts, payments).\n\nTechnicians use the **garage portal** to manage tasks, report findings, and request parts.",
    category: "getting-started",
    keywords: ["what", "system", "about", "this", "overview", "explain"],
    synonyms: ["what is this", "what does this do", "about this system", "how does this work"],
    relatedIds: ["main-workflow", "what-are-work-order-types"],
    pages: ["dashboard"],
  },
  {
    id: "main-workflow",
    question: "What is the main workflow?",
    answer: "Every work order follows these steps:\n\n1. **Create** a work order (choose type: Repair, Wax, Maintenance, or Inspection).\n2. **Estimate** — add parts (auto-markup) and labour hours.\n3. **Quote** — create in Holded, email to customer for approval.\n4. **Work** — do the job. Update estimate if you find extra issues.\n5. **Invoice** — create in Holded when work is done.\n6. **Paid** — payment syncs automatically from Holded.\n\nFor **wax treatments**, tasks are auto-generated. All types follow the same invoice workflow.",
    category: "getting-started",
    keywords: ["workflow", "flow", "steps", "process", "how", "main"],
    synonyms: ["how does it work", "main flow", "step by step", "process flow"],
    relatedIds: ["what-is-this", "what-are-work-order-types", "holded-connection"],
    pages: ["dashboard"],
  },
  {
    id: "where-to-start",
    question: "Where do I start?",
    answer: "Start by creating your first work order:\n\n1. Click **'+ New Work Order'** (top-right).\n2. Choose the type (Repair is the default).\n3. Select a customer and unit.\n4. Add a description.\n\nThen on the detail page:\n• Add parts → add labour → **Create Quote** → email it.\n• Do the work → **Create Invoice** → send it.\n\nPayment tracks automatically via Holded.",
    category: "getting-started",
    keywords: ["start", "begin", "first", "new", "how to"],
    synonyms: ["how to start", "first steps", "getting started", "begin using"],
    relatedIds: ["main-workflow", "create-work-order"],
    pages: ["dashboard"],
    quickAction: { label: "Create Work Order", href: "/repairs/new" },
  },
  {
    id: "navigation",
    question: "How do I navigate the system?",
    answer: "The sidebar has everything grouped:\n\n**Work**\n• **Work Orders** — all jobs (with filters, kanban board)\n• **Planning** — schedule and calendar views\n\n**Business**\n• **Contacts** — all customers (synced with Holded)\n• **Parts** — your parts catalog with markup pricing\n• **Units** — caravans and vehicles\n• **Invoices** — payment tracking\n\n**Quick search:** Press **Cmd+K** from anywhere to search for work orders, customers, parts, or pages.\n\nThe **garage portal** (/garage) is separate for technicians.",
    category: "getting-started",
    keywords: ["navigate", "sidebar", "menu", "pages", "find", "where"],
    synonyms: ["where is everything", "how to find", "menu items", "sidebar navigation"],
    relatedIds: ["quick-search", "what-is-this"],
  },

  // ── Work Orders ────────────────────────────────────
  {
    id: "create-work-order",
    question: "How do I create a work order?",
    answer: "Click **'+ New Work Order'** in the top-right corner.\n\nFill in:\n• **Type** — Repair, Wax Treatment, Maintenance, or Inspection.\n• **Customer** — select from the dropdown (synced from Holded).\n• **Unit** — the caravan/vehicle being worked on.\n• **Description** — what needs to be done.\n• **Location** — which workshop.\n• **Priority** — Normal, High, or Urgent.\n\nFor **Wax Treatments**, standard tasks are auto-generated after creation.",
    category: "work-orders",
    keywords: ["create", "new", "work order", "add", "make"],
    synonyms: ["new work order", "add a job", "create repair", "start new job"],
    relatedIds: ["what-are-work-order-types", "wax-auto-tasks", "main-workflow"],
    pages: ["repair-new", "repairs"],
    quickAction: { label: "New Work Order", href: "/repairs/new" },
  },
  {
    id: "what-are-work-order-types",
    question: "What are the work order types?",
    answer: "There are **four types** of work orders:\n\n• **Repair** — Standard damage fix (water damage, bodywork, structural). The default type.\n• **Wax Treatment** — Caravan waxing with auto-generated tasks. Great for seasonal maintenance.\n• **Maintenance** — Scheduled service jobs: annual checkups, seal replacements, general servicing.\n• **Inspection** — Pre-sale checks, insurance assessments, condition reports.\n\nEach type has a **colour-coded badge** on the work order card. You can **filter by type** on the overview page.\n\nAll types follow the same invoice workflow: estimate → quote → work → invoice → paid.",
    category: "work-orders",
    keywords: ["types", "repair", "wax", "maintenance", "inspection", "kind", "category"],
    synonyms: ["job types", "work order types", "what kinds", "type of work", "wax treatment", "inspection type"],
    relatedIds: ["create-work-order", "wax-auto-tasks", "type-filter"],
    pages: ["repairs", "repair-new"],
  },
  {
    id: "wax-auto-tasks",
    question: "How do wax treatments work?",
    answer: "When you create a work order with type **'Wax Treatment'**:\n\n1. Standard wax tasks are **automatically added** — cleaning, preparation, wax application, buffing, inspection.\n2. These tasks appear in the **garage portal** for technicians.\n3. Technicians check off each step as they complete it.\n4. You can still add custom tasks or modify the auto-generated ones.\n\nThe invoice workflow is the same: build estimate → create invoice → send → paid.\n\nThis saves setup time — no need to manually list every wax step.",
    category: "work-orders",
    keywords: ["wax", "treatment", "auto", "tasks", "automatic", "generated"],
    synonyms: ["wax job", "wax tasks", "auto generate", "wax workflow", "caravan wax"],
    relatedIds: ["what-are-work-order-types", "garage-tasks", "create-work-order"],
    pages: ["repair-new", "repair-detail"],
  },
  {
    id: "work-order-statuses",
    question: "What do the statuses mean?",
    answer: "Work orders move through these statuses:\n\n• **New** — Just created, not started.\n• **Assessing** — Being evaluated.\n• **Waiting Approval** — Quote sent, waiting for customer.\n• **Approved** — Customer approved, ready to start.\n• **In Progress** — Work is being done.\n• **Waiting Parts** — Paused, waiting for parts to arrive.\n• **Waiting Customer** — Waiting for customer response.\n• **Completed** — Work done, ready to invoice.\n• **Invoiced** — Invoice created.\n• **Archived** — Done and filed away.\n• **Rejected** — Customer declined.\n• **No Damage** — Inspection found nothing.\n\nUse the **Kanban board** to see all work orders grouped by status.",
    category: "work-orders",
    keywords: ["status", "statuses", "new", "in progress", "completed", "waiting", "meaning"],
    synonyms: ["what are statuses", "repair status", "status meaning", "job status"],
    relatedIds: ["create-work-order", "kanban-board"],
    pages: ["repairs", "repair-detail"],
  },
  {
    id: "type-filter",
    question: "How do I filter by work order type?",
    answer: "On the **Work Orders** page, the quick filter bar at the top has a **'Type'** dropdown.\n\nSelect one or more types to filter:\n• Repair\n• Wax Treatment\n• Maintenance\n• Inspection\n\nCombine with **status**, **search**, and **advanced filters** (priority, location, tags, date range) for precise results.\n\nActive filters show as **removable pills** below the filter bar.",
    category: "work-orders",
    keywords: ["filter", "type", "find", "search", "show", "only"],
    synonyms: ["filter by type", "show only repairs", "find wax jobs", "type filter"],
    relatedIds: ["what-are-work-order-types", "work-order-filters", "advanced-filters"],
    pages: ["repairs"],
  },
  {
    id: "cost-estimate",
    question: "How do I build a cost estimate?",
    answer: "On the work order detail page, scroll to **'Cost Estimate'**:\n\n1. **'+ Add Line'** — select a part from the catalog. Category tabs help filter. Selling price (cost + markup) fills automatically.\n2. **'+ Labour'** — add work hours. Rate comes from Settings → Pricing.\n3. **Custom line** — your own description and price.\n4. **Discount %** — set at the bottom if needed.\n\nTotal = (parts + labour - discount) + VAT.\n\nThis estimate becomes the basis for quotes and invoices.",
    category: "work-orders",
    keywords: ["estimate", "cost", "build", "add", "parts", "labour", "price"],
    synonyms: ["build estimate", "cost estimate", "add parts to estimate", "pricing"],
    relatedIds: ["add-parts-work-order", "hourly-rate", "create-quote"],
    pages: ["repair-detail"],
  },
  {
    id: "edit-work-order",
    question: "How do I edit a work order?",
    answer: "Everything is editable from the **work order detail page**:\n\n• **Status** — dropdown at the top.\n• **Priority** — dropdown next to status.\n• **Description** — click to edit inline.\n• **Tags** — '+' button in the status bar.\n• **Cost estimate** — add/remove/edit lines anytime.\n• **Internal notes** — for office-only information.\n\nChanges to the estimate automatically update linked quotes (before they're sent) and invoices (before they're created).",
    category: "work-orders",
    keywords: ["edit", "change", "modify", "update", "work order"],
    synonyms: ["change work order", "update job", "modify repair", "edit details"],
    relatedIds: ["cost-estimate", "work-order-statuses"],
    pages: ["repair-detail"],
  },
  {
    id: "work-order-filters",
    question: "What filters are available?",
    answer: "The work orders page has a **2-layer filter system**:\n\n**Quick bar** (always visible):\n• **Search** — by code, customer name, title.\n• **Status** — filter by status.\n• **Type** — Repair, Wax, Maintenance, Inspection.\n• **Filters button** — opens advanced panel.\n\n**Advanced panel** (popover):\n• Priority (Normal / High / Urgent)\n• Location (workshop)\n• Invoice status (Unpaid / Paid)\n• Response time\n• Tags\n• Date range\n\nActive filters show as **removable pills** with 'Clear all'.",
    category: "work-orders",
    keywords: ["filters", "search", "find", "overview", "sort"],
    synonyms: ["how to filter", "search work orders", "find jobs", "filter options"],
    relatedIds: ["type-filter", "quick-search", "kanban-board"],
    pages: ["repairs"],
  },
  {
    id: "delete-work-order",
    question: "Can I delete a work order?",
    answer: "Yes — on the work order detail page, scroll to the bottom → **delete button**.\n\nNote:\n• Removes from this system permanently.\n• Quotes/invoices already in Holded still exist there.\n• Cannot be undone.\n\n**Better alternative:** Set status to **'Archived'** — hides from active views but preserves the full history.",
    category: "work-orders",
    keywords: ["delete", "remove", "work order", "undo", "archive", "get rid"],
    synonyms: ["remove work order", "delete a job", "get rid of", "erase"],
    relatedIds: ["work-order-statuses", "edit-work-order"],
    pages: ["repair-detail"],
  },

  // ── Quotes & Invoices ─────────────────────────────
  {
    id: "create-quote",
    question: "How do I create and send a quote?",
    answer: "On the work order detail page:\n\n1. Build a **cost estimate** (parts + labour).\n2. In the right sidebar, click **'Create Quote'**.\n3. A Holded quote is created instantly with your company branding.\n4. Click **'Email'** to send the quote to the customer.\n5. Or click **'PDF'** to download and send manually.\n\nThe quote shows **selling prices** (cost + markup) — never your purchase price.",
    category: "quotes-invoices",
    keywords: ["quote", "create", "send", "offerte", "estimate"],
    synonyms: ["make a quote", "send quote", "create offerte", "quote customer"],
    relatedIds: ["create-invoice", "cost-estimate", "holded-connection"],
    pages: ["repair-detail"],
  },
  {
    id: "create-invoice",
    question: "How do I create and send an invoice?",
    answer: "When work is completed:\n\n1. Set status to **'Completed'** on the work order.\n2. In the right sidebar, click **'Create Invoice'**.\n3. A Holded invoice is created from your cost estimate.\n4. Click **'Email'** to send the invoice to the customer.\n\nPayment is tracked automatically — when the customer pays in Holded, the status updates here within 30 minutes.\n\nFor immediate cash payments: go to Invoices → click 'Unpaid' badge.",
    category: "quotes-invoices",
    keywords: ["invoice", "create", "send", "bill", "factuur"],
    synonyms: ["make invoice", "send invoice", "bill customer", "invoice creation", "create factuur"],
    relatedIds: ["create-quote", "payment-tracking", "mark-paid-manually"],
    pages: ["repair-detail"],
  },
  {
    id: "invoice-page",
    question: "What does the Invoices page show?",
    answer: "The Invoices page shows **all invoices from Holded**:\n\n• **Green badge** — Paid.\n• **Yellow badge** — Partially paid.\n• **Red badge** — Unpaid.\n\nFor each invoice: customer name, document number, linked work order, status, and PDF/Email actions.\n\nFilter by status (Unpaid / Partial / Paid) to see what needs attention.\n\nNote: Amounts are in Holded — this page focuses on status tracking.",
    category: "quotes-invoices",
    keywords: ["invoices", "page", "overview", "list", "show"],
    synonyms: ["invoices page", "invoice overview", "all invoices", "invoice list"],
    relatedIds: ["payment-tracking", "mark-paid-manually", "no-amounts"],
    pages: ["invoices"],
    quickAction: { label: "Go to Invoices", href: "/invoices" },
  },
  {
    id: "quote-vs-invoice",
    question: "What's the difference between a quote and invoice?",
    answer: "**Quote** (offerte):\n• Sent **before** the work starts.\n• Customer approves or rejects.\n• Shows the estimated cost.\n\n**Invoice** (factuur):\n• Sent **after** the work is done.\n• The actual bill for the customer to pay.\n• Based on the final cost estimate.\n\nBoth are created in **Holded** and can be emailed or downloaded as PDF.",
    category: "quotes-invoices",
    keywords: ["quote", "invoice", "difference", "offerte", "factuur", "versus", "vs"],
    synonyms: ["quote or invoice", "offerte vs factuur", "when quote when invoice", "difference between"],
    relatedIds: ["create-quote", "create-invoice", "main-workflow"],
    pages: ["repair-detail"],
  },

  // ── Holded Integration ─────────────────────────────
  {
    id: "holded-connection",
    question: "What is Holded and how does it connect?",
    answer: "**Holded** is the accounting/invoicing system. This system connects to Holded via API:\n\n• **Quotes** — Created here → appear instantly in Holded.\n• **Invoices** — Created here → appear instantly in Holded.\n• **Contacts** — Synced both ways every 6 hours.\n• **Payments** — When paid in Holded → status syncs here every 30 min.\n\nYou do NOT need to log into Holded for quotes/invoices — everything happens from here. But every document has an **'Open in Holded'** link for the full view.",
    category: "holded",
    keywords: ["holded", "what", "connect", "sync", "integration", "accounting"],
    synonyms: ["what is holded", "holded connection", "how holded works", "accounting system"],
    relatedIds: ["holded-sync", "holded-link", "payment-tracking"],
  },
  {
    id: "holded-sync",
    question: "How does the sync with Holded work?",
    answer: "The sync is automatic:\n\n• **Quotes & Invoices** — Created **instantly** when you click the button. No delay.\n• **Contacts** — Synced every **6 hours** in both directions.\n• **Payments** — Synced every **30 minutes**. When a customer pays in Holded, it shows here as 'Paid'.\n\nYou can also mark an invoice as paid manually for immediate updates.\n\nThe sync runs in the background — you don't need to do anything.",
    category: "holded",
    keywords: ["sync", "automatic", "how", "when", "contacts", "payments", "frequency"],
    synonyms: ["when does it sync", "sync frequency", "how often", "automatic update"],
    relatedIds: ["holded-connection", "customer-sync", "payment-tracking"],
  },
  {
    id: "holded-link",
    question: "Can I open things in Holded directly?",
    answer: "Yes! Every quote and invoice has an **'Open in Holded'** link.\n\nUse this when you need to:\n• See the official PDF layout.\n• Add payment information manually.\n• Make edits only available in Holded.\n• Check the full accounting view.\n\nChanges to payment status in Holded sync back here automatically.",
    category: "holded",
    keywords: ["holded", "open", "link", "directly", "website", "view"],
    synonyms: ["go to holded", "open in holded", "view in holded", "holded website"],
    relatedIds: ["holded-connection", "holded-sync"],
    pages: ["repair-detail", "invoices"],
  },
  {
    id: "payment-tracking",
    question: "How does payment tracking work?",
    answer: "Payment tracking is mostly **automatic**:\n\n1. You create and send an invoice from this system.\n2. The customer pays via bank transfer, iDEAL, or another method.\n3. Every **30 minutes**, this system checks Holded for payment updates.\n4. When paid, the invoice shows **green/Paid** here.\n\nFor immediate updates (cash, etc.):\n• On the **Invoices page** → click the red 'Unpaid' badge.\n• Marks it paid in both systems.\n\nNo more manual Excel tracking!",
    category: "holded",
    keywords: ["payment", "paid", "tracking", "automatic", "bank", "cash", "money"],
    synonyms: ["has customer paid", "payment status", "check payment", "when paid updates"],
    relatedIds: ["mark-paid-manually", "holded-sync", "invoice-page"],
    pages: ["invoices"],
  },

  // ── Parts & Pricing ────────────────────────────────
  {
    id: "how-parts-work",
    question: "How does the parts catalog work?",
    answer: "The **Parts** page is your catalog of all parts/materials:\n\n• Each part has a **cost price** (what you pay the supplier).\n• Each part can have a **markup %** (how much you charge on top).\n• If no markup is set, the **default markup** from Settings → Pricing is used.\n\n**Example:** Part costs €10, markup 40% → selling price €14.\n\nWhen adding a part to a cost estimate, the **selling price** fills automatically.\n\nParts are organised by **categories** (Tyres, Lights, Seals, etc.) — same categories appear in the garage for technician part requests.",
    category: "parts-pricing",
    keywords: ["parts", "catalog", "cost", "price", "how", "supplier"],
    synonyms: ["parts list", "part prices", "add new part", "parts page"],
    relatedIds: ["markup-explained", "add-parts-work-order", "hourly-rate"],
    pages: ["parts"],
    quickAction: { label: "Go to Parts", href: "/parts" },
  },
  {
    id: "markup-explained",
    question: "How does markup work? Will the customer see my cost price?",
    answer: "**No, the customer never sees your cost price.** Here's how markup works:\n\n• You set the **cost price** (what you pay) per part.\n• You set a **markup %** per part (or use the default from Settings).\n• **Selling price** = cost × (1 + markup/100).\n\n**Example:** Cost €50, markup 40% → Selling price €70. Your margin: €20.\n\nQuotes and invoices always show the **selling price**. Your cost price and markup are only visible to you.\n\nLabour uses a flat hourly rate from Settings → Pricing.",
    category: "parts-pricing",
    keywords: ["markup", "cost", "selling", "margin", "customer", "see", "price", "profit"],
    synonyms: ["does customer see price", "hide cost", "my margin", "profit margin"],
    relatedIds: ["how-parts-work", "add-parts-work-order", "hourly-rate"],
    pages: ["parts", "repair-detail"],
  },
  {
    id: "add-parts-work-order",
    question: "How do I add parts to a work order?",
    answer: "On the work order detail page, in the **Cost Estimate** section:\n\n1. Click **'+ Add Line'**.\n2. Select a part from the dropdown — use **category tabs** to filter.\n3. Set the **quantity**.\n4. Line total: quantity × selling price.\n\nAlso:\n• **'+ Labour'** — add work hours.\n• **Custom line** — your own description and price.\n• **Discount %** — set at the bottom.\n\nThe total (lines + VAT) is what appears on quotes and invoices.",
    category: "parts-pricing",
    keywords: ["add", "parts", "work order", "estimate", "line", "labour"],
    synonyms: ["put parts in", "add items", "add to estimate", "part to work order"],
    relatedIds: ["cost-estimate", "markup-explained", "discount"],
    pages: ["repair-detail"],
  },
  {
    id: "hourly-rate",
    question: "Where do I set the hourly labour rate?",
    answer: "Go to **Settings** (bottom of sidebar) → **Pricing** section.\n\nHere you can set:\n• **Hourly rate** — Rate charged per hour (excl. VAT).\n• **Default markup %** — Used for parts without their own markup.\n\nWhen you add labour: total = hours × hourly rate.\n\nExample: 3 hours × €42.50/hr = €127.50 + VAT.",
    category: "parts-pricing",
    keywords: ["hourly", "rate", "labour", "labor", "settings", "pricing", "per hour"],
    synonyms: ["labour rate", "work rate", "charge per hour", "price per hour"],
    relatedIds: ["how-parts-work", "cost-estimate"],
    pages: ["settings"],
    quickAction: { label: "Go to Settings", href: "/settings" },
  },

  // ── Customers ──────────────────────────────────────
  {
    id: "customer-sync",
    question: "Where do customers come from?",
    answer: "Customers come from **two sources**:\n\n1. **Holded** — Every 6 hours, all contacts from Holded sync here automatically.\n2. **Manual** — Add via Contacts → '+ New Customer'. They're pushed to Holded when you create a quote/invoice.\n\nNo need to maintain customers in two places — the sync handles it.\n\nMake sure every customer has an **email address** for sending quotes and invoices.",
    category: "customers",
    keywords: ["customer", "contact", "where", "come", "sync", "add", "new"],
    synonyms: ["add customer", "new customer", "where are customers", "customer list"],
    relatedIds: ["customer-email-important", "holded-sync"],
    pages: ["customers"],
    quickAction: { label: "View Contacts", href: "/customers" },
  },
  {
    id: "customer-email-important",
    question: "Why does the system need customer email?",
    answer: "Email is how quotes and invoices are delivered. When you click 'Email', Holded sends to that address.\n\n**Without email:**\n• You can still create quotes and invoices.\n• You can download PDFs.\n• But you **can't email** them from the system.\n\nTo add email: **Contacts** → click customer → edit email.\n\nThe system warns you when a customer is missing their email.",
    category: "customers",
    keywords: ["email", "why", "important", "customer", "send", "missing", "no email"],
    synonyms: ["customer email", "missing email", "need email", "add email", "why email"],
    relatedIds: ["customer-sync", "create-quote", "create-invoice"],
    pages: ["customers", "repair-detail"],
  },

  // ── Garage Portal ──────────────────────────────────
  {
    id: "garage-overview",
    question: "What is the garage portal?",
    answer: "The **garage portal** (/garage) is a separate, mobile-optimised view for technicians.\n\nTechnicians see:\n• **Today's work orders** — assigned to their location.\n• **Tasks** — checklist items to complete (auto-generated for wax jobs).\n• **Findings** — report unexpected issues with category and severity.\n• **Part requests** — request parts by category.\n\nThe garage portal is **read-focused** — technicians do the work, the office manages quotes and invoices.",
    category: "garage",
    keywords: ["garage", "portal", "technician", "mobile", "what"],
    synonyms: ["garage view", "technician view", "workshop portal", "garage page"],
    relatedIds: ["garage-tasks", "garage-findings", "garage-parts"],
    pages: ["dashboard", "repairs"],
  },
  {
    id: "garage-tasks",
    question: "How do tasks work in the garage?",
    answer: "Tasks are the **to-do list** for a work order:\n\n• Created by the office when setting up the work order.\n• For **wax jobs**, tasks are auto-generated (cleaning, prep, application, buffing, inspection).\n• Technicians see tasks in the garage portal and **check them off** as completed.\n• Progress is visible in real time from the office.\n\nYou can add, edit, or remove tasks at any time from the work order detail page.",
    category: "garage",
    keywords: ["tasks", "garage", "checklist", "todo", "complete"],
    synonyms: ["garage tasks", "task list", "check off", "technician tasks"],
    relatedIds: ["wax-auto-tasks", "garage-overview"],
    pages: ["repair-detail"],
  },
  {
    id: "garage-findings",
    question: "How do technicians report findings?",
    answer: "In the garage portal, technicians tap **'+ Finding'** to report issues:\n\n• **Category** — type of issue (structural, water damage, etc.).\n• **Severity** — how serious it is.\n• **Approval needed** — flag if customer approval is required before fixing.\n• **Description** — details about what was found.\n\nFindings appear **immediately** on the work order in the office. You can then:\n• Add the fix to the cost estimate.\n• Contact the customer for approval.\n• Update the quote if needed.",
    category: "garage",
    keywords: ["findings", "report", "issue", "technician", "damage", "found"],
    synonyms: ["report finding", "found issue", "unexpected damage", "technician report"],
    relatedIds: ["garage-overview", "garage-tasks"],
    pages: ["repair-detail"],
  },
  {
    id: "garage-parts",
    question: "How do technicians request parts?",
    answer: "In the garage portal, technicians tap **'+ Request Part'**:\n\n1. **Category chips** appear instantly (Tyres, Lights, Seals, etc.).\n2. Select a category to prefix the request.\n3. Type the specific part name.\n\nThe office sees requests immediately and can:\n• Check stock or order the part.\n• Add it to the cost estimate.\n\nCategories are shared between the parts catalog and the garage — create categories on the Parts page and they appear in the garage too.",
    category: "garage",
    keywords: ["parts", "request", "garage", "technician", "category", "order"],
    synonyms: ["request part", "need part", "order part", "part request garage"],
    relatedIds: ["how-parts-work", "garage-overview"],
    pages: ["repair-detail", "parts"],
  },
  {
    id: "office-vs-garage",
    question: "What's visible in the office vs the garage?",
    answer: "**Office** (this app) — full management:\n• Create & edit work orders, set status/priority.\n• Build cost estimates, create quotes & invoices.\n• Manage customers, parts catalog, pricing.\n• View findings and part requests from the garage.\n• Full filter system, kanban board, invoices page.\n\n**Garage portal** — work execution:\n• Today's assigned work orders.\n• Task checklists (check off completed items).\n• Report findings (issues, damage).\n• Request parts by category.\n• Mobile-optimised, focused interface.\n\nEverything syncs in **real time** between office and garage.",
    category: "garage",
    keywords: ["office", "garage", "difference", "visible", "see", "who"],
    synonyms: ["what can garage see", "office vs garage", "workshop view", "who sees what"],
    relatedIds: ["garage-overview", "what-is-this"],
    pages: ["dashboard"],
  },

  // ── Tips & Tricks ──────────────────────────────────
  {
    id: "quick-search",
    question: "How do I quickly find anything?",
    answer: "Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) from anywhere.\n\nSearch for:\n• Work orders (by code, customer name, title).\n• Customers.\n• Parts.\n• Pages.\n\nIt's the fastest way to navigate the system.",
    category: "tips",
    keywords: ["search", "find", "quick", "fast", "cmd", "ctrl", "k", "shortcut"],
    synonyms: ["keyboard shortcut", "find something", "search everything", "command k"],
    relatedIds: ["navigation", "work-order-filters"],
  },
  {
    id: "kanban-board",
    question: "Is there a visual overview of work orders?",
    answer: "Yes! Go to **Work Orders** → click **'Board'** (or go to /repairs/board).\n\nThis shows a **Kanban board** with work orders grouped by status in columns. See at a glance what's new, in progress, waiting, and completed.\n\nGreat for daily planning and team coordination.",
    category: "tips",
    keywords: ["board", "kanban", "visual", "overview", "columns", "drag"],
    synonyms: ["board view", "visual view", "column view", "overview board"],
    relatedIds: ["work-order-statuses", "work-order-filters"],
    pages: ["repairs"],
    quickAction: { label: "Open Kanban Board", href: "/repairs/board" },
  },
  {
    id: "communication-log",
    question: "How do I track communications?",
    answer: "On each **work order detail page**, there's a **Communication Log**:\n\n• Log phone calls, emails, and messages.\n• Each entry is timestamped.\n• Creates a full history of all contact about this job.\n\nUse it to track: when you called, what was discussed, what was agreed.",
    category: "tips",
    keywords: ["communication", "log", "phone", "call", "email", "track", "history"],
    synonyms: ["log a call", "track phone call", "note a conversation", "record communication"],
    relatedIds: ["edit-work-order"],
    pages: ["repair-detail"],
  },
  {
    id: "mark-paid-manually",
    question: "How do I manually mark an invoice as paid?",
    answer: "On the **Invoices** page:\n\n• Find the invoice (red 'Unpaid' badge).\n• **Click the 'Unpaid' badge** → marks it as paid.\n• Updates both this system AND Holded.\n\nUse for: cash payments, bank transfers that haven't synced yet, or immediate updates.\n\nNormally: payments sync from Holded automatically every 30 min.",
    category: "tips",
    keywords: ["mark", "paid", "manually", "cash", "update", "status", "unpaid"],
    synonyms: ["customer paid cash", "manually pay", "set as paid", "force paid"],
    relatedIds: ["payment-tracking", "invoice-page"],
    pages: ["invoices"],
  },
  {
    id: "discount",
    question: "How do I apply a discount?",
    answer: "In the work order's **Cost Estimate** section, at the bottom: **Discount %** field.\n\nSet a percentage (e.g. 10%) → applied to total before VAT.\n\nExample: Estimate €500, discount 10% = €450 + VAT.\n\nThe discount shows on both the quote and invoice.",
    category: "tips",
    keywords: ["discount", "percentage", "reduce", "price", "lower", "korting"],
    synonyms: ["give discount", "reduce price", "lower price", "apply discount"],
    relatedIds: ["cost-estimate", "create-quote"],
    pages: ["repair-detail"],
  },
  {
    id: "multiple-locations",
    question: "How do workshops/locations work?",
    answer: "The system supports **multiple workshop locations**.\n\n• Each work order is assigned to a **location** when created.\n• The Dashboard shows a **By Location** breakdown.\n• Filter work orders by location on the overview page.\n• The garage portal shows work orders for each location.\n\nManage locations in **Settings → Locations**.",
    category: "tips",
    keywords: ["location", "workshop", "locations", "where"],
    synonyms: ["which workshop", "where is it", "different locations", "workshop locations"],
    relatedIds: ["create-work-order", "work-order-filters"],
    pages: ["settings"],
    quickAction: { label: "Manage Locations", href: "/settings/locations" },
  },
  {
    id: "priority-levels",
    question: "What are the priority levels?",
    answer: "Work orders have three priority levels:\n\n• **Normal** — Standard queue.\n• **High** — Needs attention soon.\n• **Urgent** — Drop everything, fix this first.\n\nUrgent work orders show a **red badge** everywhere and appear in the Dashboard's 'Urgent' count.\n\nChange priority in the work order detail page via the dropdown.",
    category: "tips",
    keywords: ["priority", "urgent", "high", "normal", "important"],
    synonyms: ["set priority", "urgent work order", "important job", "priority levels"],
    relatedIds: ["create-work-order", "work-order-statuses"],
    pages: ["repair-detail", "repairs"],
  },
  {
    id: "vat-tax",
    question: "How is VAT/tax handled?",
    answer: "VAT is applied automatically:\n\n• The default tax rate is set in **Settings → Pricing** (typically 21% IVA).\n• Cost estimates show subtotal + VAT separately.\n• Quotes and invoices include VAT automatically via Holded.\n\nAll selling prices in the estimate are **excl. VAT**. VAT is added on the total.",
    category: "tips",
    keywords: ["vat", "tax", "iva", "btw", "21", "percent"],
    synonyms: ["how much tax", "iva percentage", "tax rate", "vat included"],
    relatedIds: ["cost-estimate", "hourly-rate"],
    pages: ["repair-detail", "settings"],
  },
  {
    id: "no-amounts",
    question: "Why can't I see amounts on the invoices page?",
    answer: "The invoices page shows **statuses** rather than amounts. This keeps the overview clean and focused on: which are paid, which need attention.\n\nTo see full amounts:\n• Click the **invoice number** → opens in Holded.\n• Or go to the **work order detail** (linked in the table).\n\nAll amounts are always available in Holded. This system focuses on workflow tracking.",
    category: "tips",
    keywords: ["amounts", "money", "total", "see", "where", "numbers", "invoices"],
    synonyms: ["where are the amounts", "no money visible", "totals missing", "invoice amounts"],
    relatedIds: ["invoice-page", "holded-link"],
    pages: ["invoices"],
  },
  {
    id: "data-safe",
    question: "Is my data safe?",
    answer: "Your data is in **two secure places**:\n\n1. **This system** — Neon (PostgreSQL cloud). Work orders, customers, parts, estimates, notes, audit logs.\n2. **Holded** — All official documents (quotes, invoices, contacts).\n\nHosted on **Vercel** — professional cloud platform.\n\nAutomatic backups on both. Much safer than a local Excel file!",
    category: "tips",
    keywords: ["data", "safe", "backup", "stored", "where", "secure", "lost"],
    synonyms: ["data safety", "is it backed up", "lose data", "where stored"],
    relatedIds: ["holded-connection"],
  },
  {
    id: "advanced-filters",
    question: "How do advanced filters work?",
    answer: "Click the **'Filters'** button on the Work Orders page to open the advanced panel:\n\n• **Priority** — Normal / High / Urgent.\n• **Location** — filter by workshop.\n• **Invoice status** — show only paid or unpaid.\n• **Response time** — how quickly the job was started.\n• **Tags** — filter by assigned tags.\n• **Date range** — filter by creation date.\n\nActive filters show as **pills** below the filter bar. Click × to remove individual filters, or 'Clear all' to reset.\n\nCombine with the quick filters (search, status, type) for precise results.",
    category: "tips",
    keywords: ["advanced", "filters", "panel", "popover", "priority", "date"],
    synonyms: ["filter panel", "more filters", "advanced search", "filter options"],
    relatedIds: ["work-order-filters", "type-filter"],
    pages: ["repairs"],
  },
];

// ─── Fuzzy search scoring ─────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
}

function scoreFaq(faq: FaqItem, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  let score = 0;
  const queryTokens = tokenize(q);

  // Exact phrase match in question (highest)
  if (faq.question.toLowerCase().includes(q)) score += 100;

  // Exact phrase match in synonyms
  if (faq.synonyms?.some((s) => s.includes(q))) score += 90;

  // Exact phrase match in keywords
  if (faq.keywords.some((k) => k.includes(q))) score += 80;

  // Word-level matching
  for (const token of queryTokens) {
    if (faq.question.toLowerCase().includes(token)) score += 15;
    if (faq.keywords.includes(token)) score += 20;
    if (faq.synonyms?.some((s) => s.includes(token))) score += 12;
    if (faq.answer.toLowerCase().includes(token)) score += 3;
  }

  // Boost for coverage
  const matchedTokens = queryTokens.filter(
    (t) =>
      faq.question.toLowerCase().includes(t) ||
      faq.keywords.includes(t) ||
      faq.synonyms?.some((s) => s.includes(t)) ||
      faq.answer.toLowerCase().includes(t),
  ).length;
  const coverage = matchedTokens / queryTokens.length;
  score *= 0.5 + coverage * 0.5;

  return score;
}

function searchFaq(query: string, allItems: FaqItem[], threshold = 8): { faq: FaqItem; score: number }[] {
  return allItems
    .map((faq) => ({ faq, score: scoreFaq(faq, query) }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

// ─── Quick actions (action-first, not question-first) ─────────

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: "qa-new-work-order",
    label: "Create work order",
    icon: <Plus className="h-3.5 w-3.5" />,
    intent: { type: "action", action: { type: "open-modal", modal: "new-work-order" } },
    keywords: ["create", "new", "work order", "add", "make", "job"],
    pages: ["dashboard", "repairs", "repair-detail", "customers"],
  },
  {
    id: "qa-urgent-jobs",
    label: "Show urgent jobs",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate-filter", href: "/repairs", filters: { priority: "urgent" } } },
    keywords: ["urgent", "show", "jobs", "priority", "important"],
    pages: ["dashboard", "repairs"],
  },
  {
    id: "qa-waiting-parts",
    label: "Waiting for parts",
    icon: <Package className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate-filter", href: "/repairs", filters: { status: "waiting_parts" } } },
    keywords: ["waiting", "parts", "stuck", "pending", "blocked"],
  },
  {
    id: "qa-kanban",
    label: "Open kanban board",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/repairs/board" } },
    keywords: ["kanban", "board", "visual", "overview", "columns"],
  },
  {
    id: "qa-contacts",
    label: "Go to contacts",
    icon: <Users className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/customers" } },
    keywords: ["contacts", "customers", "clients"],
  },
  {
    id: "qa-parts",
    label: "Go to parts",
    icon: <Package className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/parts" } },
    keywords: ["parts", "catalog", "materials"],
  },
  {
    id: "qa-invoices",
    label: "Go to invoices",
    icon: <Receipt className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/invoices" } },
    keywords: ["invoices", "billing", "payments", "unpaid"],
  },
  {
    id: "qa-garage",
    label: "Open garage",
    icon: <Truck className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/garage" } },
    keywords: ["garage", "workshop", "technician", "portal"],
  },
  {
    id: "qa-search",
    label: "Quick search (⌘K)",
    icon: <Search className="h-3.5 w-3.5" />,
    intent: { type: "action", action: { type: "open-command-palette" } },
    keywords: ["search", "find", "quick", "cmd", "command"],
  },
  {
    id: "qa-explain-status",
    label: "Explain statuses",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
    intent: { type: "question", faq: FAQ_ITEMS.find((f) => f.id === "work-order-statuses") },
    keywords: ["status", "explain", "meaning", "what"],
  },
  {
    id: "qa-new-wax",
    label: "New wax job",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    intent: { type: "action", action: { type: "open-modal", modal: "new-work-order", prefill: { jobType: "wax" } } },
    keywords: ["wax", "treatment", "new", "create"],
  },
  {
    id: "qa-in-progress",
    label: "In-progress jobs",
    icon: <Wrench className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate-filter", href: "/repairs", filters: { status: "in_progress" } } },
    keywords: ["in progress", "active", "working", "current"],
  },
  {
    id: "qa-unpaid",
    label: "Unpaid invoices",
    icon: <Receipt className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate-filter", href: "/invoices", filters: { status: "unpaid" } } },
    keywords: ["unpaid", "overdue", "outstanding", "money", "owing"],
  },
  {
    id: "qa-settings",
    label: "Settings",
    icon: <Settings className="h-3.5 w-3.5" />,
    intent: { type: "navigate", action: { type: "navigate", href: "/settings" } },
    keywords: ["settings", "config", "pricing", "markup"],
  },
];

// ─── Intent detection ─────────────────────────────────────────

const NAV_PATTERNS: [RegExp, AssistantAction][] = [
  [/^(?:go to|open|show|navigate to)\s+(?:work\s*orders?|repairs?|jobs?)$/i, { type: "navigate", href: "/repairs" }],
  [/^(?:go to|open|show)\s+(?:kanban|board)$/i, { type: "navigate", href: "/repairs/board" }],
  [/^(?:go to|open|show)\s+(?:contacts?|customers?)$/i, { type: "navigate", href: "/customers" }],
  [/^(?:go to|open|show)\s+(?:parts?|catalog)$/i, { type: "navigate", href: "/parts" }],
  [/^(?:go to|open|show)\s+(?:invoices?|billing)$/i, { type: "navigate", href: "/invoices" }],
  [/^(?:go to|open|show)\s+(?:settings?|config)$/i, { type: "navigate", href: "/settings" }],
  [/^(?:go to|open|show)\s+(?:garage|workshop)$/i, { type: "navigate", href: "/garage" }],
  [/^(?:go to|open|show)\s+(?:planning|calendar|schedule)$/i, { type: "navigate", href: "/planning" }],
  [/^(?:go to|open|show)\s+(?:audit|log)$/i, { type: "navigate", href: "/audit" }],
  [/^(?:go to|open|show)\s+(?:dashboard|home)$/i, { type: "navigate", href: "/" }],
  [/^(?:show|open|go to)\s+urgent\s+(?:jobs|repairs|work\s*orders)?$/i, { type: "navigate-filter", href: "/repairs", filters: { priority: "urgent" } }],
  [/^(?:show|open|go to)\s+(?:waiting|blocked)\s+(?:parts?|jobs|repairs)?$/i, { type: "navigate-filter", href: "/repairs", filters: { status: "waiting_parts" } }],
  [/^(?:show|open|go to)\s+in.?progress\s+(?:jobs|repairs|work\s*orders)?$/i, { type: "navigate-filter", href: "/repairs", filters: { status: "in_progress" } }],
  [/^(?:show|open|go to)\s+completed?\s+(?:jobs|repairs|work\s*orders)?$/i, { type: "navigate-filter", href: "/repairs", filters: { status: "completed" } }],
  [/^(?:show|open|go to)\s+new\s+(?:jobs|repairs|work\s*orders)$/i, { type: "navigate-filter", href: "/repairs", filters: { status: "new" } }],
  [/^(?:show|open|go to)\s+unpaid\s+(?:invoices?)?$/i, { type: "navigate-filter", href: "/invoices", filters: { status: "unpaid" } }],
];

const ACTION_PATTERNS: [RegExp, (match: RegExpExecArray) => AssistantAction | null][] = [
  [/^(?:create|new|add)\s+(?:work\s*order|repair|job)(?:\s+(?:for|:)\s+(.+))?$/i, (m) => ({
    type: "open-modal" as const, modal: "new-work-order" as const, prefill: m[1] ? { title: m[1] } : undefined,
  })],
  [/^(?:create|new|add)\s+wax\s+(?:job|treatment|work\s*order)(?:\s+(?:for|:)\s+(.+))?$/i, (m) => ({
    type: "open-modal" as const, modal: "new-work-order" as const, prefill: { jobType: "wax", ...(m[1] ? { title: m[1] } : {}) },
  })],
  [/^(?:create|new|add)\s+(?:maintenance|service)\s+(?:job|work\s*order)(?:\s+(?:for|:)\s+(.+))?$/i, (m) => ({
    type: "open-modal" as const, modal: "new-work-order" as const, prefill: { jobType: "maintenance", ...(m[1] ? { title: m[1] } : {}) },
  })],
  [/^(?:create|new|add)\s+inspection(?:\s+(?:for|:)\s+(.+))?$/i, (m) => ({
    type: "open-modal" as const, modal: "new-work-order" as const, prefill: { jobType: "inspection", ...(m[1] ? { title: m[1] } : {}) },
  })],
  [/^(?:search|find)\b/i, () => ({ type: "open-command-palette" as const })],
];

const DEBUG_PATTERNS: [RegExp, (ctx?: RepairContext) => string][] = [
  [/why\s+(?:is\s+(?:this|it)?\s+)?not\s+invoiced/i, (ctx) => {
    const job = ctx?.job;
    if (!job) return "I can't see which work order you mean. Open a work order first, then ask again.";
    if (job.holdedInvoiceId) return "This work order **does** have an invoice (Holded ID: " + job.holdedInvoiceId + "). Check the Invoices page for its status.";
    if (!job.estimatedCost || parseFloat(job.estimatedCost) === 0) return "This work order has **no cost estimate** yet. Build an estimate first (add parts + labour), then create the invoice.";
    if (!job.holdedQuoteId) return "There's a cost estimate but **no quote** was created yet. Create a quote first, then after the work is done, create the invoice.";
    if (["new", "assessing", "waiting_approval"].includes(job.status)) return "The work order is still in **" + job.status.replace(/_/g, " ") + "** status. It needs to reach **Completed** before you should invoice.";
    return "The estimate and quote are ready. You can create the invoice now — go to the sidebar and click **'Create Invoice'**.";
  }],
  [/why\s+(?:is\s+(?:this|it)?\s+)?(?:stuck|waiting|blocked)/i, (ctx) => {
    const job = ctx?.job;
    if (!job) return "Open a work order first so I can check its status.";
    if (job.status === "waiting_parts") return "This job is in **Waiting Parts** status. Check the parts section — are all parts received? Once parts arrive, update the status.";
    if (job.status === "waiting_customer") return "Waiting on the **customer**. Was a quote sent? Check the communication log for the last contact.";
    const daysSince = Math.floor((Date.now() - new Date(job.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 7) return "This job hasn't been updated in **" + daysSince + " days**. It might need a status update or follow-up.";
    return "The status is **" + (job.status || "unknown").replace(/_/g, " ") + "**. Check if there are unfinished tasks, missing parts, or pending approvals.";
  }],
  [/why\s+(?:is\s+(?:this|it)?\s+)?not\s+paid/i, (ctx) => {
    const job = ctx?.job;
    if (!job) return "Open a work order to check its payment status.";
    if (!job.holdedInvoiceId) return "No invoice has been created yet. Create the invoice first, then send it to the customer.";
    if (job.invoiceStatus === "paid") return "This invoice **is** marked as paid!";
    return "The invoice has been created but payment hasn't been recorded yet.\n\nPayments sync from Holded every **30 minutes**. For cash/immediate payments, go to the **Invoices** page and click the 'Unpaid' badge.";
  }],
];

function detectIntent(query: string, context?: RepairContext): Intent {
  const q = query.trim();

  for (const [pattern, action] of NAV_PATTERNS) {
    if (pattern.test(q)) return { type: "navigate", action };
  }
  for (const [pattern, factory] of ACTION_PATTERNS) {
    const match = pattern.exec(q);
    if (match) {
      const action = factory(match);
      if (action) return { type: "action", action };
    }
  }
  for (const [pattern, handler] of DEBUG_PATTERNS) {
    if (pattern.test(q)) return { type: "debug", response: handler(context) };
  }

  const results = searchFaq(q, FAQ_ITEMS);
  if (results.length > 0 && results[0].score >= 20) {
    return { type: "question", faq: results[0].faq };
  }
  return { type: "question" };
}

// ─── Search quick actions ─────────────────────────────────────

function searchQuickActions(query: string, page: AssistantPage): QuickActionDef[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const tokens = tokenize(q);

  return QUICK_ACTIONS.map((qa) => {
    let score = 0;
    if (qa.label.toLowerCase().includes(q)) score += 100;
    for (const t of tokens) {
      if (qa.label.toLowerCase().includes(t)) score += 30;
      if (qa.keywords.some((k) => k.includes(t))) score += 20;
    }
    if (qa.pages?.includes(page)) score += 5;
    return { qa, score };
  })
    .filter((r) => r.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.qa);
}

// ─── Dynamic work order context tips ──────────────────────────

function getWorkOrderTips(context?: RepairContext): FaqItem[] {
  const job = context?.job;
  if (!job) return [];

  const tips: FaqItem[] = [];
  const hasEstimate = !!(job.estimatedCost && parseFloat(job.estimatedCost) > 0);
  const hasQuote = !!job.holdedQuoteId;
  const hasInvoice = !!job.holdedInvoiceId;
  const isPaid = job.invoiceStatus === "paid";
  const isActive = !["completed", "invoiced", "archived"].includes(job.status);
  const daysSinceUpdated = Math.floor(
    (Date.now() - new Date(job.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const customerName = job.customer?.name || job.customerName || "the customer";
  const jobType = job.jobType || "repair";

  if (!hasEstimate && !hasInvoice) {
    tips.push({
      id: "tip-no-estimate",
      question: "Next step: Build cost estimate for " + customerName,
      answer: "This " + jobType + " for **" + customerName + "** needs a cost estimate.\n\nScroll to the **Cost Estimate** section:\n1. Click **'+ Add Line'** to add parts (markup applied automatically).\n2. Click **'+ Labour'** to add work hours.\n3. Optionally set a discount %.\n\nOnce ready, create a quote to send to the customer.",
      category: "tips",
      keywords: [],
    });
  } else if (hasEstimate && !hasQuote && !hasInvoice) {
    tips.push({
      id: "tip-ready-for-quote",
      question: "Next step: Create a quote for " + customerName,
      answer: "Your cost estimate is ready (\u20ac" + parseFloat(job.estimatedCost).toFixed(2) + ").\n\nClick **'Create Quote'** in the right sidebar to generate a Holded quote. Then click **'Email'** to send it to " + customerName + ".\n\n" + (job.customer?.email ? "The quote will be sent to: **" + job.customer.email + "**" : "\u26a0\ufe0f " + customerName + " has no email. Add it in their contact page first."),
      category: "tips",
      keywords: [],
    });
  } else if (hasQuote && !hasInvoice && isActive) {
    tips.push({
      id: "tip-doing-work",
      question: "Quote sent — " + jobType + " in progress",
      answer: "The quote for **" + customerName + "** was sent.\n\nIf you find extra issues during the work, add more lines to the cost estimate.\n\nWhen finished:\n1. Change status to **'Completed'**.\n2. Click **'Create Invoice'** in the sidebar.\n3. Send the invoice via email.",
      category: "tips",
      keywords: [],
    });
  } else if (hasQuote && !hasInvoice && !isActive) {
    tips.push({
      id: "tip-ready-for-invoice",
      question: "Next step: Create invoice for " + customerName,
      answer: "The " + jobType + " for **" + customerName + "** is completed. Time to invoice!\n\nClick **'Create Invoice'** in the sidebar. Then click **'Email'** to send it.",
      category: "tips",
      keywords: [],
    });
  } else if (hasInvoice && !isPaid) {
    tips.push({
      id: "tip-waiting-payment",
      question: "Waiting for payment from " + customerName,
      answer: "The invoice for **" + customerName + "** has been created.\n\nPayment tracking is automatic — when they pay in Holded, it shows here within 30 minutes.\n\nTo mark paid manually (e.g. cash): go to **Invoices** page → click the 'Unpaid' badge.",
      category: "tips",
      keywords: [],
    });
  } else if (isPaid) {
    tips.push({
      id: "tip-all-done",
      question: "Work order completed and paid!",
      answer: "Everything is done for **" + customerName + "**! Quote sent, work completed, invoice paid.\n\nYou can archive this work order or keep it as reference.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.customer && !job.customer.email && !isPaid) {
    tips.push({
      id: "tip-no-email",
      question: customerName + " has no email address",
      answer: "**" + customerName + "** doesn't have an email address. You can still create documents, but can't email them.\n\nAdd their email: go to **Contacts** \u2192 find " + customerName + " \u2192 edit email.",
      category: "tips",
      keywords: [],
      quickAction: job.customer?.id ? { label: "Edit " + customerName, href: "/customers/" + job.customer.id } : undefined,
    });
  }

  if (daysSinceUpdated >= 7 && isActive) {
    tips.push({
      id: "tip-stale",
      question: "No updates for " + daysSinceUpdated + " days",
      answer: "This work order hasn't been updated in **" + daysSinceUpdated + " days**.\n\nConsider:\n\u2022 Is it still active? Update the status.\n\u2022 Waiting on something? Change to 'Waiting Parts' or 'Waiting Customer'.\n\u2022 Done? Set 'Completed' and create the invoice.\n\u2022 No longer needed? Archive it.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.safetyFlag && isActive) {
    tips.push({
      id: "tip-safety",
      question: "Safety concern flagged",
      answer: "This work order has a **safety flag**. Prioritize the safety-related work first and ensure the customer is informed about any safety risks.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.waterDamageRiskFlag && isActive) {
    tips.push({
      id: "tip-water",
      question: "Water damage risk flagged",
      answer: "This work order has a **water damage risk flag**. Address this promptly — water damage tends to get worse quickly. Consider temporary protection if the full repair will take time.",
      category: "tips",
      keywords: [],
    });
  }

  return tips;
}

// ─── Markdown renderer ────────────────────────────────────────

function RenderMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => {
        if (line === "") return <div key={i} className="h-1.5" />;

        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const rendered = parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        );

        if (line.match(/^[•\-\d]+[\.\)]\s/) || line.startsWith("• ")) {
          return <p key={i} className="mb-0.5 pl-1">{rendered}</p>;
        }

        return <p key={i} className="mb-0.5">{rendered}</p>;
      })}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────

const PAGE_LABELS: Record<AssistantPage, string> = {
  "dashboard": "Dashboard",
  "repairs": "Work Orders",
  "repair-detail": "Work Order Detail",
  "repair-new": "New Work Order",
  "customers": "Contacts",
  "parts": "Parts",
  "invoices": "Invoices",
  "units": "Units",
  "settings": "Settings",
  "planning": "Planning",
  "audit": "Audit Log",
  "feedback": "Feedback",
};

const PAGE_RELEVANT_CATEGORIES: Record<AssistantPage, FaqCategory[]> = {
  "dashboard": ["getting-started", "garage"],
  "repairs": ["work-orders", "getting-started"],
  "repair-detail": ["work-orders", "quotes-invoices", "parts-pricing"],
  "repair-new": ["work-orders", "getting-started"],
  "customers": ["customers", "holded"],
  "parts": ["parts-pricing", "garage"],
  "invoices": ["quotes-invoices", "holded"],
  "units": ["getting-started"],
  "settings": ["parts-pricing", "tips"],
  "planning": ["work-orders"],
  "audit": ["tips"],
  "feedback": ["tips"],
};

const PAGE_QUICK_ACTIONS: Record<AssistantPage, string[]> = {
  "dashboard": ["qa-new-work-order", "qa-urgent-jobs", "qa-kanban", "qa-search"],
  "repairs": ["qa-new-work-order", "qa-urgent-jobs", "qa-waiting-parts", "qa-kanban"],
  "repair-detail": ["qa-new-work-order", "qa-explain-status", "qa-parts"],
  "repair-new": ["qa-explain-status", "qa-new-wax"],
  "customers": ["qa-contacts", "qa-search"],
  "parts": ["qa-parts", "qa-search"],
  "invoices": ["qa-unpaid", "qa-invoices"],
  "units": ["qa-search"],
  "settings": ["qa-settings"],
  "planning": ["qa-new-work-order", "qa-kanban"],
  "audit": ["qa-search"],
  "feedback": ["qa-search"],
};

interface SmartAssistantProps {
  page: AssistantPage;
  context?: RepairContext;
}

export function SmartAssistant({ page, context }: SmartAssistantProps) {
  const { open, setOpen, dispatchAction } = useAssistantContext();
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Backward compat: listen for legacy window event too
  useEffect(() => {
    function handleToggle() {
      setOpen(!open);
    }
    window.addEventListener("toggle-assistant", handleToggle);
    return () => window.removeEventListener("toggle-assistant", handleToggle);
  }, [open, setOpen]);

  const workOrderTips = useMemo(
    () => (page === "repair-detail" ? getWorkOrderTips(context) : []),
    [page, context],
  );

  const relevantCategories = PAGE_RELEVANT_CATEGORIES[page] ?? [];
  const relevantFaq = useMemo(
    () => FAQ_ITEMS.filter(
      (f) => relevantCategories.includes(f.category) || f.pages?.includes(page),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page],
  );

  // Input suggestions (live as you type)
  const inputSuggestions = useMemo(() => {
    if (!inputValue.trim() || inputValue.length < 2) return [];
    return searchQuickActions(inputValue, page);
  }, [inputValue, page]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        if (selectedCategory) setSelectedCategory(null);
        else setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedCategory, setOpen]);

  // Execute an action
  const executeAction = useCallback((action: AssistantAction) => {
    setOpen(false);
    if (action.type === "navigate") {
      router.push(action.href);
    } else if (action.type === "navigate-filter") {
      const params = new URLSearchParams(action.filters);
      router.push(action.href + "?" + params.toString());
    } else if (action.type === "open-command-palette") {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    } else {
      dispatchAction(action);
    }
  }, [router, setOpen, dispatchAction]);

  const answerQuestion = useCallback((query: string, faqOverride?: FaqItem) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      // Direct FAQ override (from clicking a topic)
      if (faqOverride) {
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: faqOverride.answer,
          faqId: faqOverride.id,
          relatedIds: faqOverride.relatedIds,
          quickAction: faqOverride.quickAction,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
        return;
      }

      const intent = detectIntent(query, context);

      if (intent.type === "navigate" && intent.action) {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Taking you there now →",
          action: intent.action,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
        setIsTyping(false);
        setTimeout(() => executeAction(intent.action!), 400);
        return;
      }

      if (intent.type === "action" && intent.action) {
        let actionLabel = "Done.";
        if (intent.action.type === "open-modal") {
          const prefill = intent.action.prefill;
          actionLabel = "Opening new work order" + (prefill?.title ? ": **" + prefill.title + "**" : "") + (prefill?.jobType ? " (type: " + prefill.jobType + ")" : "") + "…";
        } else if (intent.action.type === "open-command-palette") {
          actionLabel = "Opening search…";
        }
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: actionLabel,
          action: intent.action,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
        setIsTyping(false);
        setTimeout(() => executeAction(intent.action!), 400);
        return;
      }

      if (intent.type === "debug" && intent.response) {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: intent.response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
        setIsTyping(false);
        return;
      }

      // FAQ answer
      if (intent.faq) {
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: intent.faq.answer,
          faqId: intent.faq.id,
          relatedIds: intent.faq.relatedIds,
          quickAction: intent.faq.quickAction,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
        setIsTyping(false);
        return;
      }

      // Fallback
      const suggested = relevantFaq.slice(0, 3);
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I'm not sure about that. Try one of these:\n\n" + suggested.map((f) => "• **" + f.question + "**").join("\n") + "\n\nOr try a command like **\"show urgent jobs\"** or **\"create work order\"**.",
        relatedIds: suggested.map((f) => f.id),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, msg]);
      setIsTyping(false);
    }, 200 + Math.random() * 200);
  }, [context, relevantFaq, executeAction]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    answerQuestion(inputValue.trim());
  }

  function handleQuickActionClick(qa: QuickActionDef) {
    if (qa.intent.type === "question") {
      // FAQ-style — ask the question
      answerQuestion(qa.label);
    } else {
      // Action — execute directly
      const intent = detectIntent(qa.label);
      if (intent?.action) {
        executeAction(intent.action);
      } else {
        answerQuestion(qa.label);
      }
    }
  }

  function handleSuggestionClick(qa: QuickActionDef) {
    setInputValue("");
    handleQuickActionClick(qa);
  }

  function handleRelatedClick(faqId: string) {
    const faq = FAQ_ITEMS.find((f) => f.id === faqId);
    if (faq) {
      answerQuestion(faq.question, faq);
    }
  }

  function handleTipClick(tip: FaqItem) {
    answerQuestion(tip.question, tip);
  }

  function handleCategoryFaqClick(faq: FaqItem) {
    setSelectedCategory(null);
    answerQuestion(faq.question, faq);
  }

  function handleReset() {
    setMessages([]);
    setSelectedCategory(null);
    setInputValue("");
  }

  const pageQuickActions = (PAGE_QUICK_ACTIONS[page] ?? [])
    .map((id) => QUICK_ACTIONS.find((qa) => qa.id === id))
    .filter((qa): qa is QuickActionDef => !!qa);
  const showHome = messages.length === 0 && !selectedCategory;

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed top-14 right-5 z-50 w-[400px] max-h-[min(600px,calc(100vh-5rem))] flex flex-col rounded-2xl border border-gray-200 dark:border-border bg-white dark:bg-card shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Header — Mollie-style gradient */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-border bg-gradient-to-r from-[#0CC0DF] to-[#0AA0C0] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {selectedCategory ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
                    onClick={() => setSelectedCategory(null)}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/15">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-[13px] font-semibold text-white">
                    {selectedCategory ? CATEGORY_CONFIG[selectedCategory].label : "Smart Assistant"}
                  </h3>
                  <p className="text-[10px] text-white/50">
                    {selectedCategory
                      ? FAQ_ITEMS.filter((f) => f.category === selectedCategory).length + " questions"
                      : PAGE_LABELS[page]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && !selectedCategory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
                    onClick={handleReset}
                    title="New conversation"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
            {selectedCategory ? (
              /* Category browse */
              <div className="p-2 space-y-0.5">
                {FAQ_ITEMS.filter((f) => f.category === selectedCategory).map((faq) => (
                  <button
                    key={faq.id}
                    type="button"
                    onClick={() => handleCategoryFaqClick(faq)}
                    className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-accent transition-colors flex items-start gap-2.5 group"
                  >
                    <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-300 dark:text-muted-foreground/40" />
                    <span className="text-[12px] font-medium leading-snug text-gray-600 dark:text-muted-foreground group-hover:text-gray-900 dark:group-hover:text-foreground transition-colors">
                      {faq.question}
                    </span>
                    <ChevronRight className="h-3 w-3 mt-1 shrink-0 text-gray-200 dark:text-muted-foreground/30 ml-auto" />
                  </button>
                ))}
              </div>
            ) : showHome ? (
              /* Home / empty state */
              <div className="p-3 space-y-3">
                {workOrderTips.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-[#0CC0DF] uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      For this work order
                    </p>
                    <div className="space-y-1">
                      {workOrderTips.map((tip) => (
                        <button
                          key={tip.id}
                          type="button"
                          onClick={() => handleTipClick(tip)}
                          className="w-full text-left rounded-xl px-3 py-2 bg-[#0CC0DF]/5 border border-[#0CC0DF]/10 hover:bg-[#0CC0DF]/10 transition-colors group"
                        >
                          <p className="text-[12px] font-medium text-[#0CC0DF] dark:text-[#0CC0DF] leading-snug">
                            {tip.question}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pageQuickActions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground/60 uppercase tracking-wider mb-1.5 px-1">
                      Quick actions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pageQuickActions.map((qa) => (
                        <button
                          key={qa.id}
                          type="button"
                          onClick={() => handleQuickActionClick(qa)}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full border border-gray-100 dark:border-border bg-white dark:bg-card hover:bg-gray-50 dark:hover:bg-accent hover:border-gray-200 transition-all text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:hover:text-foreground"
                        >
                          {qa.icon}
                          {qa.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-muted-foreground/60 uppercase tracking-wider mb-1.5 px-1">
                    Browse by topic
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.entries(CATEGORY_CONFIG) as [FaqCategory, (typeof CATEGORY_CONFIG)[FaqCategory]][]).map(
                      ([key, config]) => {
                        const count = FAQ_ITEMS.filter((f) => f.category === key).length;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedCategory(key)}
                            className={cn(
                              "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all hover:bg-gray-50 dark:hover:bg-accent active:scale-[0.98]",
                              relevantCategories.includes(key)
                                ? "border-[#0CC0DF]/20 bg-[#0CC0DF]/5"
                                : "border-gray-100 dark:border-border",
                            )}
                          >
                            <span className={config.color}>{config.icon}</span>
                            <div>
                              <span className="text-[11px] font-medium block leading-tight text-gray-700 dark:text-foreground">{config.label}</span>
                              <span className="text-[9px] text-gray-400 dark:text-muted-foreground/60">{count} questions</span>
                            </div>
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Chat messages */
              <div className="p-3 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id}>
                    {msg.role === "user" ? (
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 bg-[#0CC0DF] text-white">
                          <p className="text-[12px] leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-muted shrink-0 mt-0.5">
                            <Bot className="h-3 w-3 text-gray-400 dark:text-muted-foreground" />
                          </div>
                          <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-gray-50 dark:bg-muted/60 text-[12px] leading-relaxed text-gray-600 dark:text-muted-foreground">
                            <RenderMarkdown text={msg.content} />

                            {msg.action && (msg.action.type === "navigate" || msg.action.type === "navigate-filter") && (
                              <button
                                type="button"
                                onClick={() => executeAction(msg.action!)}
                                className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-medium text-[#0CC0DF] hover:underline"
                              >
                                <ArrowUpRight className="h-3 w-3" />
                                Go
                              </button>
                            )}

                            {msg.quickAction && !msg.action && (
                              <Link
                                href={msg.quickAction.href}
                                className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-medium text-[#0CC0DF] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {msg.quickAction.label}
                              </Link>
                            )}
                          </div>
                        </div>

                        {msg.relatedIds && msg.relatedIds.length > 0 && (
                          <div className="pl-8 flex flex-wrap gap-1">
                            {msg.relatedIds
                              .map((id) => FAQ_ITEMS.find((f) => f.id === id))
                              .filter((f): f is FaqItem => !!f)
                              .slice(0, 3)
                              .map((faq) => (
                                <button
                                  key={faq.id}
                                  type="button"
                                  onClick={() => handleRelatedClick(faq.id)}
                                  className="text-[10px] px-2 py-1 rounded-full border border-gray-100 dark:border-border text-gray-500 dark:text-muted-foreground hover:text-[#0CC0DF] hover:border-[#0CC0DF]/30 transition-all max-w-[180px] truncate"
                                >
                                  {faq.question.length > 35
                                    ? faq.question.slice(0, 35) + "..."
                                    : faq.question}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-muted shrink-0 mt-0.5">
                      <Bot className="h-3 w-3 text-gray-400 dark:text-muted-foreground" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-gray-50 dark:bg-muted/60">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input area */}
          {!selectedCategory && (
            <form onSubmit={handleSubmit} className="border-t border-gray-100 dark:border-border bg-white dark:bg-card shrink-0">
              {/* Live suggestion chips */}
              {inputSuggestions.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-1">
                  {inputSuggestions.map((qa) => (
                    <button
                      key={qa.id}
                      type="button"
                      onClick={() => handleSuggestionClick(qa)}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-[#0CC0DF]/20 bg-[#0CC0DF]/5 text-[#0CC0DF] hover:bg-[#0CC0DF]/10 transition-all"
                    >
                      {qa.icon}
                      {qa.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask or do anything…"
                  className="h-9 text-xs rounded-xl flex-1 border border-gray-200 dark:border-border px-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#0CC0DF]/30 disabled:opacity-50"
                  disabled={isTyping}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 rounded-xl shrink-0 bg-[#0CC0DF] hover:bg-[#0ab0cc] border-0"
                  disabled={!inputValue.trim() || isTyping}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
