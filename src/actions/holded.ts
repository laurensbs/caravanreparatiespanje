"use server";

import { db } from "@/lib/db";
import { repairJobs, customers, repairJobEvents, units } from "@/lib/db/schema";
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
  deleteDocument,
  listInvoicesByContact,
  listQuotesByContact,
  updateContact as updateHoldedContact,
  getContact,
  type HoldedInvoice,
  type HoldedQuote,
  type HoldedContact,
} from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";
import { parseHoldedDocumentPaste } from "@/lib/holded/parse-document-paste";
import {
  buildHoldedDocumentSearchText,
  normalizeForPlateSearch,
  resolveUnitForHoldedManualLink,
} from "@/lib/holded/resolve-unit-from-document";
import { matchesSpreadsheetRefInText, repairPublicCodeAppearsInText } from "@/lib/holded/repair-ref-match";
import { linkHoldedDocumentsForCustomer } from "@/lib/holded/link-holded-for-customer";

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

  // Fetch the full document from Holded to get the real docNumber and date
  let invoiceNum = result.id;
  let invoiceDate = new Date();
  try {
    const inv = await getInvoice(result.id);
    if (inv.docNumber) invoiceNum = inv.docNumber;
    if (inv.date) invoiceDate = new Date(inv.date * 1000);
  } catch { /* fallback to id and now */ }

  await db
    .update(repairJobs)
    .set({
      holdedInvoiceId: result.id,
      holdedInvoiceNum: invoiceNum,
      holdedInvoiceDate: invoiceDate,
      invoiceStatus: "draft",
      status: "invoiced",
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

  await db
    .update(repairJobs)
    .set({ invoiceStatus: "sent", holdedInvoiceSentAt: new Date(), updatedAt: new Date() })
    .where(eq(repairJobs.id, repairJobId));

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

  await db
    .update(repairJobs)
    .set({ customerResponseStatus: "waiting_response", holdedQuoteSentAt: new Date(), updatedAt: new Date() })
    .where(eq(repairJobs.id, repairJobId));

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

  // Fetch the full document from Holded to get the real docNumber and date
  let quoteNum = result.id;
  let quoteDate = new Date();
  try {
    const q = await getQuote(result.id);
    if (q.docNumber) quoteNum = q.docNumber;
    if (q.date) quoteDate = new Date(q.date * 1000);
  } catch { /* fallback to id and now */ }

  await db
    .update(repairJobs)
    .set({
      holdedQuoteId: result.id,
      holdedQuoteNum: quoteNum,
      holdedQuoteDate: quoteDate,
      status: "waiting_approval",
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
    const { filterRepairInvoices } = await import("@/lib/holded/filter");
    return filterRepairInvoices(await listInvoicesByContact(customer.holdedContactId));
  } catch {
    return [];
  }
}

// ─── Get quotes for customer ───

export async function getCustomerHoldedQuotes(
  customerId: string,
): Promise<HoldedQuote[]> {
  await requireAuth();
  if (!isHoldedConfigured()) return [];

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer?.holdedContactId) return [];

  try {
    const { filterRepairQuotes } = await import("@/lib/holded/filter");
    return filterRepairQuotes(await listQuotesByContact(customer.holdedContactId));
  } catch {
    return [];
  }
}

// ─── Check if Holded is configured ───

export async function getHoldedStatus() {
  return { configured: isHoldedConfigured() };
}

// ─── Get Holded contact details ───

const LINK_INVOICE_PAYMENT_TOLERANCE_EUR = 0.05;

/** Overwrite panel customer fields from Holded contact when linking a document (Holded as source of truth for address etc.). */
async function mergeCustomerFieldsFromHoldedContact(
  customerId: string,
  holdedContactId: string,
): Promise<void> {
  const hc = await getContact(holdedContactId);
  const bill = hc.billAddress;
  const updates: Record<string, unknown> = {
    holdedContactId,
    holdedSyncedAt: new Date(),
    updatedAt: new Date(),
  };
  if (hc.name?.trim()) updates.name = hc.name.trim();
  if (hc.email?.trim()) updates.email = hc.email.trim();
  if (hc.phone?.trim()) updates.phone = hc.phone.trim();
  if (hc.mobile?.trim()) updates.mobile = hc.mobile.trim();
  if (hc.vatnumber?.trim()) updates.vatnumber = hc.vatnumber.trim();
  if (bill?.address?.trim()) updates.address = bill.address.trim();
  if (bill?.city?.trim()) updates.city = bill.city.trim();
  if (bill?.postalCode?.trim()) updates.postalCode = bill.postalCode.trim();
  if (bill?.province?.trim()) updates.province = bill.province.trim();
  if (bill?.country?.trim()) updates.country = bill.country.trim();

  await db.update(customers).set(updates).where(eq(customers.id, customerId));
}

/** Copy Holded contact custom fields onto a specific unit when Kenteken matches (multi-unit safe). */
async function mergeUnitFieldsFromHoldedContact(
  unitId: string,
  holdedContactId: string,
  options: { customerUnitCount: number },
): Promise<boolean> {
  const [unit] = await db.select().from(units).where(eq(units.id, unitId)).limit(1);
  if (!unit) return false;

  const hc = await getContact(holdedContactId);
  const cf = hc.customFields;
  if (!cf?.length) return false;

  const getVal = (field: string) => cf.find((f) => f.field === field)?.value?.trim() ?? "";

  const kentekenCf = getVal("Kenteken");
  const kNorm = kentekenCf ? normalizeForPlateSearch(kentekenCf) : "";
  const uNorm = unit.registration ? normalizeForPlateSearch(unit.registration) : "";

  if (options.customerUnitCount > 1) {
    if (!kentekenCf || !uNorm || kNorm !== uNorm) return false;
  } else if (kentekenCf && uNorm && kNorm !== uNorm) {
    return false;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const merk = getVal("Merk Caravan");
  const type = getVal("Type Caravan");
  const lengte = getVal("Lengte Caravan");
  const stalling = getVal("Stalling");
  const stallingType = getVal("Stalling Type");
  const nfc = getVal("NFC Tag");
  const checklist = getVal("Checklist");
  const positie = getVal("Huidige Positie");

  if (merk) updates.brand = merk;
  if (type) updates.model = type;
  if (lengte) updates.length = lengte;
  if (stalling) updates.storageLocation = stalling;
  if (stallingType) updates.storageType = stallingType;
  if (nfc) updates.nfcTag = nfc;
  if (checklist) updates.checklist = checklist;
  if (positie) updates.currentPosition = positie;
  if (kentekenCf && !unit.registration?.trim()) updates.registration = kentekenCf.trim();

  const changedKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
  if (changedKeys.length === 0) return false;

  await db.update(units).set(updates).where(eq(units.id, unitId));
  return true;
}

function mapLinkedInvoiceStatusFromHolded(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) {
    if (typeof inv.due === "number" && Math.abs(inv.due) <= LINK_INVOICE_PAYMENT_TOLERANCE_EUR) {
      return "paid";
    }
    if (inv.payments && inv.payments.length > 0) {
      const paid = inv.payments.reduce((s, p) => s + (p.amount ?? 0), 0);
      const remaining = Math.max(0, inv.total - paid);
      if (remaining <= LINK_INVOICE_PAYMENT_TOLERANCE_EUR) return "paid";
    }
  }
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

/**
 * Manually attach an existing Holded estimate or invoice to this repair (validates via Holded API).
 * Manager-only. Does not create documents in Holded.
 */
export async function linkHoldedDocumentToRepair(
  repairJobId: string,
  kind: "quote" | "invoice",
  rawDocumentId: string,
): Promise<
  | { ok: true; customerSynced?: boolean; unitSynced?: boolean; unitIdChanged?: boolean }
  | { ok: false; message: string }
> {
  try {
    const session = await requireRole("manager");
    if (!isHoldedConfigured()) return { ok: false, message: "Holded not configured" };

    const parsed = parseHoldedDocumentPaste(rawDocumentId);
    const documentId = parsed.documentId;
    if (!documentId) return { ok: false, message: "Paste a Holded link or document ID" };

    const effectiveKind: "quote" | "invoice" = parsed.detectedKind ?? kind;

    const [job] = await db.select().from(repairJobs).where(eq(repairJobs.id, repairJobId)).limit(1);
    if (!job) return { ok: false, message: "Repair not found" };

    let customer: (typeof customers.$inferSelect) | null = null;
    if (job.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, job.customerId)).limit(1);
      customer = c ?? null;
    }

    if (effectiveKind === "quote" && job.holdedQuoteId) {
      return { ok: false, message: "This repair already has a linked quote. Remove or unlink it first." };
    }
    if (effectiveKind === "invoice" && job.holdedInvoiceId) {
      return { ok: false, message: "This repair already has a linked invoice." };
    }

    const doc = effectiveKind === "quote" ? await getQuote(documentId) : await getInvoice(documentId);

    if (customer?.holdedContactId && doc.contact !== customer.holdedContactId) {
      return {
        ok: false,
        message:
          effectiveKind === "quote"
            ? "That quote belongs to a different Holded contact than the customer on this work order."
            : "That invoice belongs to a different Holded contact than the customer on this work order.",
      };
    }
    if (customer && !customer.holdedContactId && job.customerId) {
      await db
        .update(customers)
        .set({ holdedContactId: doc.contact, updatedAt: new Date() })
        .where(eq(customers.id, job.customerId));
    }

    const docText = buildHoldedDocumentSearchText(doc);
    const customerUnits = job.customerId
      ? await db
          .select({
            id: units.id,
            registration: units.registration,
            internalNumber: units.internalNumber,
          })
          .from(units)
          .where(eq(units.customerId, job.customerId))
      : [];

    const unitRes = resolveUnitForHoldedManualLink({
      jobUnitId: job.unitId,
      units: customerUnits,
      documentText: docText,
    });
    if (!unitRes.ok) return { ok: false, message: unitRes.message };

    const unitPatch: { unitId?: string } = {};
    if ("updateUnitId" in unitRes) unitPatch.unitId = unitRes.updateUnitId;
    const finalUnitId = "updateUnitId" in unitRes ? unitRes.updateUnitId : job.unitId;

    let customerSynced = false;
    let unitSynced = false;

    if (effectiveKind === "quote") {
      const q = doc;
      await db
        .update(repairJobs)
        .set({
          holdedQuoteId: q.id,
          holdedQuoteNum: q.docNumber || q.id,
          holdedQuoteDate: q.date ? new Date(q.date * 1000) : new Date(),
          ...unitPatch,
          updatedAt: new Date(),
        })
        .where(eq(repairJobs.id, repairJobId));

      await db.insert(repairJobEvents).values({
        repairJobId,
        userId: session.user.id,
        eventType: "holded_quote_linked",
        fieldChanged: "holdedQuoteId",
        oldValue: "",
        newValue: q.docNumber ?? q.id,
        comment: `Manually linked Holded quote ${q.docNumber ?? q.id}`,
      });

      if ("updateUnitId" in unitRes && unitRes.updateUnitId !== job.unitId) {
        await db.insert(repairJobEvents).values({
          repairJobId,
          userId: session.user.id,
          eventType: "unit_resolved_from_holded_doc",
          fieldChanged: "unitId",
          oldValue: job.unitId ?? "",
          newValue: unitRes.updateUnitId,
          comment: "Caravan matched from license plate text in the linked Holded document",
        });
      }

      if (job.customerId) {
        try {
          await mergeCustomerFieldsFromHoldedContact(job.customerId, q.contact);
          customerSynced = true;
          await db.insert(repairJobEvents).values({
            repairJobId,
            userId: session.user.id,
            eventType: "holded_customer_synced",
            fieldChanged: "customer",
            oldValue: "",
            newValue: q.contact,
            comment: "Customer fields refreshed from Holded contact after linking quote",
          });
        } catch {
          /* non-fatal */
        }
      }
      if (finalUnitId) {
        try {
          if (await mergeUnitFieldsFromHoldedContact(finalUnitId, q.contact, { customerUnitCount: customerUnits.length })) {
            unitSynced = true;
            await db.insert(repairJobEvents).values({
              repairJobId,
              userId: session.user.id,
              eventType: "holded_unit_synced",
              fieldChanged: "unit",
              oldValue: "",
              newValue: finalUnitId,
              comment: "Unit fields refreshed from Holded contact custom fields after linking quote",
            });
          }
        } catch {
          /* non-fatal */
        }
      }
    } else {
      const inv = doc;
      const invoiceStatus = mapLinkedInvoiceStatusFromHolded(inv);
      await db
        .update(repairJobs)
        .set({
          holdedInvoiceId: inv.id,
          holdedInvoiceNum: inv.docNumber || inv.id,
          holdedInvoiceDate: inv.date ? new Date(inv.date * 1000) : new Date(),
          invoiceStatus,
          ...unitPatch,
          updatedAt: new Date(),
        })
        .where(eq(repairJobs.id, repairJobId));

      await db.insert(repairJobEvents).values({
        repairJobId,
        userId: session.user.id,
        eventType: "holded_invoice_linked",
        fieldChanged: "holdedInvoiceId",
        oldValue: "",
        newValue: inv.docNumber ?? inv.id,
        comment: `Manually linked Holded invoice ${inv.docNumber ?? inv.id} (${invoiceStatus})`,
      });

      if ("updateUnitId" in unitRes && unitRes.updateUnitId !== job.unitId) {
        await db.insert(repairJobEvents).values({
          repairJobId,
          userId: session.user.id,
          eventType: "unit_resolved_from_holded_doc",
          fieldChanged: "unitId",
          oldValue: job.unitId ?? "",
          newValue: unitRes.updateUnitId,
          comment: "Caravan matched from license plate text in the linked Holded document",
        });
      }

      if (job.customerId) {
        try {
          await mergeCustomerFieldsFromHoldedContact(job.customerId, inv.contact);
          customerSynced = true;
          await db.insert(repairJobEvents).values({
            repairJobId,
            userId: session.user.id,
            eventType: "holded_customer_synced",
            fieldChanged: "customer",
            oldValue: "",
            newValue: inv.contact,
            comment: "Customer fields refreshed from Holded contact after linking invoice",
          });
        } catch {
          /* non-fatal */
        }
      }
      if (finalUnitId) {
        try {
          if (
            await mergeUnitFieldsFromHoldedContact(finalUnitId, inv.contact, {
              customerUnitCount: customerUnits.length,
            })
          ) {
            unitSynced = true;
            await db.insert(repairJobEvents).values({
              repairJobId,
              userId: session.user.id,
              eventType: "holded_unit_synced",
              fieldChanged: "unit",
              oldValue: "",
              newValue: finalUnitId,
              comment: "Unit fields refreshed from Holded contact custom fields after linking invoice",
            });
          }
        } catch {
          /* non-fatal */
        }
      }
    }

    revalidatePath(`/repairs/${repairJobId}`);
    revalidatePath("/repairs");
    revalidatePath("/customers");
    if (finalUnitId) revalidatePath(`/units/${finalUnitId}`);
    const unitIdChanged =
      "updateUnitId" in unitRes ? unitRes.updateUnitId !== job.unitId : false;
    return { ok: true, customerSynced, unitSynced, unitIdChanged };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not link document";
    return { ok: false, message };
  }
}

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

