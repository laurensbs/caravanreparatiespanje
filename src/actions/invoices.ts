"use server";

import { db } from "@/lib/db";
import { repairJobs, customers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, type HoldedInvoice } from "@/lib/holded/invoices";
import { eq, isNotNull } from "drizzle-orm";

export interface InvoiceWithRepair extends HoldedInvoice {
  repairJobId?: string;
  repairPublicCode?: string;
  customerName?: string;
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
    .select({ id: customers.id, name: customers.name, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));
  const customerByHolded = new Map<string, string>();
  for (const c of dbCustomers) {
    if (c.holdedContactId) customerByHolded.set(c.holdedContactId, c.name);
  }

  // Merge
  return holdedInvoices.map((inv) => {
    const repair = repairByInvoice.get(inv.id);
    return {
      ...inv,
      repairJobId: repair?.id,
      repairPublicCode: repair?.publicCode ?? undefined,
      customerName: customerByHolded.get(inv.contactId) ?? inv.contactName,
    };
  }).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}
