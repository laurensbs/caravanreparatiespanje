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
  getInvoicePdf,
  sendInvoice,
  listInvoicesByContact,
  updateContact as updateHoldedContact,
  getContact,
  type HoldedInvoice,
  type HoldedContact,
} from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";

// ─── Invoice creation from repair ───

export async function createHoldedInvoice(repairJobId: string) {
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

  const cost = job.actualCost ?? job.estimatedCost;
  const items = [
    {
      name: `Repair: ${job.title ?? job.publicCode ?? "Repair service"}`,
      desc: job.descriptionRaw?.slice(0, 200) ?? undefined,
      units: 1,
      subtotal: cost ? parseFloat(cost) : 0,
    },
  ];

  const result = await createInvoice({
    contactId,
    description: `${job.publicCode ?? "Repair"} — ${job.title ?? "Caravan repair service"}`,
    items,
    notes: job.notesRaw ?? undefined,
  });

  await db
    .update(repairJobs)
    .set({
      holdedInvoiceId: result.id,
      holdedInvoiceNum: result.invoiceNum,
      invoiceStatus: "sent",
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_invoice_created",
    fieldChanged: "holdedInvoiceId",
    newValue: result.invoiceNum,
    comment: `Invoice ${result.invoiceNum} created in Holded`,
  });

  await createAuditLog("holded_invoice_created", "repair_job", repairJobId, {
    holdedInvoiceId: result.id,
    invoiceNum: result.invoiceNum,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  revalidatePath("/repairs");
  return { invoiceId: result.id, invoiceNum: result.invoiceNum };
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
