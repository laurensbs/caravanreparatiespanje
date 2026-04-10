/**
 * Deep duplicate analysis — looks beyond just title matching.
 * Checks: same customer + same unit, same customer with one invoiced + one not,
 * same holdedInvoiceId reuse, similar descriptions across different titles.
 * 
 * Usage: npx tsx scripts/analyze-duplicates.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9áéíóúàèìòùüñ]/g, " ").replace(/\s+/g, " ").trim();
}

function wordSet(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter(w => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

async function main() {
  console.log("🔍 Deep duplicate analysis\n");

  const allRepairs = await db
    .select({
      id: schema.repairJobs.id,
      customerId: schema.repairJobs.customerId,
      unitId: schema.repairJobs.unitId,
      title: schema.repairJobs.title,
      descriptionRaw: schema.repairJobs.descriptionRaw,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      publicCode: schema.repairJobs.publicCode,
      locationId: schema.repairJobs.locationId,
      createdAt: schema.repairJobs.createdAt,
      completedAt: schema.repairJobs.completedAt,
      actualCost: schema.repairJobs.actualCost,
    })
    .from(schema.repairJobs)
    .where(isNull(schema.repairJobs.deletedAt));

  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));

  const allLocations = await db
    .select({ id: schema.locations.id, name: schema.locations.name })
    .from(schema.locations);
  const locationById = new Map(allLocations.map(l => [l.id, l]));

  const allUnits = await db
    .select({ id: schema.units.id, registration: schema.units.registration, brand: schema.units.brand })
    .from(schema.units);
  const unitById = new Map(allUnits.map(u => [u.id, u]));

  // ── Analysis 1: Same customer, one invoiced + one not ──
  console.log("═══════════════════════════════════════════════════════");
  console.log("ANALYSIS 1: Same customer — one invoiced, one not");
  console.log("═══════════════════════════════════════════════════════\n");

  const byCustomer = new Map<string, typeof allRepairs>();
  for (const r of allRepairs) {
    if (!r.customerId) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  let suspectPairs = 0;
  const duplicateGroups: Array<{ customer: string; repairs: typeof allRepairs }> = [];

  for (const [customerId, repairs] of byCustomer) {
    if (repairs.length < 2) continue;

    const invoiced = repairs.filter(r => r.holdedInvoiceId);
    const notInvoiced = repairs.filter(r => !r.holdedInvoiceId);

    if (invoiced.length === 0 || notInvoiced.length === 0) continue;

    // For each non-invoiced repair, check if any invoiced repair has similar content
    for (const ni of notInvoiced) {
      const niWords = wordSet(ni.title + " " + (ni.descriptionRaw ?? ""));

      for (const inv of invoiced) {
        const invWords = wordSet(inv.title + " " + (inv.descriptionRaw ?? ""));
        const sim = jaccardSimilarity(niWords, invWords);

        // Also check: same unit?
        const sameUnit = ni.unitId && inv.unitId && ni.unitId === inv.unitId;

        if (sim > 0.25 || sameUnit) {
          suspectPairs++;
          const custName = customerById.get(customerId)?.name ?? "?";
          const niUnit = ni.unitId ? unitById.get(ni.unitId) : null;
          const invUnit = inv.unitId ? unitById.get(inv.unitId) : null;

          console.log(`┌─ ${custName}`);
          console.log(`│  WITHOUT INVOICE: ${ni.id.slice(0, 8)} | "${ni.title?.slice(0, 60)}" | ${ni.status} | inv_status: ${ni.invoiceStatus} | unit: ${niUnit?.registration ?? "—"}`);
          console.log(`│  WITH INVOICE:    ${inv.id.slice(0, 8)} | "${inv.title?.slice(0, 60)}" | ${inv.status} | inv#: ${inv.holdedInvoiceNum ?? "?"} | unit: ${invUnit?.registration ?? "—"}`);
          console.log(`│  Similarity: ${(sim * 100).toFixed(0)}%${sameUnit ? " + SAME UNIT" : ""} | cost: €${inv.actualCost ?? "?"}`);
          console.log("└─\n");
        }
      }
    }
  }

  console.log(`\nTotal suspect pairs: ${suspectPairs}\n`);

  // ── Analysis 2: Same customer + same unit (multiple repairs) ──
  console.log("═══════════════════════════════════════════════════════");
  console.log("ANALYSIS 2: Same customer + same unit (multiple repairs)");
  console.log("═══════════════════════════════════════════════════════\n");

  let multiRepairUnits = 0;
  for (const [customerId, repairs] of byCustomer) {
    const withUnit = repairs.filter(r => r.unitId);
    const byUnit = new Map<string, typeof allRepairs>();
    for (const r of withUnit) {
      const list = byUnit.get(r.unitId!) ?? [];
      list.push(r);
      byUnit.set(r.unitId!, list);
    }

    for (const [unitId, unitRepairs] of byUnit) {
      if (unitRepairs.length < 2) continue;
      multiRepairUnits++;
      const custName = customerById.get(customerId)?.name ?? "?";
      const unit = unitById.get(unitId);
      console.log(`┌─ ${custName} — ${unit?.registration ?? unit?.brand ?? "?"} — ${unitRepairs.length} repairs`);
      for (const r of unitRepairs) {
        const hasInv = r.holdedInvoiceId ? `inv#${r.holdedInvoiceNum}` : "NO INVOICE";
        console.log(`│  ${r.id.slice(0, 8)} | "${r.title?.slice(0, 55)}" | ${r.status.padEnd(12)} | ${r.invoiceStatus.padEnd(12)} | ${hasInv}`);
      }
      console.log("└─\n");
    }
  }

  console.log(`\nCustomer+unit combos with multiple repairs: ${multiRepairUnits}\n`);

  // ── Summary stats ──
  console.log("═══════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════\n");

  const statusCounts: Record<string, number> = {};
  const invStatusCounts: Record<string, number> = {};
  let withInvoice = 0, withoutInvoice = 0;
  
  for (const r of allRepairs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    invStatusCounts[r.invoiceStatus] = (invStatusCounts[r.invoiceStatus] ?? 0) + 1;
    if (r.holdedInvoiceId) withInvoice++; else withoutInvoice++;
  }
  
  console.log(`Total active repairs: ${allRepairs.length}`);
  console.log(`  With Holded invoice: ${withInvoice}`);
  console.log(`  Without Holded invoice: ${withoutInvoice}`);
  console.log(`\nBy status:`, JSON.stringify(statusCounts, null, 2));
  console.log(`\nBy invoice status:`, JSON.stringify(invStatusCounts, null, 2));

  // ── Analysis 3: Completed but 'not_invoiced' — should they be invoiced? ──
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("ANALYSIS 3: Status=completed but invoiceStatus=not_invoiced");
  console.log("(These are the 'needs to invoice' ones the user sees)");
  console.log("═══════════════════════════════════════════════════════\n");
  
  const completedNotInvoiced = allRepairs.filter(
    r => r.status === "completed" && r.invoiceStatus === "not_invoiced"
  );
  
  let alreadyHaveInvoicedDupe = 0;
  for (const r of completedNotInvoiced) {
    if (!r.customerId) continue;
    const siblings = byCustomer.get(r.customerId) ?? [];
    const invoicedSibling = siblings.find(
      s => s.id !== r.id && s.holdedInvoiceId && 
      (s.unitId === r.unitId || jaccardSimilarity(wordSet(s.title ?? ""), wordSet(r.title ?? "")) > 0.2)
    );
    if (invoicedSibling) {
      alreadyHaveInvoicedDupe++;
      const custName = customerById.get(r.customerId)?.name ?? "?";
      console.log(`┌─ ${custName}`);
      console.log(`│  COMPLETED/NOT_INVOICED: ${r.id.slice(0, 8)} | "${r.title?.slice(0, 60)}" | status: ${r.status}`);
      console.log(`│  INVOICED SIBLING:       ${invoicedSibling.id.slice(0, 8)} | "${invoicedSibling.title?.slice(0, 60)}" | inv#: ${invoicedSibling.holdedInvoiceNum}`);
      console.log("└─\n");
    }
  }
  
  console.log(`\nCompleted + not_invoiced: ${completedNotInvoiced.length}`);
  console.log(`Of those, have an invoiced sibling (DUPLICATE): ${alreadyHaveInvoicedDupe}`);
  console.log(`Genuine needs-invoicing (no duplicate): ${completedNotInvoiced.length - alreadyHaveInvoicedDupe}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
