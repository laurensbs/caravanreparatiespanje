/**
 * unlink-wrong-invoices.ts
 *
 * Finds real repairs that are incorrectly linked to non-repair invoices
 * (transport, storage, deposits) or blank invoices, and UNLINKS them.
 * Does NOT delete the repair — just removes the wrong invoice link
 * and reverts auto-advanced status.
 *
 * Usage:
 *   npx tsx scripts/unlink-wrong-invoices.ts --dry-run   # preview only
 *   npx tsx scripts/unlink-wrong-invoices.ts              # actually fix
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents } from "@/lib/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { listAllInvoices, type HoldedInvoice } from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";

const DRY_RUN = process.argv.includes("--dry-run");

const NON_REPAIR_KEYWORDS = [
  "stalling", "storage", "reservering", "aanbetaling",
  "transport", "tarieven", "tarief",
  "huur", "verhuur", "rental",
];

const NON_REPAIR_TAG_PREFIXES = ["transport", "stalling"];

function isNonRepairInvoice(inv: HoldedInvoice): boolean {
  const tagMatch = (inv.tags ?? []).some(tag => {
    const t = tag.toLowerCase();
    return NON_REPAIR_TAG_PREFIXES.some(prefix => t.includes(prefix));
  });
  if (tagMatch) return true;

  const textToCheck = [
    inv.desc ?? "",
    ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
  ].join(" ").toLowerCase();

  return NON_REPAIR_KEYWORDS.some(kw => textToCheck.includes(kw));
}

function isBlankInvoice(inv: HoldedInvoice): boolean {
  const hasDesc = inv.desc && inv.desc.trim().length > 3;
  const hasItems = (inv.items ?? []).some(i => i.name && i.name.trim().length > 3);
  return !hasDesc && !hasItems;
}

async function main() {
  const mode = DRY_RUN ? "DRY RUN" : "LIVE";
  console.log(`\n🔗 Unlink Wrong Invoices from Repairs (${mode})\n`);

  if (!isHoldedConfigured()) {
    console.error("❌ HOLDED_API_KEY not configured");
    process.exit(1);
  }

  // 1. Fetch all invoices from Holded
  console.log("📥 Fetching invoices from Holded...");
  const allInvoices = await listAllInvoices();
  const invoiceMap = new Map<string, HoldedInvoice>();
  for (const inv of allInvoices) {
    invoiceMap.set(inv.id, inv);
  }
  console.log(`   ${allInvoices.length} invoices loaded\n`);

  // 2. Find all ACTIVE repairs with a holdedInvoiceId (not deleted, not auto-generated title)
  const repairs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      invoiceStatus: repairJobs.invoiceStatus,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      holdedQuoteId: repairJobs.holdedQuoteId,
      completedAt: repairJobs.completedAt,
    })
    .from(repairJobs)
    .where(isNull(repairJobs.deletedAt));

  const linkedRepairs = repairs.filter(r => r.holdedInvoiceId);
  console.log(`🔍 Checking ${linkedRepairs.length} active repairs with linked invoices...\n`);

  let found = 0;
  let unlinked = 0;
  let statusReverted = 0;

  for (const repair of linkedRepairs) {
    const inv = invoiceMap.get(repair.holdedInvoiceId!);
    if (!inv) continue;

    // Check if this invoice is wrong for this repair
    const isWrong = isNonRepairInvoice(inv) || isBlankInvoice(inv);
    if (!isWrong) continue;

    // Skip auto-generated "Repair (invoice XXXXX)" — those are handled by clean script
    if (repair.title?.startsWith("Repair (invoice")) continue;

    found++;
    const invDesc = inv.desc || inv.items?.[0]?.name || "(no description)";
    const reason = isNonRepairInvoice(inv) ? "non-repair invoice" : "blank invoice";

    // Determine if status needs reverting
    const wasAutoAdvanced = repair.status === "invoiced";
    const newStatus = wasAutoAdvanced ? "completed" : repair.status;

    console.log(`   ${DRY_RUN ? "📝" : "🔧"} ${repair.publicCode} — "${repair.title}"`);
    console.log(`      Wrong invoice: ${repair.holdedInvoiceNum} — "${invDesc}" [${reason}]`);
    console.log(`      Invoice status: ${repair.invoiceStatus} → not_invoiced`);
    if (wasAutoAdvanced) {
      console.log(`      Repair status: invoiced → completed (was auto-advanced)`);
    }
    console.log();

    if (!DRY_RUN) {
      // Unlink the invoice
      await db
        .update(repairJobs)
        .set({
          holdedInvoiceId: null,
          holdedInvoiceNum: null,
          holdedInvoiceDate: null,
          invoiceStatus: "not_invoiced",
          ...(wasAutoAdvanced ? { status: "completed" as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(repairJobs.id, repair.id));

      // Log the fix
      await db.insert(repairJobEvents).values({
        repairJobId: repair.id,
        eventType: "payment_synced",
        fieldChanged: "holdedInvoiceId",
        oldValue: repair.holdedInvoiceNum ?? repair.holdedInvoiceId ?? "",
        newValue: "",
        comment: `Unlinked wrong invoice ${repair.holdedInvoiceNum} (${reason}: "${invDesc}"). Invoice status reset to not_invoiced.${wasAutoAdvanced ? " Repair status reverted from invoiced to completed." : ""}`,
      });

      if (wasAutoAdvanced) {
        await db.insert(repairJobEvents).values({
          repairJobId: repair.id,
          eventType: "status_changed",
          fieldChanged: "status",
          oldValue: "invoiced",
          newValue: "completed",
          comment: `Status reverted — was auto-advanced by wrong invoice ${repair.holdedInvoiceNum}`,
        });
        statusReverted++;
      }
    }

    unlinked++;
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`RESULTS (${mode}):`);
  console.log(`  Active linked repairs: ${linkedRepairs.length}`);
  console.log(`  Wrong links found:     ${found}`);
  console.log(`  ${DRY_RUN ? "Would unlink" : "Unlinked"}:        ${unlinked}`);
  console.log(`  ${DRY_RUN ? "Would revert status" : "Status reverted"}:  ${statusReverted}`);
  console.log();

  process.exit(0);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
