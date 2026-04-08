"use server";

import { db } from "@/lib/db";
import { repairJobs, customers } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, payInvoice, type HoldedInvoice } from "@/lib/holded/invoices";
import { eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface InvoiceWithRepair extends HoldedInvoice {
  repairJobId?: string;
  repairPublicCode?: string;
  customerName?: string;
  customerEmail?: string;
}

export async function getAllInvoices(): Promise<InvoiceWithRepair[]> {
  await requireAuth();
  if (!isHoldedConfigured()) return [];

  // Fetch invoices from Holded
  let holdedInvoices: HoldedInvoice[];
  try {
    holdedInvoices = await listAllInvoices();
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
    })
    .from(repairJobs)
    .where(isNotNull(repairJobs.holdedInvoiceId));

  const repairByInvoice = new Map<string, { id: string; publicCode: string | null; customerId: string | null }>();
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
