import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Strip any quotes dotenv may leave around the URL
const dbUrl = (process.env.DATABASE_URL ?? "").replace(/^["']|["']$/g, "");
const sql = neon(dbUrl);
const db = drizzle(sql);

async function main() {
  await db.execute(`ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS custom_flags jsonb DEFAULT '[]'::jsonb`);
  console.log("Migration 0015 done: added custom_flags column");
}

main().catch(console.error);
