import { db } from "../src/lib/db";
import { repairJobs } from "../src/lib/db/schema";
import { isNull } from "drizzle-orm";

// Extended translation dictionary EN↔ES
const TRANSLATIONS: Record<string, string[]> = {
  // From previous dedup script + new ones
  "brake cable": ["cable de freno", "cable freno"],
  "cable de freno": ["brake cable"],
  "cable freno": ["brake cable"],
  "grease legs": ["engrasar las patas", "engrasar patas"],
  "engrasar las patas": ["grease legs"],
  "engrasar patas": ["grease legs"],
  "change wheel bearing": ["cambiar rodamiento rueda", "cambiar rodamiento de rueda"],
  "cambiar rodamiento rueda": ["change wheel bearing"],
  "cambiar rodamiento de rueda": ["change wheel bearing"],
  "water damage": ["daños por agua", "daño por agua"],
  "daños por agua": ["water damage"],
  "daño por agua": ["water damage"],
  "replace window": ["cambiar ventana", "reemplazar ventana"],
  "cambiar ventana": ["replace window"],
  "reemplazar ventana": ["replace window"],
  "roof leak": ["fuga techo", "fuga en el techo", "gotera techo"],
  "fuga techo": ["roof leak"],
  "fuga en el techo": ["roof leak"],
  "gotera techo": ["roof leak"],
  "replace lock": ["cambiar cerradura", "reemplazar cerradura"],
  "cambiar cerradura": ["replace lock"],
  "reemplazar cerradura": ["replace lock"],
  "fix door": ["arreglar puerta", "reparar puerta"],
  "arreglar puerta": ["fix door"],
  "reparar puerta": ["fix door"],
  "new tyres": ["neumáticos nuevos", "neumaticos nuevos"],
  "neumáticos nuevos": ["new tyres", "new tires"],
  "neumaticos nuevos": ["new tyres", "new tires"],
  "new tires": ["neumáticos nuevos", "neumaticos nuevos"],
  "replace floor": ["cambiar suelo", "reemplazar suelo"],
  "cambiar suelo": ["replace floor"],
  "reemplazar suelo": ["replace floor"],
  "check brakes": ["revisar frenos", "comprobar frenos"],
  "revisar frenos": ["check brakes"],
  "comprobar frenos": ["check brakes"],
  "replace awning": ["cambiar toldo", "reemplazar toldo"],
  "cambiar toldo": ["replace awning"],
  "reemplazar toldo": ["replace awning"],
  "repair roof": ["reparar techo"],
  "reparar techo": ["repair roof"],
  "damp check": ["revisión humedad", "revision humedad", "comprobar humedad"],
  "revisión humedad": ["damp check"],
  "revision humedad": ["damp check"],
  "comprobar humedad": ["damp check"],
  "replace battery": ["cambiar batería", "cambiar bateria"],
  "cambiar batería": ["replace battery"],
  "cambiar bateria": ["replace battery"],
  "service": ["servicio"],
  "servicio": ["service"],
  "annual check": ["revisión anual", "revision anual", "control anual"],
  "revisión anual": ["annual check"],
  "revision anual": ["annual check"],
  "control anual": ["annual check"],
};

function normalize(s: string): string {
  return s.trim().toLowerCase()
    .replace(/[áà]/g, "a")
    .replace(/[éè]/g, "e")
    .replace(/[íì]/g, "i")
    .replace(/[óò]/g, "o")
    .replace(/[úù]/g, "u")
    .replace(/ñ/g, "n");
}

