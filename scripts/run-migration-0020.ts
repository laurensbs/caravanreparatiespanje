/**
 * Run migration 0020: Add OneDrive columns to repair_photos table.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/run-migration-0020.ts
 */

import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log("Running migration 0020: onedrive-photos...");

  await sql`ALTER TABLE "repair_photos" ADD COLUMN IF NOT EXISTS "onedrive_path" text`;
  await sql`ALTER TABLE "repair_photos" ADD COLUMN IF NOT EXISTS "onedrive_folder_url" text`;
  await sql`ALTER TABLE "repair_photos" ADD COLUMN IF NOT EXISTS "onedrive_item_id" text`;

  console.log("Migration 0020 applied successfully!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
