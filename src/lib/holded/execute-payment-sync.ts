import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units } from "@/lib/db/schema";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "@/lib/holded/invoices";
import { isNonRepairInvoice } from "@/lib/holded/filter";
import { resolveCustomerIdFromHoldedContact } from "@/lib/holded/resolve-customer-from-contact";
import {
  buildHoldedInvoiceHaystackLower,
  pickRepairForHoldedDocument,
  type RepairHoldedMatchFields,
} from "@/lib/holded/repair-ref-match";

const PAYMENT_TOLERANCE_EUR = 0.05;

function holdedInvoiceStatus(invoice: HoldedInvoice): "draft" | "sent" | "paid" {
  if (invoice.status === 1) return "paid";
  if (invoice.status === 2) {
    const remaining = getPartiallyPaidRemaining(invoice);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
    if (remaining === null && invoice.total > 0 && invoice.total <= PAYMENT_TOLERANCE_EUR * 2) {
      return "paid";
    }
  }
  if (invoice.draft || !invoice.docNumber || invoice.docNumber === "---") return "draft";
  return "sent";
}

function getPartiallyPaidRemaining(invoice: HoldedInvoice): number | null {
  if (typeof invoice.due === "number") {
    return Math.abs(invoice.due);
  }
  if (invoice.payments && invoice.payments.length > 0) {
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return Math.max(0, invoice.total - totalPaid);
  }
  return null;
}

export type HoldedPaymentSyncStats = {
  discovered: number;
  statusUpdated: number;
  statusAdvanced: number;
  errors: number;
  invoicesTotal: number;
  customersResolved: number;
  holdedContactBackfilled: number;
};

const earlyStatuses = [
  "new",
  "todo",
  "in_inspection",
  "quote_needed",
  "waiting_approval",
  "waiting_customer",
  "waiting_parts",
  "scheduled",
  "in_progress",
  "blocked",
  "completed",
];

