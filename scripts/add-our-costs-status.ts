import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  await sql`ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'our_costs'`;
  console.log("Done: added 'our_costs' to invoice_status enum");
}

run().catch(console.error);
