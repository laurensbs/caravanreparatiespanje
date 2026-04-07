import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Clean in dependency order
  console.log("Clearing partial seed data...");
  await sql`DELETE FROM repair_job_raw_rows`;
  await sql`DELETE FROM candidate_duplicates`;
  await sql`DELETE FROM repair_job_events`;
  await sql`DELETE FROM repair_job_tags`;
  await sql`DELETE FROM part_requests`;
  await sql`DELETE FROM repair_job_assignments`;
  await sql`DELETE FROM import_rows`;
  await sql`DELETE FROM imports`;
  await sql`DELETE FROM repair_jobs`;
  await sql`DELETE FROM units`;
  await sql`DELETE FROM customers`;
  console.log("Done - customers, units, imports, repair_jobs cleared");
}

main();
