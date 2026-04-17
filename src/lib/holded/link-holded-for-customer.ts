/**
 * Koppel Holded-facturen en -offertes op één contact aan reparaties van die klant
 * (zelfde matching als payment/quote sync, maar alleen voor één customerId).
 */
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import {
  getInvoice,
  getQuote,
  listInvoicesByContact,
  listQuotesByContact,
  type HoldedInvoice,
} from "@/lib/holded/invoices";
import { isNonRepairInvoice, filterRepairQuotes } from "@/lib/holded/filter";
import {
  buildHoldedInvoiceHaystackLower,
  buildHoldedQuoteHaystackLower,
  pickRepairForHoldedDocument,
  type RepairHoldedMatchFields,
} from "@/lib/holded/repair-ref-match";

const PAYMENT_TOLERANCE_EUR = 0.05;

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

function holdedInvoicePanelStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) {
    const remaining = getPartiallyPaidRemaining(inv);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
    if (remaining === null && inv.total > 0 && inv.total <= PAYMENT_TOLERANCE_EUR * 2) {
      return "paid";
    }
  }
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

export type LinkHoldedForCustomerResult = {
  customerId: string;
  holdedContactId: string;
  invoicesLinked: { invoiceId: string; docNumber: string; repairId: string }[];
  quotesLinked: { quoteId: string; docNumber: string; repairId: string }[];
  invoicesSkipped: string[];
  quotesSkipped: string[];
  errors: string[];
};

