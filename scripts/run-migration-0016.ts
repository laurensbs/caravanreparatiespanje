import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const raw = process.env.DATABASE_URL!;
const connStr = raw.replace(/^["']|["']$/g, "");
const sql = neon(connStr);

async function run() {
  console.log("Creating job_type enum...");
  await sql`CREATE TYPE "public"."job_type" AS ENUM('repair', 'wax', 'maintenance', 'inspection')`;
  console.log("Enum created");

  console.log("Adding job_type column...");
  await sql`ALTER TABLE "repair_jobs" ADD COLUMN "job_type" "job_type" NOT NULL DEFAULT 'repair'`;
  console.log("Column added");

  console.log("Creating index...");
  await sql`CREATE INDEX "repair_jobs_job_type_idx" ON "repair_jobs" USING btree ("job_type")`;
  console.log("Index created");

  console.log("Migration 0016 complete!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
