import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // 1. invoice_status=sent/paid maar repair status niet invoiced
  console.log("=== invoice_status=sent/paid maar repair niet op 'invoiced' ===");
  const m1 = await sql`
    SELECT rj.id, rj.status, rj.invoice_status, rj.holded_invoice_num,
           c.name as customer, u.registration, rj.actual_cost
    FROM repair_jobs rj
    LEFT JOIN customers c ON rj.customer_id = c.id
    LEFT JOIN units u ON rj.unit_id = u.id
    WHERE rj.deleted_at IS NULL
      AND rj.invoice_status IN ('sent', 'paid')
      AND rj.status NOT IN ('invoiced', 'archived')
    ORDER BY rj.invoice_status, c.name
  `;
  for (const r of m1) {
    console.log(`${r.customer} | ${r.registration || "-"} | status=${r.status} | inv=${r.invoice_status} | #${r.holded_invoice_num || "-"}`);
  }
  console.log(`Totaal: ${m1.length}\n`);

  // 2. status=invoiced maar invoice_status=not_invoiced (weird)
  console.log("=== status=invoiced maar invoice_status=not_invoiced ===");
  const m2 = await sql`
    SELECT rj.id, c.name as customer, u.registration, rj.holded_invoice_num
    FROM repair_jobs rj
    LEFT JOIN customers c ON rj.customer_id = c.id
    LEFT JOIN units u ON rj.unit_id = u.id
    WHERE rj.deleted_at IS NULL AND rj.status = 'invoiced' AND rj.invoice_status = 'not_invoiced'
    ORDER BY c.name
  `;
  for (const r of m2) {
    console.log(`${r.customer} | ${r.registration || "-"} | #${r.holded_invoice_num || "-"}`);
  }
  console.log(`Totaal: ${m2.length}\n`);

  // 3. todo/waiting >6 maanden oud
  console.log("=== todo/waiting_customer/waiting_approval >6 maanden oud ===");
  const m3 = await sql`
    SELECT rj.id, rj.status, rj.created_at, c.name as customer, u.registration, rj.title
    FROM repair_jobs rj
    LEFT JOIN customers c ON rj.customer_id = c.id
    LEFT JOIN units u ON rj.unit_id = u.id
    WHERE rj.deleted_at IS NULL
      AND rj.status IN ('todo', 'waiting_customer', 'waiting_approval')
      AND rj.created_at < NOW() - INTERVAL '6 months'
    ORDER BY rj.created_at
    LIMIT 40
  `;
  for (const r of m3) {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    console.log(`${d} | ${r.customer} | ${r.registration || "-"} | ${r.status} | ${r.title || "-"}`);
  }
  console.log(`Totaal: ${m3.length}\n`);

  // 4. completed/not_invoiced zonder holded data - potentially done but never invoiced
  console.log("=== completed + not_invoiced (nooit gefactureerd) ===");
  const m4 = await sql`
    SELECT rj.id, rj.status, c.name as customer, u.registration, rj.title, rj.completed_at
    FROM repair_jobs rj
    LEFT JOIN customers c ON rj.customer_id = c.id
    LEFT JOIN units u ON rj.unit_id = u.id
    WHERE rj.deleted_at IS NULL
      AND rj.status = 'completed'
      AND rj.invoice_status = 'not_invoiced'
      AND rj.holded_invoice_id IS NULL
    ORDER BY rj.completed_at DESC
  `;
  for (const r of m4) {
    const d = r.completed_at ? new Date(r.completed_at).toISOString().slice(0, 10) : "?";
    console.log(`${d} | ${r.customer} | ${r.registration || "-"} | ${r.title || "-"}`);
  }
  console.log(`Totaal: ${m4.length}`);
}

main().catch(console.error);
