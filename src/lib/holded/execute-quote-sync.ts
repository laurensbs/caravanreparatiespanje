import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllQuotes } from "@/lib/holded/invoices";
import { filterRepairQuotes } from "@/lib/holded/filter";
import { resolveCustomerIdFromHoldedContact } from "@/lib/holded/resolve-customer-from-contact";
import {
  buildHoldedQuoteHaystackLower,
  pickRepairForHoldedDocument,
  type RepairHoldedMatchFields,
} from "@/lib/holded/repair-ref-match";
import { repairJobHasTasks } from "@/lib/repair-has-tasks";

export type HoldedQuoteSyncStats = {
  discovered: number;
  quoteApprovalsSynced: number;
  quoteDeclinesSynced: number;
  repairsAutoCreated: number;
  errors: number;
  quotesTotal: number;
  customersResolved: number;
  holdedContactBackfilled: number;
};

function deriveTitleFromQuote(q: { docNumber?: string | null; desc?: string | null; products?: Array<{ name?: string | null }> | null }): string {
  const firstLine = q.products?.find((p) => p.name && p.name.trim().length > 1)?.name?.trim();
  const descFirstLine = q.desc?.split(/\n/).map((s) => s.trim()).find((s) => s.length > 2);
  const candidate = firstLine || descFirstLine || q.docNumber || "Holded quote";
  return candidate.slice(0, 480);
}

