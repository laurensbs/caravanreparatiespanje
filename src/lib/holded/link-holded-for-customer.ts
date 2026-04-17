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
  /** When counts match, invoices were paired to repairs by invoice date vs repair date (weak match). */
  invoicesLinkedBySequentialFallback: number;
  quotesLinkedBySequentialFallback: number;
  /** Invoice was on this Holded contact but still pointed at another customer’s repair (e.g. after merging contacts). */
  invoicesDetachedFromOtherRepairs: { docNumber: string; previousRepairId: string }[];
  quotesDetachedFromOtherRepairs: { docNumber: string; previousRepairId: string }[];
};

export async function linkHoldedDocumentsForCustomer(
  customerId: string,
  options?: {
    dryRun?: boolean;
    sequentialDateFallback?: boolean;
    /**
     * Clear DB links on *other* customers’ repairs when the document in Holded belongs to this contact
     * (fixes family-split / merged-contact cases where invoices were never re-linked).
     */
    detachDocumentsLinkedToOtherCustomers?: boolean;
    /**
     * Skip stalling/transport keyword filter (isNonRepair*) so documents on this contact can link
     * even when lines mention “huur”, “stalling”, etc. Use for manager “link all on contact” recovery.
     */
    bypassHoldedNonRepairFilters?: boolean;
  },
): Promise<LinkHoldedForCustomerResult> {
  const dryRun = options?.dryRun ?? false;
  const sequentialDateFallback = options?.sequentialDateFallback ?? false;
  const detachOther = options?.detachDocumentsLinkedToOtherCustomers ?? false;
  const bypassNR = options?.bypassHoldedNonRepairFilters ?? false;
  const result: LinkHoldedForCustomerResult = {
    customerId,
    holdedContactId: "",
    invoicesLinked: [],
    quotesLinked: [],
    invoicesSkipped: [],
    quotesSkipped: [],
    errors: [],
    invoicesLinkedBySequentialFallback: 0,
    quotesLinkedBySequentialFallback: 0,
    invoicesDetachedFromOtherRepairs: [],
    quotesDetachedFromOtherRepairs: [],
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
  const rawQuotesOnContact = await listQuotesByContact(customer.holdedContactId);

  // Documents on this contact in Holded may still be linked to another customer’s repairs in our DB — clear so we can attach here.
  if (detachOther && !dryRun) {
    for (const summary of onContact) {
      if (!linkedInvoiceIds.has(summary.id)) continue;
      const [job] = await db
        .select({
          id: repairJobs.id,
          customerId: repairJobs.customerId,
          publicCode: repairJobs.publicCode,
          status: repairJobs.status,
        })
        .from(repairJobs)
        .where(eq(repairJobs.holdedInvoiceId, summary.id))
        .limit(1);
      if (!job || job.customerId === customerId) continue;

      let inv: HoldedInvoice;
      try {
        inv = await getInvoice(summary.id);
      } catch {
        continue;
      }
      if (inv.contact !== customer.holdedContactId) continue;

      await db
        .update(repairJobs)
        .set({
          holdedInvoiceId: null,
          holdedInvoiceNum: null,
          holdedInvoiceDate: null,
          holdedInvoiceSentAt: null,
          invoiceStatus: "not_invoiced",
          ...(job.status === "invoiced" ? { status: "completed" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(repairJobs.id, job.id));

      await db.insert(repairJobEvents).values({
        repairJobId: job.id,
        eventType: "invoice_unlinked",
        fieldChanged: "holdedInvoiceId",
        comment: `Unlinked invoice (was on another customer) so it can link to ${customer.name ?? "customer"} — ${inv.docNumber ?? inv.id}`,
      });

      linkedInvoiceIds.delete(summary.id);
      result.invoicesDetachedFromOtherRepairs.push({
        docNumber: inv.docNumber ?? inv.id,
        previousRepairId: job.id,
      });
    }

    for (const q of rawQuotesOnContact) {
      if (!linkedQuoteIds.has(q.id)) continue;
      const [job] = await db
        .select({
          id: repairJobs.id,
          customerId: repairJobs.customerId,
          publicCode: repairJobs.publicCode,
        })
        .from(repairJobs)
        .where(eq(repairJobs.holdedQuoteId, q.id))
        .limit(1);
      if (!job || job.customerId === customerId) continue;

      let full;
      try {
        full = await getQuote(q.id);
      } catch {
        continue;
      }
      if (full.contact !== customer.holdedContactId) continue;

      await db
        .update(repairJobs)
        .set({
          holdedQuoteId: null,
          holdedQuoteNum: null,
          holdedQuoteDate: null,
          holdedQuoteSentAt: null,
          updatedAt: new Date(),
        })
        .where(eq(repairJobs.id, job.id));

      await db.insert(repairJobEvents).values({
        repairJobId: job.id,
        eventType: "quote_unlinked",
        fieldChanged: "holdedQuoteId",
        comment: `Unlinked quote (was on another customer) so it can link to ${customer.name ?? "customer"} — ${full.docNumber ?? full.id}`,
      });

      linkedQuoteIds.delete(q.id);
      result.quotesDetachedFromOtherRepairs.push({
        docNumber: full.docNumber ?? full.id,
        previousRepairId: job.id,
      });
    }
  }

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
      if (!bypassNR && isNonRepairInvoice(inv)) {
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

  // ─── Optional: pair remaining invoices to repairs by date order (same count) ───
  if (sequentialDateFallback) {
    const unlinkedSequential = customerRepairs.filter(
      (r) => !r.holdedInvoiceId && !manualInvoiceStatuses.includes(r.invoiceStatus),
    );
    const orphanInvoices: HoldedInvoice[] = [];
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

        if (inv.total === 0 && !inv.desc) continue;
        if (!bypassNR && isNonRepairInvoice(inv)) continue;
        orphanInvoices.push(inv);
      } catch (e) {
        result.errors.push(`invoice ${summary.id} (sequential): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (orphanInvoices.length > 0 && unlinkedSequential.length > 0) {
      orphanInvoices.sort((a, b) => a.date - b.date);
      unlinkedSequential.sort(
        (a, b) =>
          (a.completedAt ?? a.createdAt).getTime() - (b.completedAt ?? b.createdAt).getTime(),
      );

      const pairCount = Math.min(orphanInvoices.length, unlinkedSequential.length);
      if (orphanInvoices.length > unlinkedSequential.length) {
        for (let k = pairCount; k < orphanInvoices.length; k++) {
          const inv = orphanInvoices[k]!;
          result.invoicesSkipped.push(`${inv.docNumber ?? inv.id} (more invoices than open work orders — link manually)`);
        }
      }

      for (let i = 0; i < pairCount; i++) {
        const inv = orphanInvoices[i]!;
        const matched = unlinkedSequential[i]!;
        const newStatus = holdedInvoicePanelStatus(inv);
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
            comment: `Invoice linked (sequential date fallback) — ${inv.docNumber ?? inv.id}`,
          });
          matched.holdedInvoiceId = inv.id;
          linkedInvoiceIds.add(inv.id);
        }

        result.invoicesLinked.push({
          invoiceId: inv.id,
          docNumber: inv.docNumber ?? inv.id,
          repairId: matched.id,
        });
        result.invoicesLinkedBySequentialFallback++;
      }
    }
  }

  // ─── Quotes on this Holded contact ───
  const holdedQuotes = bypassNR ? rawQuotesOnContact : filterRepairQuotes(rawQuotesOnContact);

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

  if (sequentialDateFallback) {
    const unlinkedQuoteRepairs = customerRepairs.filter((r) => !r.holdedQuoteId);
    const orphanQuotes = holdedQuotes.filter((q) => !linkedQuoteIds.has(q.id));
    if (orphanQuotes.length > 0 && unlinkedQuoteRepairs.length > 0) {
      orphanQuotes.sort((a, b) => a.date - b.date);
      unlinkedQuoteRepairs.sort(
        (a, b) =>
          (a.completedAt ?? a.createdAt).getTime() - (b.completedAt ?? b.createdAt).getTime(),
      );
      const nq = Math.min(orphanQuotes.length, unlinkedQuoteRepairs.length);
      if (orphanQuotes.length > unlinkedQuoteRepairs.length) {
        for (let k = nq; k < orphanQuotes.length; k++) {
          const q = orphanQuotes[k]!;
          result.quotesSkipped.push(`${q.docNumber ?? q.id} (more quotes than open work orders — link manually)`);
        }
      }
      for (let i = 0; i < nq; i++) {
        const q = orphanQuotes[i]!;
        const matched = unlinkedQuoteRepairs[i]!;
        const full = await getQuote(q.id);
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
            comment: `Quote linked (sequential date fallback) — ${q.docNumber ?? q.id}`,
          });
          matched.holdedQuoteId = q.id;
          linkedQuoteIds.add(q.id);
        }
        result.quotesLinked.push({
          quoteId: q.id,
          docNumber: q.docNumber ?? q.id,
          repairId: matched.id,
        });
        result.quotesLinkedBySequentialFallback++;
      }
    }
  }

  return result;
}
