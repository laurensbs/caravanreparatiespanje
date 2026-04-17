/**
 * One-shot: optional import backfill, then Holded payment + quote sync (same as cron).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { runBackfillSpreadsheetIds } from "./backfill-import-refs";
import { executeHoldedPaymentSync } from "../src/lib/holded/execute-payment-sync";
import { executeHoldedQuoteSync } from "../src/lib/holded/execute-quote-sync";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const skipBackfill = process.argv.includes("--skip-backfill");

  const dryRunBackfill = process.argv.includes("--dry-run");

  if (!skipBackfill) {
    console.log("=== Backfill spreadsheet_internal_id from imports ===\n");
    const backfill = await runBackfillSpreadsheetIds({ dryRun: dryRunBackfill });
    console.log(backfill);
    console.log("");
  }

  console.log("=== Holded payment / invoice sync ===\n");
  const pay = await executeHoldedPaymentSync();
  console.log(pay);
  console.log("");

  console.log("=== Holded quote sync ===\n");
  const quotes = await executeHoldedQuoteSync();
  console.log(quotes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