// ─── Verify and fix Holded document links for a repair ───

export async function verifyHoldedDocuments(repairJobId: string) {
  const session = await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);
  if (!job) throw new Error("Repair job not found");

  let customer = null;
  if (job.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, job.customerId))
      .limit(1);
    customer = c ?? null;
  }

  const updates: Record<string, any> = {};
  const issues: string[] = [];

  // Check stored invoice ID
  if (job.holdedInvoiceId) {
    try {
      const inv = await getInvoice(job.holdedInvoiceId);
      // ID is valid — update docNumber if missing/wrong
      if (inv.docNumber && inv.docNumber !== job.holdedInvoiceNum) {
        updates.holdedInvoiceNum = inv.docNumber;
        issues.push(`Invoice number updated to ${inv.docNumber}`);
      }
    } catch {
      // Invoice ID is invalid — try to find it by searching contact
      issues.push("Stored invoice ID not found in Holded");
      if (customer?.holdedContactId) {
        try {
          const contactInvoices = await listInvoicesByContact(customer.holdedContactId);
          const match = contactInvoices.find((inv) => {
            const hay = `${inv.desc ?? ""} ${inv.docNumber ?? ""}`.toLowerCase();
            return (
              repairPublicCodeAppearsInText(job.publicCode, hay) ||
              (!!job.spreadsheetInternalId?.trim() &&
                matchesSpreadsheetRefInText(job.spreadsheetInternalId, hay)) ||
              inv.docNumber === job.holdedInvoiceNum
            );
          });
          if (match) {
            updates.holdedInvoiceId = match.id;
            updates.holdedInvoiceNum = match.docNumber;
            if (match.date) updates.holdedInvoiceDate = new Date(match.date * 1000);
            issues.push(`Found correct invoice: ${match.docNumber}`);
          } else {
            // No match found — clear the broken link
            updates.holdedInvoiceId = null;
            updates.holdedInvoiceNum = null;
            updates.holdedInvoiceDate = null;
            updates.invoiceStatus = "not_invoiced";
            issues.push("No matching invoice found in Holded — cleared broken link");
          }
        } catch {
          issues.push("Could not search contact invoices");
        }
      } else {
        updates.holdedInvoiceId = null;
        updates.holdedInvoiceNum = null;
        updates.holdedInvoiceDate = null;
        updates.invoiceStatus = "not_invoiced";
        issues.push("No Holded contact — cleared broken link");
      }
    }
  }

  // Check stored quote ID
  if (job.holdedQuoteId) {
    try {
      const q = await getQuote(job.holdedQuoteId);
      if (q.docNumber && q.docNumber !== job.holdedQuoteNum) {
        updates.holdedQuoteNum = q.docNumber;
        issues.push(`Quote number updated to ${q.docNumber}`);
      }
    } catch {
      issues.push("Stored quote ID not found in Holded");
      if (customer?.holdedContactId) {
        try {
          const contactQuotes = await listQuotesByContact(customer.holdedContactId);
          const match = contactQuotes.find((q) => {
            const hay = `${q.desc ?? ""} ${q.docNumber ?? ""}`.toLowerCase();
            return (
              repairPublicCodeAppearsInText(job.publicCode, hay) ||
              (!!job.spreadsheetInternalId?.trim() &&
                matchesSpreadsheetRefInText(job.spreadsheetInternalId, hay)) ||
              q.docNumber === job.holdedQuoteNum
            );
          });
          if (match) {
            updates.holdedQuoteId = match.id;
            updates.holdedQuoteNum = match.docNumber;
            if (match.date) updates.holdedQuoteDate = new Date(match.date * 1000);
            issues.push(`Found correct quote: ${match.docNumber}`);
          } else {
            updates.holdedQuoteId = null;
            updates.holdedQuoteNum = null;
            updates.holdedQuoteDate = null;
            issues.push("No matching quote found in Holded — cleared broken link");
          }
        } catch {
          issues.push("Could not search contact quotes");
        }
      } else {
        updates.holdedQuoteId = null;
        updates.holdedQuoteNum = null;
        updates.holdedQuoteDate = null;
        issues.push("No Holded contact — cleared broken link");
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db
      .update(repairJobs)
      .set(updates)
      .where(eq(repairJobs.id, repairJobId));
  }

  revalidatePath(`/repairs/${repairJobId}`);
  revalidatePath("/repairs");
  return { fixed: Object.keys(updates).length > 0, issues };
}

// ─── Delete Holded quote ───

export async function deleteHoldedQuote(repairJobId: string) {
  const session = await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedQuoteId) throw new Error("No Holded quote linked");

  // Delete from Holded
  await deleteDocument("estimate", job.holdedQuoteId);

  // Clear local fields
  await db
    .update(repairJobs)
    .set({
      holdedQuoteId: null,
      holdedQuoteNum: null,
      holdedQuoteDate: null,
      holdedQuoteSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_quote_deleted",
    comment: `Deleted quote ${job.holdedQuoteNum} from Holded`,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  return { deleted: true };
}

// ─── Delete Holded invoice ───

export async function deleteHoldedInvoice(repairJobId: string) {
  const session = await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job?.holdedInvoiceId) throw new Error("No Holded invoice linked");

  // Safety: don't delete paid invoices
  if (job.invoiceStatus === "paid") throw new Error("Cannot delete a paid invoice");

  // Delete from Holded
  await deleteDocument("invoice", job.holdedInvoiceId);

  // Clear local fields
  await db
    .update(repairJobs)
    .set({
      holdedInvoiceId: null,
      holdedInvoiceNum: null,
      holdedInvoiceDate: null,
      holdedInvoiceSentAt: null,
      invoiceStatus: "not_invoiced",
      status: job.status === "invoiced" ? "completed" : job.status,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "holded_invoice_deleted",
    comment: `Deleted invoice ${job.holdedInvoiceNum} from Holded`,
  });

  revalidatePath(`/repairs/${repairJobId}`);
  return { deleted: true };
}

// ─── Link Holded invoices/quotes on a contact to this customer’s repairs (cron logic, scoped) ───

export async function syncCustomerHoldedRepairLinks(customerId: string) {
  await requireRole("manager");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const res = await linkHoldedDocumentsForCustomer(customerId, {
    sequentialDateFallback: true,
    detachDocumentsLinkedToOtherCustomers: true,
    bypassHoldedNonRepairFilters: true,
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/repairs");
  for (const x of res.invoicesLinked) {
    revalidatePath(`/repairs/${x.repairId}`);
  }
  for (const x of res.quotesLinked) {
    revalidatePath(`/repairs/${x.repairId}`);
  }
  for (const x of res.invoicesDetachedFromOtherRepairs) {
    revalidatePath(`/repairs/${x.previousRepairId}`);
  }
  for (const x of res.quotesDetachedFromOtherRepairs) {
    revalidatePath(`/repairs/${x.previousRepairId}`);
  }

  return res;
}
