/**
 * Zoek voor klant Carlos Jubitana alle Holded-facturen/offertes op zijn contact en
 * koppel ze aan reparaties (kenteken, werkordercode, titel — zelfde logica als cron).
 *
 * Werkt alleen als documenten in Holded op **hetzelfde** holded_contact_id staan als
 * de klantkaart in het panel. Staat er nog een kopie onder een ander contact:
 * eerst merge (`merge-carlos-jubitana-holded-duplicates.ts`) of volledige sync.
 *
 *   npx tsx scripts/link-carlos-jubitana-holded-to-repairs.ts
 *   npx tsx scripts/link-carlos-jubitana-holded-to-repairs.ts --dry-run
 *   npx tsx scripts/link-carlos-jubitana-holded-to-repairs.ts --no-sequential
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers } from "../src/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import { linkHoldedDocumentsForCustomer } from "../src/lib/holded/link-holded-for-customer";
import { isHoldedConfigured } from "../src/lib/holded/client";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sequentialDateFallback = !process.argv.includes("--no-sequential");

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!isHoldedConfigured()) {
    console.error("HOLDED_API_KEY missing");
    process.exit(1);
  }

  const rows = await db.select().from(customers).where(ilike(customers.name, "%Carlos%Jubitana%"));
  if (rows.length !== 1) {
    console.error("Expected exactly one customer matching %Carlos%Jubitana%, got", rows.length);
    process.exit(1);
  }
  const carlos = rows[0]!;

  console.log("Customer:", carlos.name, carlos.id);
  console.log("Holded contact:", carlos.holdedContactId ?? "(none — run push/merge first)");

  const res = await linkHoldedDocumentsForCustomer(carlos.id, {
    dryRun,
    sequentialDateFallback,
    detachDocumentsLinkedToOtherCustomers: true,
    bypassHoldedNonRepairFilters: true,
  });

  console.log("\n--- Invoices linked ---");
  for (const x of res.invoicesLinked) {
    console.log(`  ${x.docNumber} → repair ${x.repairId}`);
  }
  console.log("--- Quotes linked ---");
  for (const x of res.quotesLinked) {
    console.log(`  ${x.docNumber} → repair ${x.repairId}`);
  }
  if (res.invoicesSkipped.length > 0) {
    console.log("\nInvoices skipped:", res.invoicesSkipped.join("; "));
  }
  if (res.quotesSkipped.length > 0) {
    console.log("Quotes skipped:", res.quotesSkipped.join("; "));
  }
  if (res.errors.length > 0) {
    console.log("Errors:", res.errors.join("; "));
  }
  if (res.invoicesLinkedBySequentialFallback > 0) {
    console.log(`Sequential date fallback links: ${res.invoicesLinkedBySequentialFallback}`);
  }
  console.log(dryRun ? "\n--dry-run: no DB writes for links." : "\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
