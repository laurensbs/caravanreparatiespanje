"use server";

import { db } from "@/lib/db";
import { repairJobs, customers } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, listAllQuotes, payInvoice, sendInvoice, type HoldedInvoice, type HoldedQuote } from "@/lib/holded/invoices";
import { filterRepairInvoices, filterRepairQuotes } from "@/lib/holded/filter";
import { eq, isNotNull, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface InvoiceWithRepair extends HoldedInvoice {
  repairJobId?: string;
  repairPublicCode?: string;
  customerName?: string;
  customerEmail?: string;
  lastPaymentReminderAt?: Date | null;
}

export async function getAllInvoices(): Promise<InvoiceWithRepair[]> {
  await requireAuth();
  if (!isHoldedConfigured()) return [];

  // Fetch invoices from Holded (filtered to repair-only)
  let holdedInvoices: HoldedInvoice[];
  try {
    holdedInvoices = filterRepairInvoices(await listAllInvoices());
  } catch {
    return [];
  }

  // Get repair jobs that have holdedInvoiceId to link them
  const linkedRepairs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      customerId: repairJobs.customerId,
      lastPaymentReminderAt: repairJobs.lastPaymentReminderAt,
    })
    .from(repairJobs)
    .where(and(isNotNull(repairJobs.holdedInvoiceId), isNull(repairJobs.deletedAt)));

  const repairByInvoice = new Map<string, { id: string; publicCode: string | null; customerId: string | null; lastPaymentReminderAt: Date | null }>();
  for (const r of linkedRepairs) {
    if (r.holdedInvoiceId) repairByInvoice.set(r.holdedInvoiceId, r);
  }

  // Get customer names mapped by holdedContactId
  const dbCustomers = await db
    .select({ id: customers.id, name: customers.name, email: customers.email, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));
  const customerByHolded = new Map<string, { name: string; email: string | null }>();
  for (const c of dbCustomers) {
    if (c.holdedContactId) customerByHolded.set(c.holdedContactId, { name: c.name, email: c.email });
  }

  // Merge
  return holdedInvoices.map((inv) => {
    const repair = repairByInvoice.get(inv.id);
    const customer = customerByHolded.get(inv.contact);
    return {
      ...inv,
      repairJobId: repair?.id,
      repairPublicCode: repair?.publicCode ?? undefined,
      customerName: customer?.name ?? inv.contactName,
      customerEmail: customer?.email ?? undefined,
      lastPaymentReminderAt: repair?.lastPaymentReminderAt ?? undefined,
    };
  }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

// ─── Mark invoice as paid via Holded payment API ───

export async function markInvoicePaid(invoiceId: string) {
  await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  await payInvoice(invoiceId);

  // Also update the local repair job invoiceStatus if linked
  const linkedRepairs = await db
    .select({ id: repairJobs.id, holdedInvoiceId: repairJobs.holdedInvoiceId })
    .from(repairJobs)
    .where(eq(repairJobs.holdedInvoiceId, invoiceId))
    .limit(1);

  if (linkedRepairs.length > 0) {
    await db
      .update(repairJobs)
      .set({ invoiceStatus: "paid", updatedAt: new Date() })
      .where(eq(repairJobs.id, linkedRepairs[0].id));
  }

  revalidatePath("/invoices");
  revalidatePath("/repairs");
  return { success: true };
}

// ─── Overdue invoices (unpaid > N days) ───

export interface OverdueInvoice extends InvoiceWithRepair {
  daysOverdue: number;
}

export async function getOverdueInvoices(thresholdDays = 30): Promise<OverdueInvoice[]> {
  await requireAuth();
  const all = await getAllInvoices();
  const now = Date.now();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  return all
    .filter((inv) => {
      // Only unpaid or partial (status 0 or 2), not draft
      if (inv.status === 1) return false;
      if ((inv as any).draft === 1) return false;
      // Must have a date
      if (!inv.date) return false;
      const invoiceDate = inv.date * 1000;
      return now - invoiceDate > thresholdMs;
    })
    .map((inv) => ({
      ...inv,
      daysOverdue: Math.floor((now - (inv.date ?? 0) * 1000) / (24 * 60 * 60 * 1000)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ─── Send payment reminder via Holded ───

export async function sendPaymentReminder(invoiceId: string, emails: string[]) {
  await requireRole("staff");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");
  if (!emails.length) throw new Error("No email addresses provided");

  await sendInvoice(invoiceId, emails);

  // Track when the reminder was sent on the linked repair job
  await db
    .update(repairJobs)
    .set({ lastPaymentReminderAt: new Date(), updatedAt: new Date() })
    .where(eq(repairJobs.holdedInvoiceId, invoiceId));

  revalidatePath("/invoices");
  return { success: true };
}

// ─── Quotes from Holded ───

export interface QuoteWithRepair extends HoldedQuote {
  repairJobId?: string;
  repairPublicCode?: string;
  repairHasInvoice?: boolean;
  customerName?: string;
}

export async function getAllQuotes(): Promise<QuoteWithRepair[]> {
  await requireAuth();
  if (!isHoldedConfigured()) return [];

  let holdedQuotes: HoldedQuote[];
  try {
    holdedQuotes = filterRepairQuotes(await listAllQuotes());
  } catch {
    return [];
  }

  // Get repair jobs that have holdedQuoteId to link them
  const linkedRepairs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      holdedQuoteId: repairJobs.holdedQuoteId,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
    })
    .from(repairJobs)
    .where(and(isNotNull(repairJobs.holdedQuoteId), isNull(repairJobs.deletedAt)));

  const repairByQuote = new Map<string, { id: string; publicCode: string | null; hasInvoice: boolean }>();
  for (const r of linkedRepairs) {
    if (r.holdedQuoteId) repairByQuote.set(r.holdedQuoteId, { id: r.id, publicCode: r.publicCode, hasInvoice: !!r.holdedInvoiceId });
  }

  // Get customer names mapped by holdedContactId
  const dbCustomers = await db
    .select({ id: customers.id, name: customers.name, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));
  const customerByHolded = new Map<string, string>();
  for (const c of dbCustomers) {
    if (c.holdedContactId) customerByHolded.set(c.holdedContactId, c.name);
  }

  return holdedQuotes.map((q) => {
    const repair = repairByQuote.get(q.id);
    return {
      ...q,
      repairJobId: repair?.id,
      repairPublicCode: repair?.publicCode ?? undefined,
      repairHasInvoice: repair?.hasInvoice ?? false,
      customerName: customerByHolded.get(q.contact) ?? q.contactName,
    };
  }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

// ─── Overdue Estimates (quotes that were never invoiced) ───

export interface OverdueEstimate extends QuoteWithRepair {
  daysOverdue: number;
  customerEmail?: string;
}

export async function getOverdueEstimates(thresholdDays = 30): Promise<OverdueEstimate[]> {
  await requireAuth();
  const all = await getAllQuotes();
  const now = Date.now();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  // Get customer emails
  const dbCustomers = await db
    .select({ holdedContactId: customers.holdedContactId, email: customers.email })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));
  const emailByHolded = new Map<string, string>();
  for (const c of dbCustomers) {
    if (c.holdedContactId && c.email) emailByHolded.set(c.holdedContactId, c.email);
  }

  return all
    .filter((q) => {
      // Only unconverted quotes (status 0 = pending)
      if (q.status === 1) return false; // approved/converted
      if (q.status === -1) return false; // cancelled/declined by customer
      if (q.repairHasInvoice) return false; // linked repair already has a Holded invoice
      if (!q.date) return false;
      if (q.total <= 0) return false;
      const quoteDate = q.date * 1000;
      return now - quoteDate > thresholdMs;
    })
    .map((q) => ({
      ...q,
      daysOverdue: Math.floor((now - (q.date ?? 0) * 1000) / (24 * 60 * 60 * 1000)),
      customerEmail: emailByHolded.get(q.contact) ?? undefined,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
