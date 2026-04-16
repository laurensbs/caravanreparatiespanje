import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const unlinked = await sql`
    SELECT rj.id, c.name
    FROM repair_jobs rj
    LEFT JOIN customers c ON rj.customer_id = c.id
    WHERE rj.deleted_at IS NULL
      AND rj.invoice_status IN ('sent', 'paid')
      AND rj.holded_invoice_id IS NULL
    ORDER BY c.name
  `;
  console.log(`Found ${unlinked.length} unlinked repairs`);

  for (const r of unlinked) {
    await sql`
      INSERT INTO repair_job_events (repair_job_id, event_type, comment)
      VALUES (${r.id}, 'comment', '⚠️ Factuur nog niet aangemaakt in Holded — handmatig aanmaken')
    `;
    console.log(`  Added note: ${r.name}`);
  }
  console.log("Done");
}

main().catch(console.error);
