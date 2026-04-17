/**
 * Find Holded quote(s) / invoice(s) for one repair and link when checks pass
 * (same contact rules + unit resolution as the panel).
 *
 * Usage:
 *   npx tsx scripts/link-holded-single-repair.ts <repairJobId> [--dry-run]
 *
 * repairJobId may be UUID with or without dashes.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, isNotNull, and, ne, or, sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import {
  getInvoice,
  getQuote,
  listAllInvoices,
  listAllQuotes,
  listInvoicesByContact,
  listQuotesByContact,
  type HoldedInvoice,
  type HoldedQuote,
} from "../src/lib/holded/invoices";
import {
  buildHoldedDocumentSearchText,
  resolveUnitForHoldedManualLink,
} from "../src/lib/holded/resolve-unit-from-document";
import {
  compactAlnum,
  matchesSpreadsheetRefInText,
  repairPublicCodeAppearsInText,
} from "../src/lib/holded/repair-ref-match";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql, schema });

const DRY_RUN = process.argv.includes("--dry-run");

const LINK_INVOICE_PAYMENT_TOLERANCE_EUR = 0.05;

function toUuid(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/-/g, "");
  if (s.length === 32 && /^[0-9a-f]+$/.test(s)) {
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
  return raw.trim();
}

function mapLinkedInvoiceStatusFromHolded(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) {
    if (typeof inv.due === "number" && Math.abs(inv.due) <= LINK_INVOICE_PAYMENT_TOLERANCE_EUR) {
      return "paid";
    }
    if (inv.payments && inv.payments.length > 0) {
      const paid = inv.payments.reduce((acc, p) => acc + (p.amount ?? 0), 0);
      const remaining = Math.max(0, inv.total - paid);
      if (remaining <= LINK_INVOICE_PAYMENT_TOLERANCE_EUR) return "paid";
    }
  }
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

function docHaystack(doc: HoldedQuote | HoldedInvoice): string {
  return buildHoldedDocumentSearchText(doc).toLowerCase();
}

function scoreDoc(
  haystack: string,
  job: {
    publicCode: string | null;
    spreadsheetInternalId: string | null;
    title: string | null;
    registration: string | null;
  },
): number {
  let score = 0;
  if (repairPublicCodeAppearsInText(job.publicCode, haystack)) score += 100;
  if (job.spreadsheetInternalId?.trim() && matchesSpreadsheetRefInText(job.spreadsheetInternalId, haystack)) {
    score += 95;
  }
  if (job.registration) {
    const r = job.registration.replace(/\s+/g, "").toLowerCase();
    if (r.length >= 4 && haystack.includes(r)) score += 40;
  }
  if (job.title) {
    for (const w of job.title.toLowerCase().split(/\s+/)) {
      if (w.length > 4 && haystack.includes(w)) score += 5;
    }
  }
  return score;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
  const repairJobId = toUuid(args[0] || "");
  if (!repairJobId || repairJobId.length < 32) {
    console.error("Usage: npx tsx scripts/link-holded-single-repair.ts <repairJobId> [--dry-run]");
    process.exit(1);
  }

  console.log(DRY_RUN ? "DRY RUN\n" : "LIVE\n");
  console.log("Repair job id:", repairJobId, "\n");

  const hexId = args[0].replace(/-/g, "").toLowerCase();
  const [job] = await db
    .select()
    .from(schema.repairJobs)
    .where(
      and(
        isNull(schema.repairJobs.deletedAt),
        or(
          eq(schema.repairJobs.id, repairJobId),
          hexId.length === 32 ? sql`replace(${schema.repairJobs.id}::text, '-', '') = ${hexId}` : sql`1=0`,
        ),
      ),
    )
    .limit(1);

  if (!job) {
    console.error("Repair not found or deleted in this DATABASE_URL.");
    console.error("If this ID is from production, run the script with production env or link in the panel.");
    process.exit(1);
  }

  let customer: (typeof schema.customers.$inferSelect) | null = null;
  if (job.customerId) {
    const [c] = await db.select().from(schema.customers).where(eq(schema.customers.id, job.customerId)).limit(1);
    customer = c ?? null;
  }

  let registration: string | null = null;
  if (job.unitId) {
    const [u] = await db.select().from(schema.units).where(eq(schema.units.id, job.unitId)).limit(1);
    registration = u?.registration ?? null;
  }

  const jobCtx = {
    publicCode: job.publicCode,
    spreadsheetInternalId: job.spreadsheetInternalId,
    title: job.title,
    registration,
  };

  console.log("Job:", {
    publicCode: job.publicCode,
    spreadsheetInternalId: job.spreadsheetInternalId,
    title: job.title?.slice(0, 80),
    holdedQuoteId: job.holdedQuoteId,
    holdedInvoiceId: job.holdedInvoiceId,
    customer: customer?.name,
    holdedContactId: customer?.holdedContactId,
    registration,
  });

  const usedQuoteIds = new Set(
    (
      await db
        .select({ id: schema.repairJobs.holdedQuoteId })
        .from(schema.repairJobs)
        .where(and(isNotNull(schema.repairJobs.holdedQuoteId), ne(schema.repairJobs.id, repairJobId)))
    )
      .map((r) => r.id)
      .filter(Boolean) as string[],
  );
  const usedInvoiceIds = new Set(
    (
      await db
        .select({ id: schema.repairJobs.holdedInvoiceId })
        .from(schema.repairJobs)
        .where(and(isNotNull(schema.repairJobs.holdedInvoiceId), ne(schema.repairJobs.id, repairJobId)))
    )
      .map((r) => r.id)
      .filter(Boolean) as string[],
  );

  let quotes: HoldedQuote[] = [];
  let invoices: HoldedInvoice[] = [];
  /** Stored Holded contact is stale / wrong — documents matched by customer name instead. */
  let allowHoldedContactMismatch = false;

  const nameKey = (customer?.name ?? "").toLowerCase().trim();
  const stripSalutation = (s: string) =>
    s
      .replace(/\b(dhr\/mevr|dhr\.|mevr\.|mr\.|mrs\.|dhr)\b\.?\s*/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

  const matchName = (contactName: string) => {
    const n = stripSalutation(contactName.toLowerCase().trim());
    if (!nameKey || !n) return false;
    if (n.includes(nameKey) || nameKey.includes(n)) return true;
    const nk = stripSalutation(nameKey);
    const tokens = nk
      .split(/[,/&]+/)
      .map((p) => stripSalutation(p))
      .flatMap((p) => p.split(/\s+/))
      .filter((w) => w.length > 2);
    if (tokens.length >= 2) {
      return tokens.every((t) => n.includes(t));
    }
    return n.split(/\s+/).some((p) => p.length > 3 && nk.includes(p));
  };

  async function loadDocumentsByNameScan() {
    console.log("\nScanning ALL quotes/invoices by customer name (slow)…");
    const [allQ, allI] = await Promise.all([listAllQuotes(), listAllInvoices()]);
    const invoiceRowBlob = (i: (typeof allI)[0]) =>
      [
        i.desc ?? "",
        ...(i.items ?? []).map((it) => `${it.name} ${it.desc ?? ""}`),
        ...(i.products ?? []).map((p) => `${p.name} ${p.desc ?? ""}`),
      ]
        .join(" ")
        .slice(0, 4000);
    const quoteRowBlob = (q: (typeof allQ)[0]) =>
      [q.desc ?? "", ...(q.products ?? []).map((p) => `${p.name} ${p.desc ?? ""}`)].join(" ").slice(0, 4000);

    const regCompact =
      registration && registration.trim().length >= 5 ? compactAlnum(registration) : "";

    const matchesRegistrationBlob = (blob: string) => {
      if (!regCompact || regCompact.length < 5) return false;
      return compactAlnum(blob).includes(regCompact);
    };

    quotes = allQ.filter(
      (q) =>
        !usedQuoteIds.has(q.id) &&
        (matchName(q.contactName) ||
          matchName((q.desc ?? "").slice(0, 800)) ||
          matchName(quoteRowBlob(q)) ||
          matchesRegistrationBlob(quoteRowBlob(q))),
    );
    invoices = allI.filter(
      (i) =>
        !usedInvoiceIds.has(i.id) &&
        (matchName(i.contactName) ||
          matchName((i.desc ?? "").slice(0, 800)) ||
          matchName(invoiceRowBlob(i)) ||
          matchesRegistrationBlob(invoiceRowBlob(i))),
    );

    console.log(`Filtered to ${quotes.length} quotes, ${invoices.length} invoices by contact name.`);
    allowHoldedContactMismatch = true;
  }

  if (customer?.holdedContactId) {
    console.log("\nFetching Holded documents for contact", customer.holdedContactId);
    quotes = (await listQuotesByContact(customer.holdedContactId)).filter((q) => !usedQuoteIds.has(q.id));
    invoices = (await listInvoicesByContact(customer.holdedContactId)).filter((i) => !usedInvoiceIds.has(i.id));
    if (quotes.length === 0 && invoices.length === 0) {
      console.warn("Holded returned no documents for stored contact — trying name scan (contact id may be stale).");
      await loadDocumentsByNameScan();
    }
  } else {
    await loadDocumentsByNameScan();
  }

  type Ranked<T extends HoldedQuote | HoldedInvoice> = { doc: T; score: number; hay: string };
  async function rank<T extends HoldedQuote | HoldedInvoice>(
    list: T[],
    fetchFull: (id: string) => Promise<T>,
  ): Promise<Ranked<T>[]> {
    const out: Ranked<T>[] = [];
    for (const summary of list) {
      try {
        const full = await fetchFull(summary.id);
        const hay = docHaystack(full);
        const score = scoreDoc(hay, jobCtx) + (full.docNumber && full.docNumber !== "---" ? 1 : 0);
        out.push({ doc: full, score, hay });
      } catch (e) {
        console.warn("Skip (fetch error)", summary.id, e);
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  const rankedQuotes = await rank(quotes, (id) => getQuote(id) as Promise<HoldedQuote>);
  const rankedInvoices = await rank(invoices, (id) => getInvoice(id) as Promise<HoldedInvoice>);

  console.log("\nTop quote candidates (score):");
  for (const r of rankedQuotes.slice(0, 8)) {
    console.log(`  ${r.score}\t#${r.doc.docNumber}\t${r.doc.id}\tdate ${new Date(r.doc.date * 1000).toISOString().slice(0, 10)}`);
  }
  console.log("\nTop invoice candidates (score):");
  for (const r of rankedInvoices.slice(0, 8)) {
    console.log(`  ${r.score}\t#${r.doc.docNumber}\t${r.doc.id}\t€${r.doc.total}`);
  }

  const customerUnits = job.customerId
    ? await db
        .select({
          id: schema.units.id,
          registration: schema.units.registration,
          internalNumber: schema.units.internalNumber,
        })
        .from(schema.units)
        .where(eq(schema.units.customerId, job.customerId))
    : [];

  async function tryLinkQuote(q: HoldedQuote): Promise<boolean> {
    if (job.holdedQuoteId) return false;
    if (customer?.holdedContactId && q.contact !== customer.holdedContactId && !allowHoldedContactMismatch) {
      return false;
    }
    const docText = buildHoldedDocumentSearchText(q);
    const unitRes = resolveUnitForHoldedManualLink({
      jobUnitId: job.unitId,
      units: customerUnits,
      documentText: docText,
    });
    if (!unitRes.ok) {
      console.warn("  Quote unit check failed:", unitRes.message);
      return false;
    }
    const unitPatch: { unitId?: string } = {};
    if ("updateUnitId" in unitRes) unitPatch.unitId = unitRes.updateUnitId;

    if (!DRY_RUN) {
      if (customer && job.customerId && (!customer.holdedContactId || customer.holdedContactId !== q.contact)) {
        await db
          .update(schema.customers)
          .set({ holdedContactId: q.contact, updatedAt: new Date() })
          .where(eq(schema.customers.id, job.customerId));
      }
      await db
        .update(schema.repairJobs)
        .set({
          holdedQuoteId: q.id,
          holdedQuoteNum: q.docNumber || q.id,
          holdedQuoteDate: q.date ? new Date(q.date * 1000) : new Date(),
          ...unitPatch,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairJobs.id, repairJobId));
      await db.insert(schema.repairJobEvents).values({
        repairJobId,
        userId: null,
        eventType: "holded_quote_linked",
        fieldChanged: "holdedQuoteId",
        oldValue: "",
        newValue: q.docNumber ?? q.id,
        comment: `Script: linked Holded quote ${q.docNumber ?? q.id}`,
      });
    }
    console.log("\n✓ Linked QUOTE", q.docNumber, q.id);
    return true;
  }

  async function tryLinkInvoice(inv: HoldedInvoice): Promise<boolean> {
    if (job.holdedInvoiceId) return false;
    if (customer?.holdedContactId && inv.contact !== customer.holdedContactId && !allowHoldedContactMismatch) {
      return false;
    }
    const docText = buildHoldedDocumentSearchText(inv);
    const unitRes = resolveUnitForHoldedManualLink({
      jobUnitId: job.unitId,
      units: customerUnits,
      documentText: docText,
    });
    if (!unitRes.ok) {
      console.warn("  Invoice unit check failed:", unitRes.message);
      return false;
    }
    const unitPatch: { unitId?: string } = {};
    if ("updateUnitId" in unitRes) unitPatch.unitId = unitRes.updateUnitId;
    const invoiceStatus = mapLinkedInvoiceStatusFromHolded(inv);

    if (!DRY_RUN) {
      if (customer && job.customerId && (!customer.holdedContactId || customer.holdedContactId !== inv.contact)) {
        await db
          .update(schema.customers)
          .set({ holdedContactId: inv.contact, updatedAt: new Date() })
          .where(eq(schema.customers.id, job.customerId));
      }
      await db
        .update(schema.repairJobs)
        .set({
          holdedInvoiceId: inv.id,
          holdedInvoiceNum: inv.docNumber || inv.id,
          holdedInvoiceDate: inv.date ? new Date(inv.date * 1000) : new Date(),
          invoiceStatus,
          ...unitPatch,
          updatedAt: new Date(),
        })
        .where(eq(schema.repairJobs.id, repairJobId));
      await db.insert(schema.repairJobEvents).values({
        repairJobId,
        userId: null,
        eventType: "holded_invoice_linked",
        fieldChanged: "holdedInvoiceId",
        oldValue: "",
        newValue: inv.docNumber ?? inv.id,
        comment: `Script: linked Holded invoice ${inv.docNumber ?? inv.id} (${invoiceStatus})`,
      });
    }
    console.log("\n✓ Linked INVOICE", inv.docNumber, inv.id, invoiceStatus);
    return true;
  }

  const MIN_SCORE = 8;
  let linked = false;

  if (!job.holdedQuoteId && rankedQuotes.length > 0 && rankedQuotes[0].score >= MIN_SCORE) {
    linked = await tryLinkQuote(rankedQuotes[0].doc);
    if (!linked && rankedQuotes.length > 1 && rankedQuotes[1].score >= MIN_SCORE) {
      linked = await tryLinkQuote(rankedQuotes[1].doc);
    }
  } else if (!job.holdedQuoteId && rankedQuotes.length > 0) {
    console.log("\nNo quote linked: best score", rankedQuotes[0]?.score, "<", MIN_SCORE, "(need public code / plate in document?)");
  }

  if (!job.holdedInvoiceId && rankedInvoices.length > 0 && rankedInvoices[0].score >= MIN_SCORE) {
    const ok = await tryLinkInvoice(rankedInvoices[0].doc);
    linked = linked || ok;
    if (!ok && rankedInvoices.length > 1 && rankedInvoices[1].score >= MIN_SCORE) {
      await tryLinkInvoice(rankedInvoices[1].doc);
    }
  } else if (!job.holdedInvoiceId && rankedInvoices.length > 0) {
    console.log("\nNo invoice linked: best score", rankedInvoices[0]?.score, "<", MIN_SCORE);
  }

  if (DRY_RUN) {
    console.log("\n(--dry-run: no DB writes)");
  } else if (!linked && !job.holdedQuoteId && !job.holdedInvoiceId) {
    console.log("\nNo automatic link applied. Pick document ID from list and use panel → Financial → Link.");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
