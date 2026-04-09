"use server";

import { db } from "@/lib/db";
import { repairJobs, customers, repairJobEvents } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { createAuditLog } from "./audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  findOrCreateContact,
  createInvoice,
  createQuote,
  getInvoice,
  getQuote,
  getInvoicePdf,
  getQuotePdf,
  sendInvoice,
  sendQuote,
  listInvoicesByContact,
  updateContact as updateHoldedContact,
  getContact,
  type HoldedInvoice,
  type HoldedContact,
} from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";

// ─── Invoice creation from repair ───

interface LineItemInput {
  name: string;
  units: number;
  subtotal: number;
  tax: number;
  discount: number;
}

export async function createHoldedInvoice(repairJobId: string, lineItems?: LineItemInput[], discountPercent?: number) {
  const session = await requireRole("admin");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job) throw new Error("Repair job not found");
  if (job.holdedInvoiceId) throw new Error("Invoice already exists in Holded");

  let customer = null;
  if (job.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, job.customerId))
      .limit(1);
    customer = c ?? null;
  }

  if (!customer) throw new Error("No customer linked to this repair");

  const contactId = await findOrCreateContact({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    holdedContactId: customer.holdedContactId,
  });

  if (!customer.holdedContactId) {
    await db
      .update(customers)
      .set({ holdedContactId: contactId, updatedAt: new Date() })
      .where(eq(customers.id, customer.id));
  }

  let items: Array<{ name: string; desc?: string; units: number; subtotal: number; tax?: number; discount?: number }>;

  if (lineItems && lineItems.length > 0) {
    items = lineItems.map(l => ({
      name: l.name,
      units: l.units,
      subtotal: l.subtotal,
      tax: l.tax,
      discount: discountPercent ?? l.discount,
    }));
  } else {
    const cost = job.actualCost ?? job.estimatedCost;
    items = [
      {
        name: `Repair: ${job.title ?? job.publicCode ?? "Repair service"}`,
        desc: job.descriptionRaw?.slice(0, 200) ?? undefined,
        units: 1,
        subtotal: cost ? parseFloat(cost) : 0,
      },
    ];
  }

  const result = await createInvoice({
    contactId,
    description: `${job.publicCode ?? "Repair"} — ${job.title ?? "Caravan repair service"}`,
    items,
    notes: job.notesRaw ?? undefined,
  });

  const invoiceNum = result.docNumber ?? result.id;

  // Fetch actual date from Holded
  let invoiceDate = new Date();
  try {
    const inv = await getInvoice(result.id);
    if (inv.date) invoiceDate = new Date(inv.date * 1000);
  } catch { /* fallback to now */ }

  await db
    .update(repairJobs)
    .set({
      holdedInvoiceId: result.id,
      holdedInvoiceNum: invoiceNum,
      holdedInvoiceDate: invoiceDate,
      invoiceStatus: "sent",
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_invoice_created",
    fieldChanged: "holdedInvoiceId",
    newValue: invoiceNum,
    comment: `Invoice ${invoiceNum} created in Holded`,
  });

  await createAuditLog("holded_invoice_created", "repair_job", repairJobId, {
    holdedInvoiceId: result.id,
    invoiceNum,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  revalidatePath("/repairs");
  return { invoiceId: result.id, invoiceNum };
}

// ─── PDF download ───

export async function downloadHoldedInvoicePdf(repairJobId: string) {
  await requireAuth();

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedInvoiceId) throw new Error("No Holded invoice linked");

  const buffer = await getInvoicePdf(job.holdedInvoiceId);
  return {
    data: Buffer.from(buffer).toString("base64"),
    filename: `invoice-${job.holdedInvoiceNum ?? job.publicCode}.pdf`,
  };
}

// ─── Send invoice by email ───

export async function sendHoldedInvoice(repairJobId: string) {
  const session = await requireRole("admin");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedInvoiceId) throw new Error("No Holded invoice linked");
  if (!job.customerId) throw new Error("No customer linked");

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, job.customerId))
    .limit(1);

  if (!customer?.email) throw new Error("Customer has no email address");

  await sendInvoice(job.holdedInvoiceId, [customer.email]);

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_invoice_sent",
    comment: `Invoice sent to ${customer.email}`,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  return { sent: true };
}

// ─── Quote PDF download ───

export async function downloadHoldedQuotePdf(repairJobId: string) {
  await requireAuth();

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedQuoteId) throw new Error("No Holded quote linked");

  const buffer = await getQuotePdf(job.holdedQuoteId);
  return {
    data: Buffer.from(buffer).toString("base64"),
    filename: `quote-${job.holdedQuoteNum ?? job.publicCode}.pdf`,
  };
}

