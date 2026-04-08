/**
 * Test the Holded sync: pull contacts and products.
 * Usage: npx tsx scripts/test-holded-sync.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { pullContacts, pullProducts, getSyncStatus } from "@/lib/holded/sync";

async function main() {
  console.log("\n=== Pre-sync status ===");
  const before = await getSyncStatus();
  console.log("Contacts:", before.contacts);
  console.log("Suppliers:", before.suppliers);
  console.log("Parts:", before.parts);

  console.log("\n=== Syncing contacts from Holded ===");
  const contactResult = await pullContacts();
  console.log("Holded total:", contactResult.holdedTotal);
  console.log("Matched:", contactResult.matched);
  console.log("Created:", contactResult.created);
  console.log("Skipped:", contactResult.skipped);
  if (contactResult.errors.length > 0) {
    console.log("Errors:", contactResult.errors.slice(0, 5));
  }

  console.log("\n=== Syncing products from Holded ===");
  const productResult = await pullProducts();
  console.log("Holded total:", productResult.holdedTotal);
  console.log("Matched:", productResult.matched);
  console.log("Created:", productResult.created);
  console.log("Skipped:", productResult.skipped);
  if (productResult.errors.length > 0) {
    console.log("Errors:", productResult.errors.slice(0, 5));
  }

  console.log("\n=== Post-sync status ===");
  const after = await getSyncStatus();
  console.log("Contacts:", after.contacts);
  console.log("Suppliers:", after.suppliers);
  console.log("Parts:", after.parts);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
