/**
 * Invoice Audit Script
 * 
 * Checks all repairs against Holded invoices:
 * 1. Verifies linked invoices exist and status matches
 * 2. Finds completed repairs that should have an invoice
 * 3. Picks a random linked repair for end-to-end verification
 * 4. Shows summary of issues found
 * 
 * Usage: npx tsx scripts/audit-invoices.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" }); // HOLDED_API_KEY lives in .env.local

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isNull, eq, isNotNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "../src/lib/holded/invoices";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

// —— Helpers ——

const PAYMENT_TOLERANCE_EUR = 0.05;

function holdedInvoiceStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) {
    const remaining = getPartiallyPaidRemaining(inv);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
  }
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

function getPartiallyPaidRemaining(inv: HoldedInvoice): number | null {
  if (typeof inv.due === "number") return Math.abs(inv.due);
  if (inv.payments && inv.payments.length > 0) {
    const totalPaid = inv.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return Math.max(0, inv.total - totalPaid);
  }
  return null;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

// —— Main ——

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║         INVOICE AUDIT REPORT                ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Step 1: Load data
  console.log("⏳ Loading all repairs from DB...");
  const allRepairs = await db
    .select({
      id: schema.repairJobs.id,
      publicCode: schema.repairJobs.publicCode,
      title: schema.repairJobs.title,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      warrantyInternalCostFlag: schema.repairJobs.warrantyInternalCostFlag,
      customerId: schema.repairJobs.customerId,
      createdAt: schema.repairJobs.createdAt,
      completedAt: schema.repairJobs.completedAt,
    })
    .from(schema.repairJobs)
    .where(isNull(schema.repairJobs.deletedAt));

  console.log(`   Found ${allRepairs.length} repairs\n`);

  console.log("⏳ Loading all invoices from Holded...");
  const allInvoices = await listAllInvoices();
  console.log(`   Found ${allInvoices.length} invoices\n`);

  // Build lookups
  const invoiceById = new Map<string, HoldedInvoice>();
  for (const inv of allInvoices) invoiceById.set(inv.id, inv);

  // Load customers for reporting
  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name, holdedContactId: schema.customers.holdedContactId })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));

  // —— Category breakdown ——
  const linked = allRepairs.filter(r => r.holdedInvoiceId);
  const unlinked = allRepairs.filter(r => !r.holdedInvoiceId && r.invoiceStatus !== "warranty");
  const warranty = allRepairs.filter(r => r.invoiceStatus === "warranty" || r.warrantyInternalCostFlag);
  const completedUnlinked = unlinked.filter(r =>
    r.status === "completed" || r.status === "invoiced" || r.status === "archived"
  );

  console.log("┌─────────────────────────────────────────────┐");
  console.log("│ OVERVIEW                                    │");
  console.log("├─────────────────────────────────────────────┤");
  console.log(`│ Total repairs:              ${String(allRepairs.length).padStart(6)}          │`);
  console.log(`│ Linked to invoice:          ${String(linked.length).padStart(6)}          │`);
  console.log(`│ Warranty/internal:          ${String(warranty.length).padStart(6)}          │`);
  console.log(`│ Unlinked (no invoice):      ${String(unlinked.length).padStart(6)}          │`);
  console.log(`│ Completed but no invoice:   ${String(completedUnlinked.length).padStart(6)}          │`);
  console.log(`│ Holded invoices total:      ${String(allInvoices.length).padStart(6)}          │`);
  console.log("└─────────────────────────────────────────────┘\n");

  // —— Step 2: Verify linked invoices ——
  console.log("🔍 VERIFYING LINKED INVOICES...\n");

  const mismatches: Array<{ repair: typeof allRepairs[0]; expected: string; actual: string }> = [];
  const missingInHolded: typeof allRepairs = [];
  const correctLinks: typeof allRepairs = [];

  for (const r of linked) {
    const inv = invoiceById.get(r.holdedInvoiceId!);
    if (!inv) {
      missingInHolded.push(r);
      continue;
    }

    const expectedStatus = holdedInvoiceStatus(inv);
    if (r.invoiceStatus !== expectedStatus && r.invoiceStatus !== "warranty") {
      mismatches.push({ repair: r, expected: expectedStatus, actual: r.invoiceStatus });
    } else {
      correctLinks.push(r);
    }
  }

  console.log(`   ✅ Correct links: ${correctLinks.length}`);
  
  if (mismatches.length > 0) {
    console.log(`   ⚠️  Status mismatches: ${mismatches.length}`);
    for (const m of mismatches) {
      const cust = m.repair.customerId ? customerById.get(m.repair.customerId) : null;
      console.log(`      - ${m.repair.holdedInvoiceNum} | ${cust?.name ?? "?"} | "${m.repair.title}" | DB: ${m.actual} → Holded: ${m.expected}`);
    }
  }

  if (missingInHolded.length > 0) {
    console.log(`   ❌ Invoice not found in Holded: ${missingInHolded.length}`);
    for (const r of missingInHolded) {
      console.log(`      - ${r.holdedInvoiceNum} (${r.holdedInvoiceId}) | "${r.title}"`);
    }
  }

  // —— Step 3: Fix mismatches ——
  if (mismatches.length > 0) {
    console.log(`\n🔧 FIXING ${mismatches.length} STATUS MISMATCHES...\n`);
    let fixed = 0;
    for (const m of mismatches) {
      try {
        await db
          .update(schema.repairJobs)
          .set({ invoiceStatus: m.expected as any, updatedAt: new Date() })
          .where(eq(schema.repairJobs.id, m.repair.id));

        await db.insert(schema.repairJobEvents).values({
          repairJobId: m.repair.id,
          eventType: "payment_synced",
          fieldChanged: "invoiceStatus",
          oldValue: m.actual,
          newValue: m.expected,
          comment: `Audit fix: ${m.actual} → ${m.expected} (invoice ${m.repair.holdedInvoiceNum})`,
        });

        fixed++;
        console.log(`   ✅ Fixed: ${m.repair.holdedInvoiceNum} | ${m.actual} → ${m.expected}`);
      } catch (e: unknown) {
        console.log(`   ❌ Failed: ${m.repair.holdedInvoiceNum} | ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`   Fixed ${fixed}/${mismatches.length} mismatches`);
  }

  // —— Step 4: Completed repairs still not invoiced ——
  if (completedUnlinked.length > 0) {
    console.log(`\n📋 COMPLETED REPAIRS WITHOUT INVOICE (${completedUnlinked.length}):\n`);
    for (const r of completedUnlinked.slice(0, 20)) {
      const cust = r.customerId ? customerById.get(r.customerId) : null;
      console.log(`   - ${r.publicCode ?? "—"} | ${cust?.name ?? "no customer"} | "${r.title}" | status: ${r.status} | completed: ${fmtDate(r.completedAt)}`);
    }
    if (completedUnlinked.length > 20) {
      console.log(`   ... and ${completedUnlinked.length - 20} more`);
    }
  }

  // —— Step 5: Random end-to-end verification ——
  console.log("\n🎲 RANDOM END-TO-END VERIFICATION...\n");

  const verifiableRepairs = linked.filter(r => r.holdedInvoiceId);
  if (verifiableRepairs.length === 0) {
    console.log("   No linked repairs to verify.");
  } else {
    const randomRepair = verifiableRepairs[Math.floor(Math.random() * verifiableRepairs.length)];
    const cust = randomRepair.customerId ? customerById.get(randomRepair.customerId) : null;

    console.log(`   Selected: "${randomRepair.title}"`);
    console.log(`   Customer: ${cust?.name ?? "?"}`);
    console.log(`   Invoice:  ${randomRepair.holdedInvoiceNum} (${randomRepair.holdedInvoiceId})`);
    console.log(`   DB status: ${randomRepair.invoiceStatus}`);

    try {
      // Fetch the specific invoice directly from Holded API (not from the bulk list)
      const liveInvoice = await getInvoice(randomRepair.holdedInvoiceId!);
      const liveStatus = holdedInvoiceStatus(liveInvoice);

      console.log(`\n   Holded API response:`);
      console.log(`     docNumber:   ${liveInvoice.docNumber}`);
      console.log(`     contactName: ${liveInvoice.contactName}`);
      console.log(`     total:       €${liveInvoice.total?.toFixed(2)}`);
      console.log(`     status raw:  ${liveInvoice.status} (0=unpaid, 1=paid, 2=partial)`);
      console.log(`     draft:       ${liveInvoice.draft ?? "null"}`);
      console.log(`     resolved:    ${liveStatus}`);

      if (randomRepair.invoiceStatus === liveStatus) {
        console.log(`\n   ✅ MATCH — DB status "${randomRepair.invoiceStatus}" matches Holded "${liveStatus}"`);
      } else if (randomRepair.invoiceStatus === "warranty") {
        console.log(`\n   ℹ️  WARRANTY — skipped status sync (Holded: ${liveStatus})`);
      } else {
        console.log(`\n   ⚠️  MISMATCH — DB: "${randomRepair.invoiceStatus}" vs Holded: "${liveStatus}"`);
        console.log(`   🔧 Fixing...`);

        await db
          .update(schema.repairJobs)
          .set({ invoiceStatus: liveStatus as any, updatedAt: new Date() })
          .where(eq(schema.repairJobs.id, randomRepair.id));

        await db.insert(schema.repairJobEvents).values({
          repairJobId: randomRepair.id,
          eventType: "payment_synced",
          fieldChanged: "invoiceStatus",
          oldValue: randomRepair.invoiceStatus,
          newValue: liveStatus,
          comment: `Audit E2E fix: ${randomRepair.invoiceStatus} → ${liveStatus}`,
        });

        console.log(`   ✅ Updated: ${randomRepair.invoiceStatus} → ${liveStatus}`);
      }
    } catch (e: unknown) {
      console.log(`   ❌ Holded API error: ${e instanceof Error ? e.message : e}`);
    }
  }

  // —— Invoice status distribution ——
  console.log("\n┌─────────────────────────────────────────────┐");
  console.log("│ INVOICE STATUS DISTRIBUTION                 │");
  console.log("├─────────────────────────────────────────────┤");
  const statusCount = new Map<string, number>();
  for (const r of allRepairs) {
    statusCount.set(r.invoiceStatus, (statusCount.get(r.invoiceStatus) ?? 0) + 1);
  }
  for (const [status, count] of [...statusCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`│ ${status.padEnd(20)} ${String(count).padStart(6)}              │`);
  }
  console.log("└─────────────────────────────────────────────┘");

  console.log("\n✅ Audit complete.");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