/** Same logic as the cron job: list Holded invoices, sync status, discover links. */
export async function executeHoldedPaymentSync(): Promise<HoldedPaymentSyncStats> {
  if (!isHoldedConfigured()) {
    throw new Error("Holded not configured");
  }

  const stats: HoldedPaymentSyncStats = {
    discovered: 0,
    statusUpdated: 0,
    statusAdvanced: 0,
    errors: 0,
    invoicesTotal: 0,
    customersResolved: 0,
    holdedContactBackfilled: 0,
  };

  const allInvoices = await listAllInvoices();
  stats.invoicesTotal = allInvoices.length;

  const allRepairs = await db
    .select({
      id: repairJobs.id,
      customerId: repairJobs.customerId,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceDate: repairJobs.holdedInvoiceDate,
      invoiceStatus: repairJobs.invoiceStatus,
      publicCode: repairJobs.publicCode,
      spreadsheetInternalId: repairJobs.spreadsheetInternalId,
      title: repairJobs.title,
      status: repairJobs.status,
      dueDate: repairJobs.dueDate,
      createdAt: repairJobs.createdAt,
      completedAt: repairJobs.completedAt,
      registration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(isNull(repairJobs.deletedAt));

  const allCustomers = await db
    .select({ id: customers.id, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));

  const customerByHoldedId = new Map<string, string>();
  for (const c of allCustomers) {
    if (c.holdedContactId) customerByHoldedId.set(c.holdedContactId, c.id);
  }

  const repairsByCustomer = new Map<string, typeof allRepairs>();
  for (const r of allRepairs) {
    if (!r.customerId) continue;
    const list = repairsByCustomer.get(r.customerId) ?? [];
    list.push(r);
    repairsByCustomer.set(r.customerId, list);
  }

  const repairByInvoiceId = new Map<string, (typeof allRepairs)[0]>();
  for (const r of allRepairs) {
    if (r.holdedInvoiceId) repairByInvoiceId.set(r.holdedInvoiceId, r);
  }

  const contactResolveCache = new Map<string, string | false>();

  for (const inv of allInvoices) {
    if (inv.status === 2 && getPartiallyPaidRemaining(inv) === null) {
      try {
        const detail = await getInvoice(inv.id);
        if (detail.payments) inv.payments = detail.payments;
        if (typeof detail.due === "number") inv.due = detail.due;
      } catch {
        /* keep list payload */
      }
    }
  }

  for (const inv of allInvoices) {
    try {
      const newStatus = holdedInvoiceStatus(inv);

      if (isNonRepairInvoice(inv)) continue;
      if (inv.total === 0 && !inv.desc) continue;

      const existingRepair = repairByInvoiceId.get(inv.id);
      if (existingRepair) {
        const invDate = new Date(inv.date * 1000);
        const manualOverrides = ["warranty", "our_costs", "no_damage", "rejected"];
        const statusChanged =
          existingRepair.invoiceStatus !== newStatus && !manualOverrides.includes(existingRepair.invoiceStatus);
        const dateChanged = existingRepair.holdedInvoiceDate?.getTime() !== invDate.getTime();

        const shouldAdvanceStatus =
          (newStatus === "paid" || newStatus === "sent") && earlyStatuses.includes(existingRepair.status);

        if (statusChanged || dateChanged || shouldAdvanceStatus) {
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (statusChanged) updates.invoiceStatus = newStatus;
          if (dateChanged) updates.holdedInvoiceDate = invDate;
          if (shouldAdvanceStatus) {
            updates.status = "invoiced";
            if (!existingRepair.completedAt) updates.completedAt = new Date();
          }

          await db.update(repairJobs).set(updates).where(eq(repairJobs.id, existingRepair.id));

          if (statusChanged) {
            await db.insert(repairJobEvents).values({
              repairJobId: existingRepair.id,
              eventType: "payment_synced",
              fieldChanged: "invoiceStatus",
              oldValue: existingRepair.invoiceStatus,
              newValue: newStatus,
              comment: `Invoice ${inv.docNumber} status synced: ${existingRepair.invoiceStatus} → ${newStatus}`,
            });
            existingRepair.invoiceStatus = newStatus;
          }
          if (shouldAdvanceStatus) {
            await db.insert(repairJobEvents).values({
              repairJobId: existingRepair.id,
              eventType: "status_changed",
              fieldChanged: "status",
              oldValue: existingRepair.status,
              newValue: "invoiced",
              comment: `Auto-advanced to invoiced — invoice ${inv.docNumber} is ${newStatus}`,
            });
            existingRepair.status = "invoiced";
            stats.statusAdvanced++;
          }
          if (dateChanged) {
            existingRepair.holdedInvoiceDate = invDate;
          }
          stats.statusUpdated++;
        }
        continue;
      }

      let customerId = customerByHoldedId.get(inv.contact);
      if (!customerId) {
        const resolved = await resolveCustomerIdFromHoldedContact(inv.contact, contactResolveCache);
        if (resolved) {
          customerId = resolved.customerId;
          stats.customersResolved++;
          if (resolved.shouldBackfillHoldedContactId) {
            await db
              .update(customers)
              .set({ holdedContactId: inv.contact, updatedAt: new Date() })
              .where(eq(customers.id, resolved.customerId));
            customerByHoldedId.set(inv.contact, resolved.customerId);
            stats.holdedContactBackfilled++;
          }
        }
      }
      if (!customerId) continue;

      const customerRepairs = repairsByCustomer.get(customerId);
      if (!customerRepairs) continue;

      const manualOverrideStatuses = ["warranty", "our_costs", "no_damage", "rejected"];
      const unlinkedRepairs = customerRepairs.filter(
        (r) => !r.holdedInvoiceId && !manualOverrideStatuses.includes(r.invoiceStatus),
      );
      if (unlinkedRepairs.length === 0) continue;

      const invText = buildHoldedInvoiceHaystackLower(inv);

      const matchFields: RepairHoldedMatchFields[] = unlinkedRepairs.map((r) => ({
        id: r.id,
        publicCode: r.publicCode,
        spreadsheetInternalId: r.spreadsheetInternalId,
        title: r.title,
        registration: r.registration,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));

      const chosen = pickRepairForHoldedDocument(invText, matchFields, inv.date * 1000);
      const matched = chosen ? unlinkedRepairs.find((r) => r.id === chosen.id) ?? null : null;

      if (matched) {
        const advanceStatus =
          (newStatus === "paid" || newStatus === "sent") && earlyStatuses.includes(matched.status);
        await db
          .update(repairJobs)
          .set({
            holdedInvoiceId: inv.id,
            holdedInvoiceNum: inv.docNumber,
            holdedInvoiceDate: new Date(inv.date * 1000),
            invoiceStatus: newStatus,
            ...(advanceStatus ? { status: "invoiced" as const, completedAt: matched.completedAt ?? new Date() } : {}),
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, matched.id));

        await db.insert(repairJobEvents).values({
          repairJobId: matched.id,
          eventType: "invoice_discovered",
          fieldChanged: "holdedInvoiceId",
          oldValue: "",
          newValue: inv.docNumber,
          comment: `Invoice ${inv.docNumber} (€${inv.total.toFixed(2)}) linked from Holded — status: ${newStatus}`,
        });

        matched.holdedInvoiceId = inv.id;
        matched.invoiceStatus = newStatus;
        repairByInvoiceId.set(inv.id, matched);
        stats.discovered++;
      }
    } catch {
      stats.errors++;
    }
  }

  return stats;
}
