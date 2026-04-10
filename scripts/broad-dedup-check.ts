import { db } from "../src/lib/db";
import { repairJobs } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

const translations: Record<string, string[]> = {
  "rear lights dont work": ["luces traseras no funcionan"],
  "beading": ["goma total", "goma"],
  "door catch": ["click de puerta"],
  "side lights": ["luces laterales"],
  "front lights": ["luces delanteras"],
  "front light": ["luz delantera"],
  "rooflight": ["claraboya"],
  "mushroom chimney": ["chimenea"],
  "gas chimney": ["chimenea de gas"],
  "jockey wheel": ["rueda de jockey"],
  "bumper": ["parachoques"],
  "pin plug": ["enchufe", "pines"],
  "brake cable": ["cable de freno"],
  "door lock": ["cerradura"],
  "window": ["ventana"],
  "wax": ["cera"],
  "clean": ["limpiar"],
  "new": ["nuevo", "nueva", "nuevas", "nuevos"],
  "handles": ["asa", "asas"],
  "front box": ["caja delantera"],
  "awning": ["toldo"],
  "handbrake": ["freno de mano"],
  "crack": ["agrietad"],
  "wheel arch": ["guardabarros"],
  "guide": ["guia", "guía"],
  "seal": ["sellar"],
  "tyres": ["neumaticos", "neumáticos"],
};

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTranslation(t1: string, t2: string): boolean {
  const n1 = normalize(t1);
  const n2 = normalize(t2);

  // Check shared part numbers (like 40x40, 50x50, 28x28, 185r14c etc)
  const nums1 = new Set(n1.match(/\d+x\d+|\d+r\d+c?|\d{3}[a-z]?\d+/g) || []);
  const nums2 = new Set(n2.match(/\d+x\d+|\d+r\d+c?|\d{3}[a-z]?\d+/g) || []);
  const sharedNums = [...nums1].filter(n => nums2.has(n));
  if (sharedNums.length > 0) return true;

  // Check translation pairs
  for (const [en, es_list] of Object.entries(translations)) {
    const enNorm = en.replace(/[^a-z0-9 ]/g, "");
    const hasEn1 = n1.includes(enNorm);
    const hasEn2 = n2.includes(enNorm);
    for (const es of es_list) {
      const esNorm = es.replace(/[^a-z0-9 ]/g, "");
      const hasEs1 = n1.includes(esNorm);
      const hasEs2 = n2.includes(esNorm);
      if ((hasEn1 && hasEs2) || (hasEs1 && hasEn2)) return true;
    }
  }

  return false;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  const dupes = await db.execute(sql`
    SELECT r1.id as id1, r1.title as t1, r1.status as s1, r1.invoice_status as inv1,
           r2.id as id2, r2.title as t2, r2.status as s2, r2.invoice_status as inv2,
           r1.customer_id as cid
    FROM repair_jobs r1
    JOIN repair_jobs r2 ON r1.customer_id = r2.customer_id 
      AND COALESCE(r1.unit_id, r1.id) = COALESCE(r2.unit_id, r2.id)
      AND r1.id < r2.id
    WHERE r1.deleted_at IS NULL AND r2.deleted_at IS NULL
      AND r1.customer_id IS NOT NULL
  `);

  const toDelete: number[] = [];

  for (const r of dupes.rows as any[]) {
    const oneInvoiced = r.inv1 === "paid" || r.inv1 === "sent" || r.inv2 === "paid" || r.inv2 === "sent";
    const oneTodo = r.s1 === "todo" || r.s1 === "new" || r.s2 === "todo" || r.s2 === "new";
    if (!oneInvoiced || !oneTodo) continue;

    // Skip standard NL service entries that aren't duplicates
    const t1Lower = (r.t1 as string).toLowerCase();
    const t2Lower = (r.t2 as string).toLowerCase();
    const skip = ["jaarlijkse controle", "wax caravan", "reparatie van", "reparatie voortent",
      "stekker", "dakluik", "severall repairs", "repair led caravan", "phone client"];
    if (skip.some(s => t1Lower.includes(s) || t2Lower.includes(s))) continue;

    if (isTranslation(r.t1 as string, r.t2 as string)) {
      const todoId = (r.s1 === "todo" || r.s1 === "new") ? r.id1 : r.id2;
      const keepId = todoId === r.id1 ? r.id2 : r.id1;
      const todoTitle = todoId === r.id1 ? r.t1 : r.t2;
      const keepTitle = keepId === r.id1 ? r.t1 : r.t2;
      toDelete.push(todoId as number);
      console.log(`  DELETE #${todoId} "${(todoTitle as string).slice(0,60)}" -> KEEP #${keepId} "${(keepTitle as string).slice(0,60)}"`);
    }
  }

  console.log(`\nConfirmed cross-language duplicates: ${toDelete.length}`);

  if (toDelete.length > 0 && !dryRun) {
    const now = new Date();
    for (const id of toDelete) {
      await db.execute(sql`UPDATE repair_jobs SET deleted_at = ${now} WHERE id = ${id}`);
    }
    console.log(`Soft-deleted ${toDelete.length} duplicate todo repairs`);
  } else if (dryRun) {
    console.log("DRY RUN - no changes made");
  }

  process.exit(0);
}

main();
