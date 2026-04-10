import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const client = neon(process.env.DATABASE_URL!);
const db = drizzle({ client, schema });

async function deepAnalyze() {
  // Get all 52 no-customer todos
  const noCustomer = await db.query.repairJobs.findMany({
    where: and(
      eq(schema.repairJobs.status, "todo"),
      isNull(schema.repairJobs.deletedAt),
      isNull(schema.repairJobs.customerId)
    ),
    with: { unit: true, location: true },
    orderBy: [schema.repairJobs.createdAt],
  });

  console.log(`=== ALL ${noCustomer.length} NO-CUSTOMER TODO REPAIRS ===\n`);
  
  const logistics: typeof noCustomer = [];
  const partNumbers: typeof noCustomer = [];
  const realRepairs: typeof noCustomer = [];
  
  for (const j of noCustomer) {
    const txt = ((j.title ?? "") + " " + (j.descriptionRaw ?? "")).toLowerCase();
    const unit = j.unit ? `${j.unit.brand ?? ""} ${j.unit.model ?? ""} ${j.unit.registration ?? ""}`.trim() : "";
    
    // Detect logistics/internal tasks
    const isLogistics = /\b(bring back|llevar|sacar|aparcar|volver|ubicacion|escribir|next to repair|mark repair|fila|next$)\b/i.test(txt);
    
    // Detect tyre part numbers (not actual repair jobs)
    const isPartNumber = /^\d{3}\/\d{2,3}[-R]\d{1,2}[A-Z]?\s/.test(txt.trim()) || 
                          /^[A-Z0-9]{4}-[A-Z0-9]{4}/.test(txt.trim());
    
    if (isLogistics) {
      logistics.push(j);
    } else if (isPartNumber) {
      partNumbers.push(j);
    } else {
      realRepairs.push(j);
    }
    
    const cat = isLogistics ? "📦 LOGISTICS" : isPartNumber ? "🔢 PART-NUM" : "🔧 REPAIR";
    console.log(`  ${cat} | ${j.id.slice(0, 8)} | "${(j.title ?? j.descriptionRaw ?? "").slice(0, 70)}" | Unit: ${unit || "none"} | Loc: ${j.location?.name ?? "none"}`);
  }
  
  console.log(`\n  Logistics/internal tasks: ${logistics.length}`);
  console.log(`  Part number entries: ${partNumbers.length}`);
  console.log(`  Real repairs (needs customer): ${realRepairs.length}`);

  // Also check: are there any completed/invoiced repairs for the same units that are in TODO?
  console.log(`\n=== TODO REPAIRS WHERE UNIT HAS COMPLETED REPAIRS ===\n`);
  
  const todosWithUnits = await db.query.repairJobs.findMany({
    where: and(
      eq(schema.repairJobs.status, "todo"),
      isNull(schema.repairJobs.deletedAt),
      sql`${schema.repairJobs.unitId} IS NOT NULL`
    ),
    columns: { id: true, unitId: true, title: true, descriptionRaw: true },
  });

  // Get completed/invoiced repairs for the same units
  const completedForUnits = await db.execute(sql`
    SELECT unit_id, COUNT(*) as cnt
    FROM repair_jobs
    WHERE status IN ('completed', 'invoiced', 'archived')
    AND deleted_at IS NULL
    AND unit_id IS NOT NULL
    AND unit_id IN (
      SELECT DISTINCT unit_id FROM repair_jobs WHERE status = 'todo' AND deleted_at IS NULL AND unit_id IS NOT NULL
    )
    GROUP BY unit_id
  `);
  
  const completedMap = new Map(completedForUnits.rows.map((r: any) => [r.unit_id, r.cnt]));
  
  let unitsWithBoth = 0;
  for (const [unitId, cnt] of completedMap) {
    if (Number(cnt) > 0) unitsWithBoth++;
  }
  console.log(`  ${unitsWithBoth} units have both TODO and completed repairs\n`);

  // Check for exact same title+unit between todo and completed (possible already-done)
  const possiblyDone = await db.execute(sql`
    SELECT t.id as todo_id, t.title as todo_title, c.id as done_id, c.status as done_status,
           t.description_raw as todo_desc
    FROM repair_jobs t
    JOIN repair_jobs c ON t.unit_id = c.unit_id 
      AND LOWER(COALESCE(t.title, t.description_raw, '')) = LOWER(COALESCE(c.title, c.description_raw, ''))
    WHERE t.status = 'todo' AND t.deleted_at IS NULL
      AND c.status IN ('completed', 'invoiced', 'archived') AND c.deleted_at IS NULL
      AND t.id != c.id
  `);
  
  console.log(`  ${possiblyDone.rows.length} TODO repairs have exact match in completed:\n`);
  for (const r of possiblyDone.rows.slice(0, 30) as any[]) {
    console.log(`    TODO ${(r.todo_id as string).slice(0, 8)} → DONE ${(r.done_id as string).slice(0, 8)} (${r.done_status}) | "${((r.todo_title ?? r.todo_desc) as string)?.slice(0, 60)}"`);
  }
}

deepAnalyze().catch(console.error);
