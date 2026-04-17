/**
 * Verify Carlos Jubitana exists in Holded, push panel → Holded, then repoint
 * invoices/quotes so drafts show Carlos (not Naomi) where applicable.
 *
 * 1) Ensures Carlos has holded_contact_id (push if missing).
 * 2) For every repair for Carlos with holded invoice/quote → PUT document contactId = Carlos.
 * 3) Draft invoices still on Naomi’s contact that look like “Fridge rental” → move to Carlos
 *    (only when --fix-naomi-fridge-drafts, default on).
 *
 *   npx tsx scripts/jubitana-holded-verify-and-repoint.ts
 *   npx tsx scripts/jubitana-holded-verify-and-repoint.ts --no-fridge-drafts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers, repairJobs } from "../src/lib/db/schema";
import { eq, and, or, isNotNull, isNull, ilike } from "drizzle-orm";
import {
  getContact,
  listContacts,
  getInvoice,
  getQuote,
  listInvoicesByContact,
  updateInvoiceContact,
  updateEstimateContact,
  type HoldedInvoice,
} from "../src/lib/holded/invoices";
import { isHoldedConfigured } from "../src/lib/holded/client";

const NAOMI_CUSTOMER_ID = "3bae1e0b-9ca8-4264-8c23-84bbb0785532";

function fridgeHaystack(inv: HoldedInvoice): string {
  const parts = [
    inv.desc ?? "",
    inv.contactName ?? "",
    ...(inv.items ?? []).map((i) => `${i.name ?? ""} ${i.desc ?? ""}`),
    ...(inv.products ?? []).map((i) => `${i.name ?? ""} ${i.desc ?? ""}`),
  ];
  return parts.join(" ").toLowerCase();
}

function isDraftInvoice(inv: HoldedInvoice): boolean {
  if (inv.draft !== null && inv.draft !== undefined) {
    return inv.draft === 1;
  }
  // Fallback if API omits draft flag
  return !inv.docNumber || inv.docNumber === "---";
}

async function main() {
  const noFridge = process.argv.includes("--no-fridge-drafts");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!isHoldedConfigured()) {
    console.error("HOLDED_API_KEY missing");
    process.exit(1);
  }

  const carlosList = await db.select().from(customers).where(ilike(customers.name, "%Carlos%Jubitana%"));
  if (carlosList.length !== 1) {
    console.error("Expected exactly one Carlos Jubitana customer, got", carlosList.length);
    process.exit(1);
  }
  let carlos = carlosList[0]!;

  const [naomi] = await db.select().from(customers).where(eq(customers.id, NAOMI_CUSTOMER_ID)).limit(1);
  if (!naomi) {
    console.error("Naomi customer not found");
    process.exit(1);
  }

  const { pushContactToHolded } = await import("../src/lib/holded/sync");
  await pushContactToHolded(carlos.id);
  const [carlosAfter] = await db.select().from(customers).where(eq(customers.id, carlos.id)).limit(1);
  if (!carlosAfter?.holdedContactId) {
    console.error("Carlos has no Holded contact after push — check email/phone on customer row.");
    process.exit(1);
  }
  carlos = carlosAfter;
  const carlosHoldedId = carlos.holdedContactId!;

  try {
    const hc = await getContact(carlosHoldedId);
    console.log("Holded contact OK:", hc.id, hc.name, hc.email ?? "", hc.phone ?? "");
  } catch (e) {
    console.error("Failed to fetch Carlos Holded contact:", e);
    process.exit(1);
  }

  const allContacts = await listContacts();
  const nameHits = allContacts.filter(
    (c) => c.name?.toLowerCase().includes("jubitana") && c.name?.toLowerCase().includes("carlos"),
  );
  console.log("Holded contacts matching Carlos/Jubitana:", nameHits.map((c) => `${c.name} (${c.id})`).join(" | ") || "(none by name filter)");

  const jobs = await db
    .select()
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.customerId, carlos.id),
        isNull(repairJobs.deletedAt),
        or(isNotNull(repairJobs.holdedInvoiceId), isNotNull(repairJobs.holdedQuoteId)),
      ),
    );

  for (const job of jobs) {
    if (job.holdedInvoiceId) {
      const inv = await getInvoice(job.holdedInvoiceId);
      if (inv.contact !== carlosHoldedId) {
        console.log(`Invoice ${job.holdedInvoiceNum ?? job.holdedInvoiceId}: contact ${inv.contact} → ${carlosHoldedId}`);
        await updateInvoiceContact(job.holdedInvoiceId, carlosHoldedId);
        console.log("  updated.");
      } else {
        console.log(`Invoice ${job.holdedInvoiceNum ?? job.holdedInvoiceId}: already Carlos contact`);
      }
    }
    if (job.holdedQuoteId) {
      const q = await getQuote(job.holdedQuoteId);
      if (q.contact !== carlosHoldedId) {
        console.log(`Quote ${job.holdedQuoteNum ?? job.holdedQuoteId}: contact ${q.contact} → ${carlosHoldedId}`);
        await updateEstimateContact(job.holdedQuoteId, carlosHoldedId);
        console.log("  updated.");
      } else {
        console.log(`Quote ${job.holdedQuoteNum ?? job.holdedQuoteId}: already Carlos contact`);
      }
    }
  }

  if (!noFridge && naomi.holdedContactId && carlosHoldedId) {
    const naomiInvoices = await listInvoicesByContact(naomi.holdedContactId);
    for (const invSummary of naomiInvoices) {
      const inv = await getInvoice(invSummary.id);
      if (!isDraftInvoice(inv)) continue;
      const h = fridgeHaystack(inv);
      if (!h.includes("fridge") && !h.includes("frigo") && !h.includes("koel")) continue;
      if (inv.contact === carlosHoldedId) continue;
      console.log(`Draft invoice on Naomi contact (fridge match): ${inv.docNumber ?? inv.id} → Carlos`);
      await updateInvoiceContact(inv.id, carlosHoldedId);
      console.log("  updated.");
    }
  }

  await pushContactToHolded(naomi.id).catch(() => {});
  console.log("Done. Open the draft in Holded — client block should show Carlos.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