// ─── Send quote by email ───

export async function sendHoldedQuote(repairJobId: string) {
  const session = await requireRole("admin");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedQuoteId) throw new Error("No Holded quote linked");
  if (!job.customerId) throw new Error("No customer linked");

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, job.customerId))
    .limit(1);

  if (!customer?.email) throw new Error("Customer has no email address");

  await sendQuote(job.holdedQuoteId, [customer.email]);

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_quote_sent",
    comment: `Quote sent to ${customer.email}`,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  return { sent: true };
}

// ─── Direct PDF downloads by Holded ID ───

export async function downloadInvoicePdfById(holdedInvoiceId: string) {
  await requireAuth();
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const buffer = await getInvoicePdf(holdedInvoiceId);
  return {
    data: Buffer.from(buffer).toString("base64"),
    filename: `invoice-${holdedInvoiceId}.pdf`,
  };
}

export async function downloadQuotePdfById(holdedQuoteId: string) {
  await requireAuth();
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const buffer = await getQuotePdf(holdedQuoteId);
  return {
    data: Buffer.from(buffer).toString("base64"),
    filename: `quote-${holdedQuoteId}.pdf`,
  };
}

// ─── Quote creation from repair ───

export async function createHoldedQuote(repairJobId: string, lineItems: LineItemInput[], discountPercent?: number) {
  const session = await requireRole("admin");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job) throw new Error("Repair job not found");
  if (job.holdedQuoteId) throw new Error("Quote already exists in Holded");

  let customer = null;
  if (job.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, job.customerId))
      .limit(1);
    customer = c ?? null;
  }

  if (!customer) throw new Error("No customer linked to this repair");

  const contactId = await findOrCreateContact({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    holdedContactId: customer.holdedContactId,
  });

  if (!customer.holdedContactId) {
    await db
      .update(customers)
      .set({ holdedContactId: contactId, updatedAt: new Date() })
      .where(eq(customers.id, customer.id));
  }

  const items = lineItems.map(l => ({
    name: l.name,
    units: l.units,
    subtotal: l.subtotal,
    tax: l.tax,
    discount: discountPercent ?? l.discount,
  }));

  const result = await createQuote({
    contactId,
    description: `${job.publicCode ?? "Quote"} — ${job.title ?? "Caravan repair service"}`,
    items,
    notes: job.notesRaw ?? undefined,
  });

  const quoteNum = result.docNumber ?? result.id;

  // Fetch actual date from Holded
  let quoteDate = new Date();
  try {
    const q = await getQuote(result.id);
    if (q.date) quoteDate = new Date(q.date * 1000);
  } catch { /* fallback to now */ }

  await db
    .update(repairJobs)
    .set({
      holdedQuoteId: result.id,
      holdedQuoteNum: quoteNum,
      holdedQuoteDate: quoteDate,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_quote_created",
    fieldChanged: "holdedQuoteId",
    newValue: quoteNum,
    comment: `Quote ${quoteNum} created in Holded`,
  });

  await createAuditLog("holded_quote_created", "repair_job", repairJobId, {
    holdedQuoteId: result.id,
    quoteNum,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  revalidatePath("/repairs");
  return { quoteId: result.id, quoteNum };
}

// ─── Sync customer to Holded ───

export async function syncCustomerToHolded(customerId: string) {
  await requireAuth();
  if (!isHoldedConfigured()) return;

  const { pushContactToHolded } = await import("@/lib/holded/sync");
  await pushContactToHolded(customerId);
}

// ─── Get invoices for customer ───

export async function getCustomerHoldedInvoices(
  customerId: string,
): Promise<HoldedInvoice[]> {
  await requireAuth();
  if (!isHoldedConfigured()) return [];

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer?.holdedContactId) return [];

  try {
    return await listInvoicesByContact(customer.holdedContactId);
  } catch {
    return [];
  }
}

// ─── Check if Holded is configured ───

export async function getHoldedStatus() {
  return { configured: isHoldedConfigured() };
}

// ─── Get Holded contact details ───

export async function getCustomerHoldedContact(
  customerId: string,
): Promise<HoldedContact | null> {
  await requireAuth();
  if (!isHoldedConfigured()) return null;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer?.holdedContactId) return null;

  try {
    return await getContact(customer.holdedContactId);
  } catch {
    return null;
  }
}