/** Same logic as the cron job: discover quote links, sync approval from Holded. */
export async function executeHoldedQuoteSync(): Promise<HoldedQuoteSyncStats> {
  if (!isHoldedConfigured()) {
    throw new Error("Holded not configured");
  }

  const stats: HoldedQuoteSyncStats = {
    discovered: 0,
    quoteApprovalsSynced: 0,
    quoteDeclinesSynced: 0,
    repairsAutoCreated: 0,
    errors: 0,
    quotesTotal: 0,
    customersResolved: 0,
    holdedContactBackfilled: 0,
  };

  const rawQuotes = await listAllQuotes();
  const quoteById = new Map(rawQuotes.map((q) => [q.id, q] as const));
  const holdedQuotes = filterRepairQuotes(rawQuotes);
  stats.quotesTotal = holdedQuotes.length;

  const allRepairs = await db
    .select({
      id: repairJobs.id,
      customerId: repairJobs.customerId,
      holdedQuoteId: repairJobs.holdedQuoteId,
      publicCode: repairJobs.publicCode,
      spreadsheetInternalId: repairJobs.spreadsheetInternalId,
      title: repairJobs.title,
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

  const repairByQuoteId = new Map<string, (typeof allRepairs)[0]>();
  for (const r of allRepairs) {
    if (r.holdedQuoteId) repairByQuoteId.set(r.holdedQuoteId, r);
  }

  const contactResolveCache = new Map<string, string | false>();

  for (const q of holdedQuotes) {
    try {
      if (repairByQuoteId.has(q.id)) continue;

      let customerId = customerByHoldedId.get(q.contact);
      if (!customerId) {
        const resolved = await resolveCustomerIdFromHoldedContact(q.contact, contactResolveCache);
        if (resolved) {
          customerId = resolved.customerId;
          stats.customersResolved++;
          if (resolved.shouldBackfillHoldedContactId) {
            await db
              .update(customers)
              .set({ holdedContactId: q.contact, updatedAt: new Date() })
              .where(eq(customers.id, resolved.customerId));
            customerByHoldedId.set(q.contact, resolved.customerId);
            stats.holdedContactBackfilled++;
          }
        }
      }
      if (!customerId) continue;

      const customerRepairs = repairsByCustomer.get(customerId);
      if (!customerRepairs) continue;

      const unlinked = customerRepairs.filter((r) => !r.holdedQuoteId);
      if (unlinked.length === 0) continue;

      const qText = buildHoldedQuoteHaystackLower(q);

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

      if (matched) {
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
          comment: `Quote ${q.docNumber ?? q.id} linked from Holded sync`,
        });

        matched.holdedQuoteId = q.id;
        repairByQuoteId.set(q.id, matched);
        stats.discovered++;
        continue;
      }

      // No repair matched. Auto-create a provisional repairJob so a Holded-only
      // quote (someone created it manually in Holded) shows up in the panel.
      const approved = q.status === 1 || (typeof q.approvedAt === "number" && q.approvedAt > 0);
      const declined = q.status === -1;
      // Goedgekeurde quote zonder taken → `todo` (niet `scheduled`): pas
      // na checklist kan de klus op planning/garage.
      const initialStatus = declined
        ? "rejected"
        : approved
          ? "todo"
          : "waiting_approval";
      const initialResponse = declined ? "declined" : approved ? "approved" : "waiting_response";

      const [created] = await db
        .insert(repairJobs)
        .values({
          customerId,
          title: deriveTitleFromQuote(q),
          descriptionRaw: q.desc?.slice(0, 4000) ?? null,
          status: initialStatus,
          customerResponseStatus: initialResponse,
          holdedQuoteId: q.id,
          holdedQuoteNum: q.docNumber,
          holdedQuoteDate: q.date ? new Date(q.date * 1000) : new Date(),
          statusReason: "Auto-created from Holded quote",
          createdAt: q.date ? new Date(q.date * 1000) : new Date(),
        })
        .returning({ id: repairJobs.id });

      if (created) {
        await db.insert(repairJobEvents).values({
          repairJobId: created.id,
          eventType: "quote_discovered",
          fieldChanged: "auto_created",
          oldValue: "",
          newValue: q.docNumber ?? q.id,
          comment: `Auto-created from Holded quote ${q.docNumber ?? q.id}. Review the work order.`,
        });

        const newRecord = {
          id: created.id,
          customerId,
          holdedQuoteId: q.id,
          publicCode: null,
          spreadsheetInternalId: null,
          title: deriveTitleFromQuote(q),
          createdAt: q.date ? new Date(q.date * 1000) : new Date(),
          completedAt: null,
          registration: null,
        };
        const list = repairsByCustomer.get(customerId) ?? [];
        list.push(newRecord);
        repairsByCustomer.set(customerId, list);
        repairByQuoteId.set(q.id, newRecord);
        stats.repairsAutoCreated++;
      }
    } catch {
      stats.errors++;
    }
  }

  const linkedRepairs = await db
    .select({
      id: repairJobs.id,
      holdedQuoteId: repairJobs.holdedQuoteId,
      status: repairJobs.status,
      customerResponseStatus: repairJobs.customerResponseStatus,
    })
    .from(repairJobs)
    .where(and(isNull(repairJobs.deletedAt), isNotNull(repairJobs.holdedQuoteId)));

  for (const repair of linkedRepairs) {
    try {
      const qid = repair.holdedQuoteId;
      if (!qid) continue;
      const q = quoteById.get(qid);
      if (!q) continue;

      const approved = q.status === 1 || (typeof q.approvedAt === "number" && q.approvedAt > 0);
      const declined = q.status === -1;

      // ── Decline path: Holded quote was cancelled / declined.
      if (declined) {
        if (repair.customerResponseStatus === "declined") continue;
        const updates: Record<string, unknown> = {
          customerResponseStatus: "declined",
          updatedAt: new Date(),
        };
        if (repair.status === "waiting_approval") {
          updates.status = "rejected";
        }
        await db.update(repairJobs).set(updates).where(eq(repairJobs.id, repair.id));
        await db.insert(repairJobEvents).values({
          repairJobId: repair.id,
          eventType: "quote_approval_synced",
          fieldChanged: "holded_quote",
          oldValue: `${repair.customerResponseStatus} / ${repair.status}`,
          newValue: `declined / ${updates.status ?? repair.status}`,
          comment: `Holded quote ${q.docNumber ?? q.id} declined / cancelled in Holded`,
        });
        stats.quoteDeclinesSynced++;
        continue;
      }

      // ── Approval path.
      if (!approved) continue;
      if (repair.customerResponseStatus === "declined") continue;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (repair.customerResponseStatus !== "approved") {
        updates.customerResponseStatus = "approved";
      }
      if (repair.status === "waiting_approval") {
        updates.status = (await repairJobHasTasks(repair.id))
          ? "scheduled"
          : "todo";
      }

      if (Object.keys(updates).length <= 1) continue;

      await db.update(repairJobs).set(updates).where(eq(repairJobs.id, repair.id));

      const detail: string[] = [];
      if (updates.customerResponseStatus) detail.push("customer → approved");
      if (updates.status)
        detail.push(`status waiting_approval → ${updates.status}`);

      await db.insert(repairJobEvents).values({
        repairJobId: repair.id,
        eventType: "quote_approval_synced",
        fieldChanged: "holded_quote",
        oldValue: `${repair.customerResponseStatus} / ${repair.status}`,
        newValue: `approved / ${updates.status ?? repair.status}`,
        comment: `Holded quote ${q.docNumber ?? q.id} approved — ${detail.join(", ")}`,
      });

      stats.quoteApprovalsSynced++;
    } catch {
      stats.errors++;
    }
  }

  return stats;
}
