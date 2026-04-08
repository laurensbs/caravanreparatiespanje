"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  MessageCircleQuestion, X, ChevronRight, ArrowLeft, Search,
  Wrench, Receipt, Users, FileText, Package, Lightbulb, HelpCircle,
  Zap, CheckCircle2, ArrowRight, Send, RotateCcw, Sparkles, Bot,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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
  | "repairs"
  | "quotes-invoices"
  | "holded"
  | "parts-pricing"
  | "customers"
  | "excel-migration"
  | "tips";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  faqId?: string;
  relatedIds?: string[];
  quickAction?: { label: string; href: string };
  timestamp: number;
}

interface RepairContext {
  job?: any;
  settings?: any;
}

// ─── Category config ──────────────────────────────────────────

const CATEGORY_CONFIG: Record<FaqCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  "getting-started": { label: "Getting Started", icon: <Zap className="h-3.5 w-3.5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
  "repairs": { label: "Repairs", icon: <Wrench className="h-3.5 w-3.5" />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30" },
  "quotes-invoices": { label: "Quotes & Invoices", icon: <Receipt className="h-3.5 w-3.5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30" },
  "holded": { label: "Holded Integration", icon: <ArrowRight className="h-3.5 w-3.5" />, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950/30" },
  "parts-pricing": { label: "Parts & Pricing", icon: <Package className="h-3.5 w-3.5" />, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  "customers": { label: "Customers", icon: <Users className="h-3.5 w-3.5" />, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30" },
  "excel-migration": { label: "From Excel to This", icon: <FileText className="h-3.5 w-3.5" />, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
  "tips": { label: "Tips & Tricks", icon: <Lightbulb className="h-3.5 w-3.5" />, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950/30" },
};

// ─── FAQ data ─────────────────────────────────────────────────

const FAQ_ITEMS: FaqItem[] = [
  // ── Getting Started ────────────────────────────────
  {
    id: "what-is-this",
    question: "What is this system and how does it replace my Excel?",
    answer: "This is your new repair management system. It replaces the Excel spreadsheet you used before. Instead of manually tracking repairs, customers, parts, and invoices in separate Excel tabs, everything is now in one place — connected and automated.\n\nThe main flow is: Create a repair → Build a cost estimate (parts + labour) → Create a quote → Send it to the customer → Do the repair → Create an invoice → Get paid.\n\nThe big difference from Excel: amounts are calculated automatically, documents sync to Holded, and payment tracking happens without manual work.",
    category: "getting-started",
    keywords: ["start", "begin", "excel", "what", "how", "system", "replace", "new"],
    synonyms: ["what is this", "what does this do", "explain system", "how does this work", "replace excel", "instead of excel"],
    relatedIds: ["main-workflow", "excel-vs-this", "where-to-start"],
  },
  {
    id: "main-workflow",
    question: "What is the main workflow? How do I go from start to finish?",
    answer: "Every repair follows this flow:\n\n1. **Create a repair** — Click '+ New Repair', fill in customer, unit (caravan), and problem description.\n2. **Build cost estimate** — Add parts from catalog (markup applied automatically) and labour hours.\n3. **Create a Quote** — Click 'Create Quote' in the sidebar → it's created in Holded instantly.\n4. **Send the Quote** — Click 'Email' to send the quote to the customer.\n5. **Do the repair** — Change status to 'In Progress'. Add extra parts if you find more issues.\n6. **Create Invoice** — When done, set status to 'Completed', then 'Create Invoice'.\n7. **Send Invoice** — Click 'Email' to send it.\n8. **Payment** — When the customer pays in Holded, the status updates here automatically (every 30 min).\n\nYou can see which step each repair is at from the workflow bar at the top of every page.",
    category: "getting-started",
    keywords: ["workflow", "flow", "steps", "process", "start", "finish", "how", "order"],
    synonyms: ["how does it work", "what are the steps", "walk me through", "step by step", "from beginning to end"],
    relatedIds: ["create-repair", "create-quote", "create-invoice", "payment-tracking"],
    pages: ["dashboard", "repairs", "repair-detail"],
  },
  {
    id: "where-to-start",
    question: "I just logged in — where do I start?",
    answer: "Start at the **Dashboard** (you're probably here already). You'll see:\n\n• **KPI cards** at the top — how many active, in progress, waiting, etc.\n• **Recent Activity** — your latest repairs.\n• A **guide** below the KPIs explaining what to do.\n\nTo create your first repair: click **'+ New Repair'** in the top right. Pick the customer, caravan, and describe the issue. Then go to the repair detail page to add parts and build a cost estimate.\n\nTip: The sidebar on the left is your navigation. Repairs, Contacts, Parts, Invoices — everything is there.",
    category: "getting-started",
    keywords: ["start", "begin", "first", "login", "where", "new", "just"],
    synonyms: ["what do i do first", "where to begin", "first time", "getting started", "logged in now what"],
    relatedIds: ["navigation", "create-repair", "main-workflow"],
    pages: ["dashboard"],
    quickAction: { label: "Create your first repair", href: "/repairs/new" },
  },
  {
    id: "navigation",
    question: "How do I navigate the system?",
    answer: "Use the **sidebar on the left**:\n\n• **Dashboard** — Overview of all repairs and stats.\n• **Repairs** — All repairs, filterable by status/priority/location.\n• **Contacts** — All customers, synced from Holded.\n• **Units** — Caravans/vehicles registered in the system.\n• **Parts** — Your parts catalog with cost prices and markup.\n• **Invoices** — All invoices from Holded with payment status.\n• **Settings** — Locations, tags, users, pricing.\n\nYou can collapse the sidebar by clicking the arrow at the bottom.\n\nTip: Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) to quickly search for anything.",
    category: "getting-started",
    keywords: ["navigate", "sidebar", "menu", "find", "where", "pages", "go"],
    synonyms: ["how to get to", "where is", "find page", "move around", "go to"],
    relatedIds: ["quick-search", "repair-filters"],
  },

  // ── Repairs ────────────────────────────────────────
  {
    id: "create-repair",
    question: "How do I create a new repair?",
    answer: "Two ways:\n\n1. **From the Dashboard** — Click '+ New Repair' in the top right.\n2. **From Repairs page** — Same button, top right.\n\nFill in:\n• **Customer** — Select from the dropdown (they come from Holded).\n• **Unit** — The caravan/vehicle being repaired.\n• **Title** — Brief description (e.g. 'Leaking window').\n• **Description** — Full details of the problem.\n• **Location** — Which workshop (Cruïllas, Peratallada, Sant Climent).\n• **Priority** — Normal, High, or Urgent.\n\nAfter creating, you'll land on the repair detail page where you build the cost estimate.",
    category: "repairs",
    keywords: ["create", "new", "repair", "add", "make", "start"],
    synonyms: ["new job", "add repair", "start a repair", "make new repair", "begin repair"],
    relatedIds: ["cost-estimate", "repair-statuses", "main-workflow"],
    pages: ["repairs", "repair-new", "dashboard"],
    quickAction: { label: "New Repair", href: "/repairs/new" },
  },
  {
    id: "repair-statuses",
    question: "What do the repair statuses mean?",
    answer: "Each repair goes through these statuses:\n\n• **New** — Just created, not started yet.\n• **To Do** — Acknowledged, in the queue.\n• **Scheduled** — Has a planned date.\n• **In Progress** — Currently being worked on.\n• **Waiting Parts** — Repair paused, waiting for parts to arrive.\n• **Waiting Customer** — Waiting for the customer to respond.\n• **Blocked** — Can't proceed for some reason.\n• **Completed** — Repair work done, ready for invoicing.\n• **Invoiced** — Invoice created in Holded.\n• **Archived** — Closed/finished.\n\nTip: Click the status dropdown at the top of any repair to change it.",
    category: "repairs",
    keywords: ["status", "statuses", "meaning", "new", "progress", "waiting", "completed", "todo", "blocked"],
    synonyms: ["what does status mean", "repair stages", "change status", "status options"],
    relatedIds: ["edit-repair", "create-repair"],
    pages: ["repairs", "repair-detail"],
  },
  {
    id: "cost-estimate",
    question: "How do I build a cost estimate?",
    answer: "On the repair detail page, scroll down to the **Cost Estimate** section:\n\n1. **Add parts** — Click '+ Add Line'. Select a part from your catalog → the selling price (cost + markup) is filled in automatically.\n2. **Add labour** — Click '+ Labour'. Enter hours worked. Hourly rate comes from Settings → Pricing.\n3. **Custom lines** — Add custom items with a description and price.\n4. **Discount** — Optionally set a discount percentage.\n\nThe total is calculated automatically: parts + labour – discount + VAT.\n\nThe customer only sees the selling price (after markup). Your purchase price stays private.",
    category: "repairs",
    keywords: ["cost", "estimate", "build", "parts", "labour", "price", "total", "calculate"],
    synonyms: ["add cost", "price a repair", "how much to charge", "build estimate", "cost breakdown"],
    relatedIds: ["add-parts-repair", "markup-explained", "hourly-rate", "create-quote"],
    pages: ["repair-detail"],
  },
  {
    id: "edit-repair",
    question: "How do I edit a repair's details?",
    answer: "On the repair detail page:\n\n• **Title** — Click it to edit inline.\n• **Description** — Click 'Edit' next to it.\n• **Status, Priority** — Use the dropdowns at the top.\n• **Cost estimate** — Add/remove/edit lines directly.\n• **Notes** — Use the internal notes field.\n\nAfter making changes, click **'Save'** (top right) to save everything.\n\nTip: The timeline at the bottom shows the history of all changes.",
    category: "repairs",
    keywords: ["edit", "change", "update", "modify", "title", "description", "save"],
    synonyms: ["change repair", "update details", "modify repair", "fix details"],
    relatedIds: ["repair-statuses", "cost-estimate"],
    pages: ["repair-detail"],
  },
  {
    id: "repair-filters",
    question: "How do I find a specific repair?",
    answer: "On the **Repairs** page:\n\n• **Search bar** — Type a customer name, repair code, or description.\n• **Status filter** — Filter by Todo, In Progress, Waiting, etc.\n• **Location filter** — Filter by workshop.\n• **Priority filter** — Find urgent repairs.\n\nOr use **Cmd+K / Ctrl+K** from anywhere for global search.\n\nTip: Dashboard KPI cards are clickable — click 'Urgent' to see urgent repairs.",
    category: "repairs",
    keywords: ["find", "search", "filter", "specific", "looking", "where", "repair"],
    synonyms: ["look for repair", "search repair", "find a job", "locate repair", "which repair"],
    relatedIds: ["quick-search", "kanban-board"],
    pages: ["repairs"],
  },

  // ── Quotes & Invoices ──────────────────────────────
  {
    id: "create-quote",
    question: "How do I create and send a quote?",
    answer: "From the **repair detail page**:\n\n1. First, build your cost estimate (parts + labour).\n2. In the **right sidebar**, under 'Holded Documents', click **'Create Quote'**.\n3. The quote is instantly created in Holded with all your line items.\n4. Two buttons appear: **PDF** (download) and **Email** (send to customer).\n5. Click **'Email'** to send the quote to the customer's email address.\n\nThe quote shows selling prices (after markup), VAT, and total. Your purchase prices are never visible.\n\nTip: If the customer doesn't have an email, add it in their contact page first.",
    category: "quotes-invoices",
    keywords: ["quote", "create", "send", "email", "pdf", "offerte", "estimate"],
    synonyms: ["make quote", "send quote", "offerte maken", "price quote", "send estimate", "email quote"],
    relatedIds: ["cost-estimate", "create-invoice", "quote-vs-invoice", "customer-email-important"],
    pages: ["repair-detail"],
  },
  {
    id: "create-invoice",
    question: "How do I create and send an invoice?",
    answer: "From the **repair detail page**:\n\n1. Make sure your cost estimate is complete.\n2. Set the repair status to **'Completed'** (or you can do it before).\n3. In the **right sidebar**, click **'Create Invoice'**.\n4. The invoice is created in Holded instantly.\n5. Click **'Email'** to send the invoice to the customer.\n\nThe invoice amounts come from your cost estimate. If you need to change something, update the estimate first, then create a new invoice.\n\nPayment tracking is automatic — when the customer pays in Holded, it updates here within 30 minutes.",
    category: "quotes-invoices",
    keywords: ["invoice", "create", "send", "factuur", "bill", "payment"],
    synonyms: ["make invoice", "send invoice", "factuur maken", "bill customer", "create bill"],
    relatedIds: ["cost-estimate", "create-quote", "payment-tracking", "mark-paid-manually"],
    pages: ["repair-detail", "invoices"],
  },
  {
    id: "invoice-page",
    question: "What is the Invoices page for?",
    answer: "The **Invoices** page shows all invoices from Holded in one overview:\n\n• **Green** = Paid\n• **Yellow** = Partially paid\n• **Red** = Unpaid (click to mark as paid)\n\nYou can:\n• Filter by status (Paid / Unpaid / Partial)\n• Search by invoice number or customer name\n• Filter by date range\n• Download PDFs\n• Resend invoices via email\n\nPayment status syncs automatically from Holded every 30 minutes.",
    category: "quotes-invoices",
    keywords: ["invoices", "page", "overview", "paid", "unpaid", "payment", "list"],
    synonyms: ["invoice overview", "see all invoices", "check payments", "invoice list"],
    relatedIds: ["mark-paid-manually", "payment-tracking", "no-amounts-visible"],
    pages: ["invoices"],
    quickAction: { label: "Go to Invoices", href: "/invoices" },
  },
  {
    id: "quote-vs-invoice",
    question: "What's the difference between a quote and an invoice?",
    answer: "• A **quote** (offerte) is sent BEFORE the work — so the customer can approve the cost.\n• An **invoice** (factuur) is sent AFTER the work — so the customer pays.\n\nBoth are created in Holded from the same cost estimate. The typical flow:\n1. Build estimate → Create quote → Send to customer\n2. Customer approves → Do the repair\n3. Repair done → Create invoice → Send to customer → Get paid\n\nIf you find extra issues during the repair, update the cost estimate. The invoice will reflect the latest amounts.",
    category: "quotes-invoices",
    keywords: ["quote", "invoice", "difference", "offerte", "factuur", "versus", "vs"],
    synonyms: ["quote or invoice", "offerte vs factuur", "when quote when invoice", "difference between"],
    relatedIds: ["create-quote", "create-invoice", "main-workflow"],
    pages: ["repair-detail"],
  },

  // ── Holded Integration ─────────────────────────────
  {
    id: "what-is-holded",
    question: "What is Holded and how does it connect?",
    answer: "**Holded** is the accounting/invoicing system used by the business. This repair system connects to Holded via API:\n\n• **Quotes** — Created here → appear instantly in Holded.\n• **Invoices** — Created here → appear instantly in Holded.\n• **Contacts** — Synced both ways every 6 hours.\n• **Payments** — When a customer pays in Holded, the status syncs back here every 30 min.\n\nYou do NOT need to log into Holded for quotes/invoices — you do everything from here. But you CAN open Holded for official documents or manual edits.\n\nEvery quote and invoice has an 'Open in Holded' link.",
    category: "holded",
    keywords: ["holded", "what", "connect", "sync", "integration", "accounting"],
    synonyms: ["what is holded", "holded connection", "how holded works", "accounting system"],
    relatedIds: ["holded-sync", "holded-link", "payment-tracking"],
  },
  {
    id: "holded-sync",
    question: "How does the sync with Holded work?",
    answer: "The sync is automatic:\n\n• **Quotes & Invoices** — Created **instantly** when you click the button. No delay.\n• **Contacts** — Synced every **6 hours** in both directions.\n• **Payments** — Synced every **30 minutes**. When a customer pays in Holded, it shows here as 'Paid'.\n\nYou can also mark an invoice as paid manually for immediate updates.\n\nThe sync runs automatically in the background — you don't need to do anything.",
    category: "holded",
    keywords: ["sync", "automatic", "how", "when", "contacts", "payments", "cron", "frequency"],
    synonyms: ["when does it sync", "sync frequency", "how often", "automatic update", "real time"],
    relatedIds: ["what-is-holded", "customer-sync", "payment-tracking"],
  },
  {
    id: "holded-link",
    question: "Can I still open things in Holded directly?",
    answer: "Yes! Every quote and invoice has an **'Open in Holded'** button/link. This opens the document directly in the Holded web app.\n\nUse this when you need to:\n• See the official PDF layout\n• Add payment information manually\n• Make edits that are only available in Holded\n• Check the full accounting view\n\nChanges to payment status in Holded sync back here automatically.",
    category: "holded",
    keywords: ["holded", "open", "link", "directly", "website", "view"],
    synonyms: ["go to holded", "open in holded", "view in holded", "holded website"],
    relatedIds: ["what-is-holded", "holded-sync"],
    pages: ["repair-detail", "invoices"],
  },
  {
    id: "payment-tracking",
    question: "How does payment tracking work?",
    answer: "Payment tracking is mostly **automatic**:\n\n1. You create and send an invoice from this system.\n2. The customer pays via bank transfer, iDEAL, or another method in Holded.\n3. Every **30 minutes**, this system checks Holded for payment updates.\n4. When paid, the invoice shows as **green/Paid** here.\n\nIf you need to mark something paid immediately (e.g. cash):\n• On the **Invoices page** — click the red 'Unpaid' badge\n• This marks it as paid in both systems.\n\nNo more manual Excel tracking!",
    category: "holded",
    keywords: ["payment", "paid", "tracking", "automatic", "bank", "cash", "money", "received"],
    synonyms: ["has customer paid", "payment status", "check payment", "when paid updates", "cash payment"],
    relatedIds: ["mark-paid-manually", "holded-sync", "invoice-page"],
    pages: ["invoices"],
  },

  // ── Parts & Pricing ────────────────────────────────
  {
    id: "how-parts-work",
    question: "How does the parts catalog work?",
    answer: "The **Parts** page is your catalog of all parts/materials:\n\n• Each part has a **cost price** (what you pay the supplier).\n• Each part can have a **markup %** (how much you charge on top).\n• If no markup is set, the **default markup** from Settings → Pricing is used.\n\n**Example:** Part costs €10, markup 40% → selling price €14.\n\nWhen adding a part to a repair estimate, the **selling price** is filled in automatically. The customer only sees this.\n\nYou can also add a **supplier** and **SKU number** for your records.",
    category: "parts-pricing",
    keywords: ["parts", "catalog", "cost", "price", "how", "supplier"],
    synonyms: ["parts list", "part prices", "add new part", "parts page"],
    relatedIds: ["markup-explained", "add-parts-repair", "hourly-rate"],
    pages: ["parts"],
    quickAction: { label: "Go to Parts", href: "/parts" },
  },
  {
    id: "markup-explained",
    question: "How does markup work? Will the customer see my cost price?",
    answer: "**No, the customer never sees your cost price.** Here's how markup works:\n\n• You set the **cost price** (what you pay) per part.\n• You set a **markup percentage** per part (or use the default from Settings).\n• **Selling price** = cost × (1 + markup/100).\n\n**Example:** Cost €50, markup 40% → Selling price €70. Your margin: €20.\n\nQuotes and invoices always show the **selling price**. Your cost price and markup are only visible to you.\n\nLabour uses a flat hourly rate from Settings → Pricing.",
    category: "parts-pricing",
    keywords: ["markup", "cost", "selling", "margin", "customer", "see", "price", "profit"],
    synonyms: ["does customer see price", "hide cost", "my margin", "profit margin", "selling price"],
    relatedIds: ["how-parts-work", "add-parts-repair", "hourly-rate"],
    pages: ["parts", "repair-detail"],
  },
  {
    id: "add-parts-repair",
    question: "How do I add parts to a repair?",
    answer: "On the repair detail page, in the **Cost Estimate** section:\n\n1. Click **'+ Add Line'**.\n2. Select a part from the dropdown — selling price fills automatically.\n3. Set the **quantity**.\n4. Line total: quantity × selling price.\n\nAlso:\n• **'+ Labour'** — add work hours.\n• **Custom line** — your own description and price.\n• **Discount %** — at the bottom.\n\nThe total (lines + VAT) is what appears on quotes and invoices.",
    category: "parts-pricing",
    keywords: ["add", "parts", "repair", "estimate", "line", "labour"],
    synonyms: ["put parts in repair", "add items", "add to estimate", "part to repair"],
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
    quickAction: { label: "Go to Pricing Settings", href: "/settings" },
  },

  // ── Customers ──────────────────────────────────────
  {
    id: "customer-sync",
    question: "Where do customers come from?",
    answer: "Customers come from **two sources**:\n\n1. **Holded** — Every 6 hours, all contacts from Holded sync here automatically.\n2. **Manual** — Add via Contacts → '+ New Customer'. They're pushed to Holded when you create a quote/invoice.\n\nNo need to maintain customers in two places — the sync handles it.\n\nImportant: Make sure every customer has an **email address** for sending quotes and invoices.",
    category: "customers",
    keywords: ["customer", "contact", "where", "come", "sync", "add", "new"],
    synonyms: ["add customer", "new customer", "where are customers", "customer list", "contacts"],
    relatedIds: ["customer-email-important", "holded-sync"],
    pages: ["customers"],
    quickAction: { label: "View Contacts", href: "/customers" },
  },
  {
    id: "customer-email-important",
    question: "Why does the system keep asking for customer email?",
    answer: "Email is how quotes and invoices are delivered. When you click 'Email', Holded sends to that address.\n\n**Without email:**\n• You can still create quotes and invoices\n• You can download PDFs\n• But you CAN'T email them from the system\n\nTo add email: **Contacts** → click customer → edit email.\n\nThe system warns you when a customer is missing their email.",
    category: "customers",
    keywords: ["email", "why", "important", "customer", "send", "missing", "no email"],
    synonyms: ["customer email", "missing email", "need email", "add email", "why email"],
    relatedIds: ["customer-sync", "create-quote", "create-invoice"],
    pages: ["customers", "repair-detail"],
  },

  // ── Excel Migration ────────────────────────────────
  {
    id: "excel-vs-this",
    question: "What did I use to do in Excel, and where is it now?",
    answer: "Here's the mapping from your Excel workflow:\n\n• **Repair tracking rows** → Repairs page (with statuses, filters)\n• **Customer list** → Contacts (synced with Holded)\n• **Parts/price list** → Parts catalog (with automatic markup)\n• **Cost calculations** → Cost Estimate on each repair (auto-calculated)\n• **Manual invoice creation** → Create Invoice button (creates in Holded)\n• **Payment tracking columns** → Automatic from Holded every 30 min\n• **Status columns** → Status dropdown with workflow guide\n\nBiggest wins: no manual calculations, no copy-paste to Holded, payments track themselves, everything is searchable.",
    category: "excel-migration",
    keywords: ["excel", "used", "before", "old", "spreadsheet", "migration", "where", "replace"],
    synonyms: ["excel comparison", "how is this different", "my excel", "old system", "what changed"],
    relatedIds: ["what-is-this", "main-workflow", "data-safe"],
  },
  {
    id: "no-amounts-visible",
    question: "Why can't I see amounts on the invoices page?",
    answer: "The invoices page shows **counts and statuses** instead of amounts. This keeps the overview clean and focused: which invoices are paid and which need attention.\n\nTo see full invoice details:\n• Click the **invoice number** → opens in Holded\n• Or go to the **repair detail page** (linked in the 'Repair' column)\n\nAll amounts are always available in Holded. This system focuses on workflow and tracking.",
    category: "excel-migration",
    keywords: ["amounts", "money", "total", "see", "where", "numbers", "invoices", "hidden"],
    synonyms: ["where are the amounts", "no money visible", "totals missing", "can't see money", "invoice amounts"],
    relatedIds: ["invoice-page", "holded-link"],
    pages: ["invoices"],
  },
  {
    id: "data-safe",
    question: "Is my data safe? Where is it stored?",
    answer: "Your data is in **two secure places**:\n\n1. **This system's database** — Neon (PostgreSQL cloud). Repairs, customers, parts, estimates, notes, audit logs.\n2. **Holded** — All official documents (quotes, invoices, contacts).\n\nHosted on **Vercel** — professional cloud platform.\n\nAutomatic backups on both Neon and Holded. Much safer than a local Excel file!",
    category: "excel-migration",
    keywords: ["data", "safe", "backup", "stored", "where", "secure", "lost"],
    synonyms: ["data safety", "is it backed up", "lose data", "where stored", "database"],
    relatedIds: ["what-is-holded"],
  },

  // ── Tips & Tricks ──────────────────────────────────
  {
    id: "quick-search",
    question: "How do I quickly find anything?",
    answer: "Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) from anywhere.\n\nSearch for:\n• Repairs (by code, customer name, title)\n• Customers\n• Parts\n• Pages\n\nIt's the fastest way to navigate the system.",
    category: "tips",
    keywords: ["search", "find", "quick", "fast", "cmd", "ctrl", "k", "shortcut"],
    synonyms: ["keyboard shortcut", "find something", "search everything", "command k"],
    relatedIds: ["navigation", "repair-filters"],
  },
  {
    id: "kanban-board",
    question: "Is there a visual overview of all repairs?",
    answer: "Yes! Go to **Repairs** → click **'Board'** (or go to /repairs/board).\n\nThis shows a **Kanban board** with repairs grouped by status in columns. See at a glance what's new, in progress, waiting, and completed.\n\nGreat for daily planning.",
    category: "tips",
    keywords: ["board", "kanban", "visual", "overview", "columns", "drag"],
    synonyms: ["board view", "visual view", "column view", "drag and drop", "overview board"],
    relatedIds: ["repair-statuses", "repair-filters"],
    pages: ["repairs"],
    quickAction: { label: "Open Kanban Board", href: "/repairs/board" },
  },
  {
    id: "communication-log",
    question: "How do I track communications with a customer?",
    answer: "On each **repair detail page**, there's a **Communication Log**:\n\n• Log phone calls, emails, and messages.\n• Each entry is timestamped and saved.\n• Creates a full history of all contact about this repair.\n\nUse it to track: when you called, what was discussed, what was agreed.",
    category: "tips",
    keywords: ["communication", "log", "phone", "call", "email", "track", "history", "message"],
    synonyms: ["log a call", "track phone call", "note a conversation", "record communication"],
    relatedIds: ["edit-repair"],
    pages: ["repair-detail"],
  },
  {
    id: "mark-paid-manually",
    question: "How do I manually mark an invoice as paid?",
    answer: "On the **Invoices** page:\n\n• Find the invoice (red 'Unpaid' badge).\n• **Click the 'Unpaid' badge** → marks it as paid.\n• Updates both this system AND Holded.\n\nUse for: cash payments, bank transfer that hasn't synced yet, or immediate updates.\n\nNormally: payments sync from Holded automatically every 30 min.",
    category: "tips",
    keywords: ["mark", "paid", "manually", "cash", "update", "status", "unpaid"],
    synonyms: ["customer paid cash", "manually pay", "set as paid", "click unpaid", "force paid"],
    relatedIds: ["payment-tracking", "invoice-page"],
    pages: ["invoices"],
  },
  {
    id: "discount",
    question: "How do I apply a discount?",
    answer: "In the repair's **Cost Estimate** section, at the bottom: **Discount %** field.\n\nSet a percentage (e.g. 10%) → applied to total before VAT.\n\nExample: Estimate €500, discount 10% = €450 + VAT.\n\nThe discount shows on both the quote and invoice.",
    category: "tips",
    keywords: ["discount", "percentage", "reduce", "price", "lower", "korting"],
    synonyms: ["give discount", "reduce price", "lower price", "apply discount", "korting geven"],
    relatedIds: ["cost-estimate", "create-quote"],
    pages: ["repair-detail"],
  },
  {
    id: "delete-repair",
    question: "Can I delete a repair?",
    answer: "Yes, but carefully. On the repair detail page, scroll to bottom — **delete button**.\n\nNote:\n• Removes from this system permanently.\n• Quotes/invoices already in Holded still exist there.\n• Cannot be undone.\n\n**Better alternative:** Set status to **'Archived'** — hides from the active list but keeps history.",
    category: "tips",
    keywords: ["delete", "remove", "repair", "undo", "archive", "get rid"],
    synonyms: ["remove repair", "delete a job", "get rid of repair", "erase repair"],
    relatedIds: ["repair-statuses", "edit-repair"],
    pages: ["repair-detail"],
  },
  {
    id: "multiple-locations",
    question: "How do workshops/locations work?",
    answer: "The system supports multiple workshop locations (Cruïllas, Peratallada, Sant Climent, etc.).\n\n• Each repair is assigned to a **location** when created.\n• The Dashboard shows a **By Location** breakdown.\n• You can filter repairs by location on the Repairs page.\n\nManage locations in **Settings → Locations**.",
    category: "tips",
    keywords: ["location", "workshop", "locations", "cruillas", "peratallada", "sant climent"],
    synonyms: ["which workshop", "where is it", "different locations", "workshop locations"],
    relatedIds: ["create-repair", "repair-filters"],
    pages: ["settings"],
    quickAction: { label: "Manage Locations", href: "/settings/locations" },
  },
  {
    id: "priority-levels",
    question: "What are the priority levels?",
    answer: "Repairs have three priority levels:\n\n• **Normal** — Standard queue.\n• **High** — Needs attention soon.\n• **Urgent** — Drop everything, fix this first.\n\nUrgent repairs show a red badge everywhere and appear in the Dashboard's 'Urgent' count.\n\nChange priority in the repair detail page via the dropdown.",
    category: "tips",
    keywords: ["priority", "urgent", "high", "normal", "important"],
    synonyms: ["set priority", "urgent repair", "important repair", "priority levels"],
    relatedIds: ["create-repair", "repair-statuses"],
    pages: ["repair-detail", "repairs"],
  },
  {
    id: "vat-tax",
    question: "How is VAT/tax handled?",
    answer: "VAT is applied automatically:\n\n• The default tax rate is set in **Settings → Pricing** (typically 21% IVA).\n• Cost estimates show subtotal + VAT separately.\n• Quotes and invoices include VAT automatically via Holded.\n\nAll selling prices in the estimate are excl. VAT. VAT is added on the total.",
    category: "tips",
    keywords: ["vat", "tax", "iva", "btw", "21", "percent"],
    synonyms: ["how much tax", "iva percentage", "btw rate", "tax rate", "vat included"],
    relatedIds: ["cost-estimate", "hourly-rate"],
    pages: ["repair-detail", "settings"],
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

// ─── Dynamic repair context tips ──────────────────────────────

function getRepairTips(context?: RepairContext): FaqItem[] {
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

  if (!hasEstimate && !hasInvoice) {
    tips.push({
      id: "tip-no-estimate",
      question: "\ud83d\udca1 Next step: Build cost estimate for " + customerName,
      answer: "This repair for **" + customerName + "** needs a cost estimate.\n\nScroll down to the **Cost Estimate** section and:\n1. Click **'+ Add Line'** to add parts from your catalog (markup applied automatically).\n2. Click **'+ Labour'** to add work hours.\n3. Optionally set a discount %.\n\nOnce the estimate is ready, you can create a quote to send to the customer for approval.",
      category: "tips",
      keywords: [],
    });
  } else if (hasEstimate && !hasQuote && !hasInvoice) {
    tips.push({
      id: "tip-ready-for-quote",
      question: "\ud83d\udca1 Next step: Create a quote for " + customerName,
      answer: "Your cost estimate is ready (\u20ac" + parseFloat(job.estimatedCost).toFixed(2) + ").\n\nClick **'Create Quote'** in the right sidebar to generate a Holded quote. Then click **'Email'** to send it to " + customerName + " for approval.\n\n" + (job.customer?.email ? "The quote will be sent to: **" + job.customer.email + "**" : "\u26a0\ufe0f " + customerName + " has no email address. Add it in their contact page first."),
      category: "tips",
      keywords: [],
    });
  } else if (hasQuote && !hasInvoice && isActive) {
    tips.push({
      id: "tip-doing-repair",
      question: "\ud83d\udca1 Quote sent \u2014 repair in progress",
      answer: "The quote for **" + customerName + "** was sent.\n\nIf you find extra issues during the repair, add more lines to the cost estimate \u2014 amounts update automatically.\n\nWhen finished:\n1. Change status to **'Completed'**.\n2. Click **'Create Invoice'** in the right sidebar.\n3. Send the invoice via email.",
      category: "tips",
      keywords: [],
    });
  } else if (hasQuote && !hasInvoice && !isActive) {
    tips.push({
      id: "tip-ready-for-invoice",
      question: "\ud83d\udca1 Next step: Create invoice for " + customerName,
      answer: "The repair for **" + customerName + "** is completed. Time to invoice!\n\nClick **'Create Invoice'** in the right sidebar. This converts your cost estimate into a Holded invoice.\n\nThen click **'Email'** to send it to the customer.",
      category: "tips",
      keywords: [],
    });
  } else if (hasInvoice && !isPaid) {
    tips.push({
      id: "tip-waiting-payment",
      question: "\ud83d\udca1 Waiting for payment from " + customerName,
      answer: "The invoice for **" + customerName + "** has been created.\n\nPayment tracking is automatic \u2014 when they pay in Holded, it shows here within 30 minutes.\n\nTo mark as paid manually (e.g. cash): go to the **Invoices** page and click the red 'Unpaid' badge.",
      category: "tips",
      keywords: [],
    });
  } else if (isPaid) {
    tips.push({
      id: "tip-all-done",
      question: "\u2705 Repair completed and paid!",
      answer: "Everything is done for **" + customerName + "**! Quote sent, repair completed, invoice paid.\n\nYou can archive this repair or keep it as a reference in the system.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.customer && !job.customer.email && !isPaid) {
    tips.push({
      id: "tip-no-email",
      question: "\u26a0\ufe0f " + customerName + " has no email address",
      answer: "**" + customerName + "** doesn't have an email address. You can still create quotes and invoices, but can't email them.\n\nAdd their email: go to **Contacts** \u2192 find " + customerName + " \u2192 edit their email field.",
      category: "tips",
      keywords: [],
      quickAction: job.customer?.id ? { label: "Edit " + customerName, href: "/customers/" + job.customer.id } : undefined,
    });
  }

  if (daysSinceUpdated >= 7 && isActive) {
    tips.push({
      id: "tip-stale",
      question: "\u26a0\ufe0f No updates for " + daysSinceUpdated + " days",
      answer: "This repair hasn't been updated in **" + daysSinceUpdated + " days**.\n\nConsider:\n\u2022 Is the repair still active? Update the status.\n\u2022 Waiting on something? Change status to 'Waiting Parts' or 'Waiting Customer'.\n\u2022 Done? Change to 'Completed' and create the invoice.\n\u2022 No longer needed? Archive it.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.safetyFlag && isActive) {
    tips.push({
      id: "tip-safety",
      question: "\ud83d\udd34 Safety concern flagged",
      answer: "This repair has a **safety flag**. Prioritize the safety-related work first and ensure the customer is informed about any safety risks.",
      category: "tips",
      keywords: [],
    });
  }

  if (job.waterDamageRiskFlag && isActive) {
    tips.push({
      id: "tip-water",
      question: "\ud83d\udd34 Water damage risk flagged",
      answer: "This repair has a **water damage risk flag**. Address this promptly \u2014 water damage tends to get worse quickly. Consider temporary protection if the full repair will take time.",
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

export type AssistantPage =
  | "dashboard" | "repairs" | "repair-detail" | "repair-new"
  | "customers" | "parts" | "invoices" | "units" | "settings";

const PAGE_LABELS: Record<AssistantPage, string> = {
  "dashboard": "Dashboard",
  "repairs": "Repairs",
  "repair-detail": "Repair Detail",
  "repair-new": "New Repair",
  "customers": "Contacts",
  "parts": "Parts",
  "invoices": "Invoices",
  "units": "Units",
  "settings": "Settings",
};

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

const PAGE_QUICK_SUGGESTIONS: Record<AssistantPage, string[]> = {
  "dashboard": ["How do I create a repair?", "What is the main workflow?", "Where to start?"],
  "repairs": ["What do statuses mean?", "How to find a repair?", "Kanban board?"],
  "repair-detail": ["How to build estimate?", "How to create quote?", "How to invoice?"],
  "repair-new": ["How to create a repair?", "What is the workflow?"],
  "customers": ["Where do customers come from?", "Why is email important?"],
  "parts": ["How does markup work?", "How does the catalog work?"],
  "invoices": ["Why no amounts?", "How to mark as paid?", "How does payment work?"],
  "units": ["What is this system?", "How to navigate?"],
  "settings": ["Where is the hourly rate?", "How do locations work?"],
};

interface SmartAssistantProps {
  page: AssistantPage;
  context?: RepairContext;
}

export function SmartAssistant({ page, context }: SmartAssistantProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const repairTips = useMemo(
    () => (page === "repair-detail" ? getRepairTips(context) : []),
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
  }, [open, selectedCategory]);

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
      let faq = faqOverride;
      let bestAnswer: string;
      let relatedIds: string[] | undefined;
      let quickAction: { label: string; href: string } | undefined;
      let faqId: string | undefined;

      if (!faq) {
        const results = searchFaq(query, FAQ_ITEMS);
        if (results.length > 0) {
          faq = results[0].faq;
        }
      }

      if (faq) {
        bestAnswer = faq.answer;
        relatedIds = faq.relatedIds;
        quickAction = faq.quickAction;
        faqId = faq.id;
      } else {
        const suggested = relevantFaq.slice(0, 3);
        bestAnswer = "I'm not sure about that specific question. Here are some things I can help with on this page:\n\n" + suggested.map((f) => "\u2022 **" + f.question + "**").join("\n") + "\n\nTry clicking one of the suggestions below, or rephrase your question.";
        relatedIds = suggested.map((f) => f.id);
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: bestAnswer,
        faqId,
        relatedIds,
        quickAction,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 300 + Math.random() * 400);
  }, [relevantFaq]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    answerQuestion(inputValue.trim());
  }

  function handleQuickQuestion(question: string) {
    answerQuestion(question);
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

  const quickSuggestions = PAGE_QUICK_SUGGESTIONS[page] ?? [];
  const showHome = messages.length === 0 && !selectedCategory;

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
        title="Ask the Assistant"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircleQuestion className="h-5 w-5" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[400px] max-h-[min(600px,calc(100vh-8rem))] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0">
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
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold">
                    {selectedCategory ? CATEGORY_CONFIG[selectedCategory].label : "Smart Assistant"}
                  </h3>
                  <p className="text-[10px] text-white/60">
                    {selectedCategory
                      ? FAQ_ITEMS.filter((f) => f.category === selectedCategory).length + " questions"
                      : "You're on " + PAGE_LABELS[page]}
                  </p>
                </div>
              </div>
              {messages.length > 0 && !selectedCategory && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={handleReset}
                  title="New conversation"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              )}
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
                    className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5 group"
                  >
                    <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-[12px] font-medium leading-snug group-hover:text-foreground transition-colors">
                      {faq.question}
                    </span>
                    <ChevronRight className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/40 ml-auto" />
                  </button>
                ))}
              </div>
            ) : showHome ? (
              /* Home / empty state */
              <div className="p-3 space-y-3">
                {repairTips.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      For this repair
                    </p>
                    <div className="space-y-1">
                      {repairTips.map((tip) => (
                        <button
                          key={tip.id}
                          type="button"
                          onClick={() => handleTipClick(tip)}
                          className="w-full text-left rounded-lg px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors group"
                        >
                          <p className="text-[12px] font-medium text-blue-800 dark:text-blue-300 leading-snug group-hover:text-blue-900 dark:group-hover:text-blue-200">
                            {tip.question}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {quickSuggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                      Quick questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickSuggestions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleQuickQuestion(q)}
                          className="text-[11px] px-2.5 py-1.5 rounded-full border bg-card hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
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
                              "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60 active:scale-[0.98]",
                              relevantCategories.includes(key) && "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
                            )}
                          >
                            <span className={config.color}>{config.icon}</span>
                            <div>
                              <span className="text-[11px] font-medium block leading-tight">{config.label}</span>
                              <span className="text-[9px] text-muted-foreground">{count} questions</span>
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
                        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 bg-blue-600 text-white">
                          <p className="text-[12px] leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                            <Bot className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-muted/60 text-[12px] leading-relaxed text-muted-foreground">
                            <RenderMarkdown text={msg.content} />

                            {msg.quickAction && (
                              <Link
                                href={msg.quickAction.href}
                                className="inline-flex items-center gap-1.5 mt-2.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
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
                                  className="text-[10px] px-2 py-1 rounded-full border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors max-w-[180px] truncate"
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
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-muted/60">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input area */}
          {!selectedCategory && (
            <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t bg-card shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask me anything..."
                  className="h-9 text-xs rounded-xl flex-1"
                  disabled={isTyping}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 rounded-xl shrink-0 bg-blue-600 hover:bg-blue-700"
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