export async function linkHoldedDocumentsForCustomer(
  customerId: string,
  options?: { dryRun?: boolean },
): Promise<LinkHoldedForCustomerResult> {
  const dryRun = options?.dryRun ?? false;
  const result: LinkHoldedForCustomerResult = {
    customerId,
    holdedContactId: "",
    invoicesLinked: [],
    quotesLinked: [],
    invoicesSkipped: [],
    quotesSkipped: [],
    errors: [],
  };

  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  if (!customer?.holdedContactId) {
    result.errors.push("Customer has no holded_contact_id — push/sync contact first.");
    return result;
  }
  result.holdedContactId = customer.holdedContactId;

  const customerRepairs = await db
    .select({
      id: repairJobs.id,
      customerId: repairJobs.customerId,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedQuoteId: repairJobs.holdedQuoteId,
      invoiceStatus: repairJobs.invoiceStatus,
      status: repairJobs.status,
      publicCode: repairJobs.publicCode,
      spreadsheetInternalId: repairJobs.spreadsheetInternalId,
      title: repairJobs.title,
      createdAt: repairJobs.createdAt,
      completedAt: repairJobs.completedAt,
      registration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(and(eq(repairJobs.customerId, customerId), isNull(repairJobs.deletedAt)));

  const linkedInvoiceIds = new Set(
    (
      await db
        .select({ id: repairJobs.holdedInvoiceId })
        .from(repairJobs)
        .where(isNotNull(repairJobs.holdedInvoiceId))
    )
      .map((r) => r.id)
      .filter(Boolean) as string[],
  );

  const linkedQuoteIds = new Set(
    (
      await db
        .select({ id: repairJobs.holdedQuoteId })
        .from(repairJobs)
        .where(isNotNull(repairJobs.holdedQuoteId))
    )
      .map((r) => r.id)
      .filter(Boolean) as string[],
  );

  const manualInvoiceStatuses = ["warranty", "our_costs", "no_damage", "rejected"];

  // ─── Invoices on this Holded contact ───
  const onContact = await listInvoicesByContact(customer.holdedContactId);
  for (const summary of onContact) {
    try {
      if (linkedInvoiceIds.has(summary.id)) continue;

      let inv = await getInvoice(summary.id);
      if (inv.status === 2 && getPartiallyPaidRemaining(inv) === null) {
        try {
          const detail = await getInvoice(inv.id);
          if (detail.payments) inv.payments = detail.payments;
          if (typeof detail.due === "number") inv.due = detail.due;
        } catch {
          /* keep */
        }
      }

      if (inv.total === 0 && !inv.desc) {
        result.invoicesSkipped.push(`${summary.id} (empty)`);
        continue;
      }
      if (isNonRepairInvoice(inv)) {
        result.invoicesSkipped.push(`${inv.docNumber ?? inv.id} (non-repair filter)`);
        continue;
      }

      const newStatus = holdedInvoicePanelStatus(inv);
      const unlinked = customerRepairs.filter(
        (r) => !r.holdedInvoiceId && !manualInvoiceStatuses.includes(r.invoiceStatus),
      );
      if (unlinked.length === 0) {
        result.invoicesSkipped.push(`${inv.docNumber ?? inv.id} (no unlinked repairs)`);
        continue;
      }

      const invText = buildHoldedInvoiceHaystackLower(inv);
      const matchFields: RepairHoldedMatchFields[] = unlinked.map((r) => ({
        id: r.id,
        publicCode: r.publicCode,
        spreadsheetInternalId: r.spreadsheetInternalId,
        title: r.title,
        registration: r.registration,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));

      const chosen = pickRepairForHoldedDocument(invText, matchFields, inv.date * 1000);
      const matched = chosen ? unlinked.find((r) => r.id === chosen.id) : undefined;
      if (!matched) {
        result.invoicesSkipped.push(`${inv.docNumber ?? inv.id} (no confident repair match)`);
        continue;
      }

      const advanceStatus =
        (newStatus === "paid" || newStatus === "sent") && earlyStatuses.includes(matched.status);

      if (!dryRun) {
        await db
          .update(repairJobs)
          .set({
            holdedInvoiceId: inv.id,
            holdedInvoiceNum: inv.docNumber,
            holdedInvoiceDate: new Date(inv.date * 1000),
            invoiceStatus: newStatus,
            ...(advanceStatus
              ? { status: "invoiced" as const, completedAt: matched.completedAt ?? new Date() }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, matched.id));

        await db.insert(repairJobEvents).values({
          repairJobId: matched.id,
          eventType: "invoice_discovered",
          fieldChanged: "holdedInvoiceId",
          oldValue: "",
          newValue: inv.docNumber ?? inv.id,
          comment: `Invoice linked (customer-scoped) — ${inv.docNumber ?? inv.id}`,
        });
        matched.holdedInvoiceId = inv.id;
        linkedInvoiceIds.add(inv.id);
      }

      result.invoicesLinked.push({
        invoiceId: inv.id,
        docNumber: inv.docNumber ?? inv.id,
        repairId: matched.id,
      });
    } catch (e) {
      result.errors.push(`invoice ${summary.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── Quotes on this Holded contact ───
  const rawQuotes = await listQuotesByContact(customer.holdedContactId);
  const holdedQuotes = filterRepairQuotes(rawQuotes);

  for (const q of holdedQuotes) {
    try {
      if (linkedQuoteIds.has(q.id)) continue;

      const unlinked = customerRepairs.filter((r) => !r.holdedQuoteId);
      if (unlinked.length === 0) {
        result.quotesSkipped.push(`${q.docNumber ?? q.id} (no unlinked repairs for quote)`);
        continue;
      }

      const full = await getQuote(q.id);
      const qText = buildHoldedQuoteHaystackLower(full);

      const matchFields: RepairHoldedMatchFields[] = unlinked.map((r) => ({
        id: r.id,
        publicCode: r.publicCode,
        spreadsheetInternalId: r.spreadsheetInternalId,
        title: r.title,
        registration: r.registration,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));

      const chosen = pickRepairForHoldedDocument(qText, matchFields, q.date * 1000);
      const matched = chosen ? unlinked.find((r) => r.id === chosen.id) : undefined;
      if (!matched) {
        result.quotesSkipped.push(`${q.docNumber ?? q.id} (no confident repair match)`);
        continue;
      }

      if (!dryRun) {
        await db
          .update(repairJobs)
          .set({
            holdedQuoteId: q.id,
            holdedQuoteNum: q.docNumber,
            holdedQuoteDate: q.date ? new Date(q.date * 1000) : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, matched.id));

        await db.insert(repairJobEvents).values({
          repairJobId: matched.id,
          eventType: "quote_discovered",
          fieldChanged: "holdedQuoteId",
          oldValue: "",
          newValue: q.docNumber ?? q.id,
          comment: `Quote linked (customer-scoped) — ${q.docNumber ?? q.id}`,
        });
        matched.holdedQuoteId = q.id;
        linkedQuoteIds.add(q.id);
      }

      result.quotesLinked.push({
        quoteId: q.id,
        docNumber: q.docNumber ?? q.id,
        repairId: matched.id,
      });
    } catch (e) {
      result.errors.push(`quote ${q.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
