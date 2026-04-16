/**
 * find-unlinked-invoices.ts
 * Find repairs that are paid/sent but have no holded_invoice_id linked.
 * Then try to match them to Holded invoices.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, and, inArray, isNotNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { listAllInvoices, listInvoicesByContact, type HoldedInvoice } from "../src/lib/holded/invoices";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN\n" : "🔧 LIVE MODE\n");

  // Check Lazaroms specifically
  const lazaroms = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
    })
    .from(schema.repairJobs)
    .where(eq(schema.repairJobs.id, "c0ae9368-f7b2-407a-8685-97e570f21e95"));
  
  console.log("Lazaroms repair:", JSON.stringify(lazaroms[0], null, 2));

  // Get all customers
  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name, holdedContactId: schema.customers.holdedContactId })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));

  // Find all repairs that are paid/sent/invoiced but have no holded_invoice_id
  const unlinked = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
      completedAt: schema.repairJobs.completedAt,
      createdAt: schema.repairJobs.createdAt,
    })
    .from(schema.repairJobs)
    .where(
      and(
        isNull(schema.repairJobs.deletedAt),
        inArray(schema.repairJobs.invoiceStatus, ["sent", "paid"]),
        isNull(schema.repairJobs.holdedInvoiceId),
      )
    );

  console.log(`\n=== ${unlinked.length} repairs met sent/paid maar GEEN Holded link ===\n`);

  // For each, try to find the Holded invoice
  console.log("Fetching all Holded invoices...");
  const allInvoices = await listAllInvoices();
  console.log(`Found ${allInvoices.length} Holded invoices\n`);

  // Already-linked invoice IDs (to avoid double-linking)
  const linkedInvoiceIds = new Set<string>();
  const allRepairs = await db
    .select({ holdedInvoiceId: schema.repairJobs.holdedInvoiceId })
    .from(schema.repairJobs)
    .where(isNotNull(schema.repairJobs.holdedInvoiceId));
  for (const r of allRepairs) {
    if (r.holdedInvoiceId) linkedInvoiceIds.add(r.holdedInvoiceId);
  }

  // Group invoices by contact
  const invoicesByContact = new Map<string, HoldedInvoice[]>();
  for (const inv of allInvoices) {
    if (linkedInvoiceIds.has(inv.id)) continue; // skip already linked
    const list = invoicesByContact.get(inv.contact) || [];
    list.push(inv);
    invoicesByContact.set(inv.contact, list);
  }

  let linked = 0;
  let notFound = 0;

  for (const r of unlinked) {
    const cust = r.customerId ? customerById.get(r.customerId) : null;
    if (!cust?.holdedContactId) {
      console.log(`  ✗ ${cust?.name || "?"} | no Holded contact ID`);
      notFound++;
      continue;
    }

    const candidates = invoicesByContact.get(cust.holdedContactId) || [];
    if (candidates.length === 0) {
      // Try fetching directly for this contact
      console.log(`  ✗ ${cust.name} | no unlinked invoices in Holded for this contact`);
      notFound++;
      continue;
    }

    // Try to find the best match
    const match = findBestInvoice(candidates, r);
    if (match) {
      const invStatus = holdedStatus(match);
      console.log(`  ✓ ${cust.name} → #${match.docNumber} (€${match.total.toFixed(2)}, ${invStatus})`);
      
      if (!DRY_RUN) {
        await db.update(schema.repairJobs).set({
          holdedInvoiceId: match.id,
          holdedInvoiceNum: match.docNumber,
          holdedInvoiceDate: new Date(match.date * 1000),
          invoiceStatus: invStatus,
          updatedAt: new Date(),
        }).where(eq(schema.repairJobs.id, r.id));
      }

      // Remove from candidates to avoid double-matching
      linkedInvoiceIds.add(match.id);
      const idx = candidates.indexOf(match);
      if (idx >= 0) candidates.splice(idx, 1);
      linked++;
    } else {
      console.log(`  ✗ ${cust.name} | ${candidates.length} invoices but no match (title: ${r.title?.slice(0, 40)})`);
      notFound++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Linked: ${linked}`);
  console.log(`Not found: ${notFound}`);
  if (DRY_RUN) console.log("\n⚠ DRY RUN — run without --dry-run to apply.");
}

function holdedStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) return "paid"; // partial within tolerance
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

function findBestInvoice(
  candidates: HoldedInvoice[],
  repair: { publicCode: string | null; title: string | null; completedAt: Date | null; createdAt: Date },
): HoldedInvoice | null {
  // Filter real invoices (not drafts)
  const real = candidates.filter(i => i.docNumber && i.docNumber !== "---");
  if (real.length === 0) return null;

  const invTexts = real.map(inv => ({
    inv,
    text: [
      inv.desc ?? "",
      inv.docNumber ?? "",
      ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
    ].join(" ").toLowerCase(),
  }));

  // Strategy 1: publicCode match
  if (repair.publicCode) {
    const code = repair.publicCode.toLowerCase();
    const match = invTexts.find(t => t.text.includes(code));
    if (match) return match.inv;
  }

  // Strategy 2: title match
  if (repair.title && repair.title.length > 5) {
    const title = repair.title.toLowerCase().slice(0, 50);
    const match = invTexts.find(t => t.text.includes(title));
    if (match) return match.inv;
  }

  // Strategy 3: Date proximity
  const repairDate = (repair.completedAt ?? repair.createdAt).getTime();
  let best: HoldedInvoice | null = null;
  let bestDist = Infinity;
  for (const inv of real) {
    const dist = Math.abs(inv.date * 1000 - repairDate);
    if (dist < bestDist) {
      bestDist = dist;
      best = inv;
    }
  }
  if (best && bestDist < 60 * 24 * 60 * 60 * 1000) return best;

  return null;
}

main().catch(console.error);