function areTranslations(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  
  // Check direct translation dictionary
  const transA = TRANSLATIONS[na];
  if (transA && transA.some(t => normalize(t) === nb)) return true;
  const transB = TRANSLATIONS[nb];
  if (transB && transB.some(t => normalize(t) === na)) return true;
  
  // Check if one contains the other (partial match for longer descriptions)
  // Only for short titles (< 50 chars)
  if (na.length < 50 && nb.length < 50) {
    // Check all dictionary entries for substring matches
    for (const [key, vals] of Object.entries(TRANSLATIONS)) {
      const nk = normalize(key);
      if (na.includes(nk) || nb.includes(nk)) {
        for (const v of vals) {
          const nv = normalize(v);
          if ((na.includes(nk) && nb.includes(nv)) || (nb.includes(nk) && na.includes(nv))) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

async function main() {
  const all = await db.select({
    id: repairJobs.id,
    title: repairJobs.title,
    status: repairJobs.status,
    customerId: repairJobs.customerId,
    unitId: repairJobs.unitId,
    invoiceStatus: repairJobs.invoiceStatus,
    holdedInvoiceId: repairJobs.holdedInvoiceId,
    descriptionRaw: repairJobs.descriptionRaw,
  }).from(repairJobs).where(isNull(repairJobs.deletedAt));

  // Group by customer+unit
  const groups = new Map<string, typeof all>();
  for (const r of all) {
    const key = `${r.customerId}|${r.unitId || "null"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const exactDupes: Array<{ keep: typeof all[0]; remove: typeof all[0] }> = [];
  const translationDupes: Array<{ keep: typeof all[0]; remove: typeof all[0] }> = [];

  for (const [, repairs] of groups) {
    if (repairs.length < 2) continue;

    for (let i = 0; i < repairs.length; i++) {
      for (let j = i + 1; j < repairs.length; j++) {
        const a = repairs[i];
        const b = repairs[j];
        const ta = normalize(a.title || "");
        const tb = normalize(b.title || "");

        // Skip if both have holded invoices (both are real invoiced work)
        if (a.holdedInvoiceId && b.holdedInvoiceId) continue;

        const isExact = ta === tb;
        const isTranslation = !isExact && areTranslations(ta, tb);

        if (isExact || isTranslation) {
          // Determine which to keep: prefer invoiced > in_progress > todo, prefer one with description
          let keep = a;
          let remove = b;

          // Keep the one that's further along
          const statusPriority: Record<string, number> = { invoiced: 4, done: 3, in_progress: 2, todo: 1 };
          const pa = statusPriority[a.status] || 0;
          const pb = statusPriority[b.status] || 0;
          if (pb > pa) { keep = b; remove = a; }
          else if (pa === pb) {
            // Prefer the one with a holded invoice
            if (b.holdedInvoiceId && !a.holdedInvoiceId) { keep = b; remove = a; }
            // Prefer the one with a description
            else if ((b.descriptionRaw || "").length > (a.descriptionRaw || "").length) { keep = b; remove = a; }
          }

          if (isExact) {
            exactDupes.push({ keep, remove });
          } else {
            translationDupes.push({ keep, remove });
          }
        }
      }
    }
  }

  console.log(`\n=== EXACT TITLE DUPLICATES (${exactDupes.length}) ===`);
  for (const { keep, remove } of exactDupes) {
    console.log(`  KEEP: "${keep.title}" [${keep.status}/${keep.invoiceStatus}] id=${keep.id}`);
    console.log(`  DEL:  "${remove.title}" [${remove.status}/${remove.invoiceStatus}] id=${remove.id}`);
    console.log();
  }

  console.log(`\n=== TRANSLATION DUPLICATES (${translationDupes.length}) ===`);
  for (const { keep, remove } of translationDupes) {
    console.log(`  KEEP: "${keep.title}" [${keep.status}/${keep.invoiceStatus}] id=${keep.id}`);
    console.log(`  DEL:  "${remove.title}" [${remove.status}/${remove.invoiceStatus}] id=${remove.id}`);
    console.log();
  }

  const totalToDelete = exactDupes.length + translationDupes.length;
  console.log(`\nTotal to soft-delete: ${totalToDelete}`);

  if (process.argv.includes("--live")) {
    const { eq } = await import("drizzle-orm");
    const allToDelete = [...exactDupes, ...translationDupes];
    let deleted = 0;
    for (const { remove } of allToDelete) {
      await db.update(repairJobs)
        .set({ deletedAt: new Date() })
        .where(eq(repairJobs.id, remove.id));
      deleted++;
    }
    console.log(`\nSoft-deleted ${deleted} duplicate repairs.`);
  } else {
    console.log("\nDry run. Pass --live to actually delete.");
  }
}

main();
