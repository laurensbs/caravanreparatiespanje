import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running migration 0022: admin-garage-messages...");
  await db.execute(sql`ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS garage_admin_message TEXT`);
  await db.execute(sql`ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS garage_admin_message_at TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS garage_admin_message_read_at TIMESTAMPTZ`);
  console.log("Done!");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
