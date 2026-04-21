/**
 * verify-payments.ts
 *
 * Fetches ALL invoices from Holded and cross-references with our DB.
 * Fixes any mismatches:
 *   - DB says "paid" but Holded says NOT paid → revert to real status
 *   - DB says "sent"/"draft" but Holded says paid → set to "paid"
 *   - DB has holdedInvoiceId that doesn't exist in Holded → flag
 *   - Repair has no invoice but invoiceStatus not "not_invoiced" → fix
 *   - Repair in early status but invoice is sent/paid → advance to "invoiced"
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents } from "@/lib/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "@/lib/holded/invoices";

// Maximum remaining amount (in €) to still consider an invoice as fully paid.
const PAYMENT_TOLERANCE_EUR = 0.05;

function holdedInvoiceStatus(invoice: HoldedInvoice): "draft" | "sent" | "paid" {
  if (invoice.status === 1) return "paid";
  // Partially paid: check if remaining amount is within tolerance
  if (invoice.status === 2) {
    const remaining = getPartiallyPaidRemaining(invoice);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
  }
  if (invoice.draft || !invoice.docNumber || invoice.docNumber === "---") return "draft";
  return "sent";
}

function getPartiallyPaidRemaining(invoice: HoldedInvoice): number | null {
  if (typeof invoice.due === "number") return Math.abs(invoice.due);
  if (invoice.payments && invoice.payments.length > 0) {
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return Math.max(0, invoice.total - totalPaid);
  }
  return null;
}

const earlyStatuses = [
  "new", "todo", "in_inspection", "quote_needed", "waiting_approval",
  "waiting_customer", "waiting_parts", "scheduled", "in_progress", "blocked", "completed",
];

interface Fix {
  repairId: string;
  publicCode: string | null;
  issue: string;
  oldInvoiceStatus: string;
  newInvoiceStatus: string;
  oldStatus?: string;
  newStatus?: string;
}

async function main() {
  console.log("=== Payment Verification Script ===\n");

  // Step 1: Fetch ALL invoices from Holded
  console.log("Fetching all invoices from Holded...");
  const allInvoices = await listAllInvoices();
  console.log(`  Found ${allInvoices.length} invoices in Holded\n`);

  // Fetch details for partially paid invoices to check remaining amounts
  const partiallyPaid = allInvoices.filter(i => i.status === 2 && getPartiallyPaidRemaining(i) === null);
  if (partiallyPaid.length > 0) {
    console.log(`  Fetching details for ${partiallyPaid.length} partially paid invoices...`);
    for (const inv of partiallyPaid) {
      try {
        const detail = await getInvoice(inv.id);
        if (detail.payments) inv.payments = detail.payments;
        if (typeof detail.due === "number") inv.due = detail.due;
      } catch {
        // Skip — will be treated as "sent"
      }
    }
  }

  // Build lookup: holdedInvoiceId → real status from Holded
  const holdedStatusMap = new Map<string, { status: "draft" | "sent" | "paid"; docNumber: string; total: number }>();
  for (const inv of allInvoices) {
    holdedStatusMap.set(inv.id, {
      status: holdedInvoiceStatus(inv),
      docNumber: inv.docNumber,
      total: inv.total,
    });
  }
  const paidInHolded = [...holdedStatusMap.values()].filter(v => v.status === "paid").length;
  const sentInHolded = [...holdedStatusMap.values()].filter(v => v.status === "sent").length;
  const draftInHolded = [...holdedStatusMap.values()].filter(v => v.status === "draft").length;
  console.log(`  Holded breakdown: ${paidInHolded} paid, ${sentInHolded} sent, ${draftInHolded} draft\n`);

  // Step 2: Load ALL repairs from DB
  console.log("Loading repairs from DB...");
  const allRepairs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      status: repairJobs.status,
      invoiceStatus: repairJobs.invoiceStatus,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      holdedQuoteId: repairJobs.holdedQuoteId,
      completedAt: repairJobs.completedAt,
    })
    .from(repairJobs)
    .where(isNull(repairJobs.deletedAt));

  const withInvoice = allRepairs.filter(r => r.holdedInvoiceId);
  const withoutInvoice = allRepairs.filter(r => !r.holdedInvoiceId);
  console.log(`  Total repairs: ${allRepairs.length} (${withInvoice.length} with invoice, ${withoutInvoice.length} without)\n`);

  // Step 3: Cross-reference every repair that has a holdedInvoiceId
  const fixes: Fix[] = [];
  const warnings: string[] = [];

  console.log("--- Cross-referencing repairs with Holded ---\n");

  for (const repair of withInvoice) {
    const holdedData = holdedStatusMap.get(repair.holdedInvoiceId!);

    if (!holdedData) {
      // Invoice ID exists in our DB but not in Holded
      warnings.push(`  ⚠ ${repair.publicCode ?? repair.id}: holdedInvoiceId ${repair.holdedInvoiceId} NOT FOUND in Holded (invoice may have been deleted)`);
      continue;
    }

    const realStatus = holdedData.status;
    const dbStatus = repair.invoiceStatus;

    // Check 1: DB says "paid" but Holded says NOT paid
    if (dbStatus === "paid" && realStatus !== "paid") {
      fixes.push({
        repairId: repair.id,
        publicCode: repair.publicCode,
        issue: `DB says paid but Holded says ${realStatus} (${holdedData.docNumber})`,
        oldInvoiceStatus: dbStatus,
        newInvoiceStatus: realStatus,
      });
    }

    // Check 2: DB says "draft"/"sent"/"not_invoiced" but Holded says paid
    if (dbStatus !== "paid" && dbStatus !== "warranty" && realStatus === "paid") {
      const fix: Fix = {
        repairId: repair.id,
        publicCode: repair.publicCode,
        issue: `DB says ${dbStatus} but Holded says paid (${holdedData.docNumber})`,
        oldInvoiceStatus: dbStatus,
        newInvoiceStatus: "paid",
      };
      // Also advance repair status if still early
      if (earlyStatuses.includes(repair.status)) {
        fix.oldStatus = repair.status;
        fix.newStatus = "invoiced";
      }
      fixes.push(fix);
    }

    // Check 3: DB says "draft" but Holded says "sent"
    if (dbStatus === "draft" && realStatus === "sent") {
      const fix: Fix = {
        repairId: repair.id,
        publicCode: repair.publicCode,
        issue: `DB says draft but Holded says sent (${holdedData.docNumber})`,
        oldInvoiceStatus: dbStatus,
        newInvoiceStatus: "sent",
      };
      // Also advance repair status if still early
      if (earlyStatuses.includes(repair.status)) {
        fix.oldStatus = repair.status;
        fix.newStatus = "invoiced";
      }
      fixes.push(fix);
    }

    // Check 4: DB says "sent" but Holded says "draft" (unlikely but check)
    if (dbStatus === "sent" && realStatus === "draft") {
      fixes.push({
        repairId: repair.id,
        publicCode: repair.publicCode,
        issue: `DB says sent but Holded says draft (${holdedData.docNumber})`,
        oldInvoiceStatus: dbStatus,
        newInvoiceStatus: "draft",
      });
    }

    // Check 5: Repair has invoice (sent/paid) but still in early status
    if ((realStatus === "sent" || realStatus === "paid") && earlyStatuses.includes(repair.status) && dbStatus === realStatus) {
      // invoiceStatus is correct but repair status hasn't advanced
      fixes.push({
        repairId: repair.id,
        publicCode: repair.publicCode,
        issue: `Invoice is ${realStatus} but repair still at ${repair.status}`,
        oldInvoiceStatus: dbStatus,
        newInvoiceStatus: realStatus,
        oldStatus: repair.status,
        newStatus: "invoiced",
      });
    }
  }

  // Step 4: Check repairs WITHOUT an invoice
  for (const repair of withoutInvoice) {
    // If no holdedInvoiceId but invoiceStatus is paid/sent → wrong
    if (repair.invoiceStatus === "paid" || repair.invoiceStatus === "sent") {
      // Belangrijk: als de repair-status ook al op "invoiced" staat (door
      // een eerdere auto-advance op basis van een invoice die er nu niet
      // meer is) moeten we die óók terugdraaien. Anders blijft de repair
      // boekhoudkundig als "gefactureerd" in rapporten staan terwijl er
      // in Holded helemaal niks bestaat — geldverlies door onzichtbaar
      // werk.
      const needsStatusRevert = repair.status === "invoiced";

      // Might have only a quote — that's different
      if (repair.holdedQuoteId) {
        // Has a quote but no invoice — shouldn't be "paid" or "sent"
        fixes.push({
          repairId: repair.id,
          publicCode: repair.publicCode,
          issue: `No invoice linked but invoiceStatus=${repair.invoiceStatus} (has quote only)`,
          oldInvoiceStatus: repair.invoiceStatus,
          newInvoiceStatus: "not_invoiced",
          ...(needsStatusRevert
            ? { oldStatus: repair.status, newStatus: "todo" }
            : {}),
        });
      } else {
        fixes.push({
          repairId: repair.id,
          publicCode: repair.publicCode,
          issue: `No invoice linked, no quote, but invoiceStatus=${repair.invoiceStatus}`,
          oldInvoiceStatus: repair.invoiceStatus,
          newInvoiceStatus: "not_invoiced",
          ...(needsStatusRevert
            ? { oldStatus: repair.status, newStatus: "todo" }
            : {}),
        });
      }
    }
  }

  // Print results
  console.log(`\n=== RESULTS ===\n`);
  console.log(`Warnings: ${warnings.length}`);
  for (const w of warnings) console.log(w);

  console.log(`\nFixes needed: ${fixes.length}`);
  for (const f of fixes) {
    const statusChange = f.oldStatus ? ` + repair ${f.oldStatus} → ${f.newStatus}` : "";
    console.log(`  ${f.publicCode ?? "?"}: ${f.issue} → invoiceStatus: ${f.oldInvoiceStatus} → ${f.newInvoiceStatus}${statusChange}`);
  }

  if (fixes.length === 0) {
    console.log("\n✅ Everything is in sync!\n");
    process.exit(0);
  }

  // Apply fixes
  console.log(`\n--- Applying ${fixes.length} fixes ---\n`);

  for (const f of fixes) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    // Only update invoiceStatus if it actually changed
    if (f.oldInvoiceStatus !== f.newInvoiceStatus) {
      updates.invoiceStatus = f.newInvoiceStatus;
    }

    if (f.newStatus) {
      updates.status = f.newStatus;
      // Alleen completedAt zetten als we écht naar een "klaar"-status
      // promoveren. Bij een revert naar todo/new/in_progress willen we
      // completedAt juist wissen — anders rapporteren we een fantoom-
      // afronding die boekhoudkundig niet klopt.
      const completingStatuses = ["invoiced", "completed"];
      if (completingStatuses.includes(f.newStatus)) {
        updates.completedAt = new Date();
      } else {
        updates.completedAt = null;
      }
    }

    await db
      .update(repairJobs)
      .set(updates)
      .where(eq(repairJobs.id, f.repairId));

    // Log invoice status change
    if (f.oldInvoiceStatus !== f.newInvoiceStatus) {
      await db.insert(repairJobEvents).values({
        repairJobId: f.repairId,
        eventType: "payment_synced",
        fieldChanged: "invoiceStatus",
        oldValue: f.oldInvoiceStatus,
        newValue: f.newInvoiceStatus,
        comment: `Payment verification: Holded says ${f.newInvoiceStatus}, was ${f.oldInvoiceStatus}`,
      });
    }

    // Log repair status change
    if (f.oldStatus && f.newStatus) {
      await db.insert(repairJobEvents).values({
        repairJobId: f.repairId,
        eventType: "status_changed",
        fieldChanged: "status",
        oldValue: f.oldStatus,
        newValue: f.newStatus,
        comment: f.oldStatus === "invoiced" && f.newInvoiceStatus === "not_invoiced"
          ? `Reverted to ${f.newStatus} — no Holded invoice found, prior auto-advance was incorrect`
          : `Auto-advanced to ${f.newStatus} — verified against Holded`,
      });
    }
  }

  console.log(`Done. Applied ${fixes.length} fixes.\n`);
  process.exit(0);
}

main();
