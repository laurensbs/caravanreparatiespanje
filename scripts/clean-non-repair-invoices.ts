/**
 * clean-non-repair-invoices.ts
 *
 * Finds and soft-deletes repair jobs that were incorrectly created from
 * non-repair Holded invoices (storage, transport, deposits, etc.).
 *
 * Usage:
 *   npx tsx scripts/clean-non-repair-invoices.ts --dry-run   # preview only
 *   npx tsx scripts/clean-non-repair-invoices.ts              # actually delete
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

// Same keywords as sync-payments and backfill scripts
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
  console.log(`\n🧹 Clean Non-Repair Invoice Records (${mode})\n`);

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

  // 2. Find all repairs with a holdedInvoiceId
  const repairs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      status: repairJobs.status,
      deletedAt: repairJobs.deletedAt,
    })
    .from(repairJobs)
    .where(isNotNull(repairJobs.holdedInvoiceId));

  console.log(`🔍 Checking ${repairs.length} repairs with linked invoices...\n`);

  let found = 0;
  let cleaned = 0;
  let alreadyDeleted = 0;

  for (const repair of repairs) {
    const inv = invoiceMap.get(repair.holdedInvoiceId!);
    if (!inv) continue;

    const shouldClean = isNonRepairInvoice(inv)
      || (isBlankInvoice(inv) && repair.title?.startsWith("Repair (invoice"));
    if (!shouldClean) continue;

    const reason = isBlankInvoice(inv) ? "blank invoice (auto-generated)" : "non-repair invoice";

    found++;
    const invDesc = inv.desc || inv.items?.[0]?.name || "(no description)";

    if (repair.deletedAt) {
      alreadyDeleted++;
      console.log(`   ⏭️  Already deleted: ${repair.publicCode} — "${repair.title}" (${repair.holdedInvoiceNum})`);
      continue;
    }

    console.log(`   ${DRY_RUN ? "📝" : "🗑️ "} ${repair.publicCode} — "${repair.title}" [${reason}]`);
    console.log(`      Invoice: ${repair.holdedInvoiceNum} — "${invDesc}"`);

    if (!DRY_RUN) {
      // Soft-delete the repair
      await db
        .update(repairJobs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(repairJobs.id, repair.id));

      // Log the cleanup
      await db.insert(repairJobEvents).values({
        repairJobId: repair.id,
        eventType: "deleted",
        comment: `Auto-cleaned: ${reason} "${invDesc}" (${repair.holdedInvoiceNum})`,
      });
    }

    cleaned++;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`RESULTS (${mode}):`);
  console.log(`  Repairs checked:     ${repairs.length}`);
  console.log(`  Non-repair found:    ${found}`);
  console.log(`  Already deleted:     ${alreadyDeleted}`);
  console.log(`  ${DRY_RUN ? "Would clean" : "Cleaned"}:      ${cleaned}`);
  console.log();

  process.exit(0);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
