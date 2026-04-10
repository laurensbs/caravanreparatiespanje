/**
 * final-dedup.ts
 * 
 * Final pass: find remaining English/Spanish duplicate repairs that the previous
 * dedup scripts missed (they can't catch cross-language duplicates by word overlap).
 * 
 * Strategy: Same customer + same/similar unit + both repairs have overlapping 
 * keywords like part numbers, registration refs, or numeric patterns.
 */
import { db } from "../src/lib/db";
import { repairJobs, units, customers } from "../src/lib/db/schema";
import { eq, isNull, and, sql, inArray } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");

// Extract "fingerprint" tokens: part numbers, measurements, specific codes (not bare small numbers)
function extractFingerprint(title: string): Set<string> {
  const tokens = new Set<string>();
  // Extract compound part-number-like sequences and larger numbers
  const matches = title.match(/\d[\w\d\-\/]*\d|\d+x\d+/gi);
  if (matches) {
    for (const m of matches) {
      // Skip bare small numbers (quantities like "1", "2", "x2")
      if (/^\d{1,2}$/.test(m)) continue;
      tokens.add(m.toLowerCase());
    }
  }
  return tokens;
}

function fingerprintOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = [...a].filter(x => b.has(x)).length;
  return inter / Math.min(a.size, b.size);
}

// Normalize registration for comparison
function normReg(r: string | null): string {
  return (r ?? "").replace(/[\s\-\/]/g, "").toLowerCase();
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");

  // ─── Step 1: Merge duplicate units (same registration, same customer) ───
  console.log("\n── Merge Duplicate Units ──");
  const allUnits = await db.select().from(units);
  const unitsByCustomer = new Map<string, typeof allUnits>();
  for (const u of allUnits) {
    if (!u.customerId || !u.registration) continue;
    const key = `${u.customerId}::${normReg(u.registration)}`;
    const list = unitsByCustomer.get(key) ?? [];
    list.push(u);
    unitsByCustomer.set(key, list);
  }

  // Also find units where one registration contains the other (e.g. "1-QBU-259" vs "1-QBU-259 / WN-36-PG")
  const unitsByCust = new Map<string, typeof allUnits>();
  for (const u of allUnits) {
    if (!u.customerId || !u.registration) continue;
    const list = unitsByCust.get(u.customerId) ?? [];
    list.push(u);
    unitsByCust.set(u.customerId, list);
  }
  for (const [custId, group] of unitsByCust) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const aReg = normReg(group[i].registration);
        const bReg = normReg(group[j].registration);
        if (aReg === bReg) continue; // already handled above
        // Check if shorter registration is contained in longer one
        const shorter = aReg.length <= bReg.length ? aReg : bReg;
        const longer = aReg.length <= bReg.length ? bReg : aReg;
        if (shorter.length >= 4 && longer.startsWith(shorter)) {
          // Merge: keep the one with more details
          const key = `${custId}::partial::${shorter}`;
          if (!unitsByCustomer.has(key)) {
            unitsByCustomer.set(key, []);
          }
          const existing = unitsByCustomer.get(key)!;
          if (!existing.find(u => u.id === group[i].id)) existing.push(group[i]);
          if (!existing.find(u => u.id === group[j].id)) existing.push(group[j]);
        }
      }
    }
  }

  let mergedUnits = 0;
  for (const [key, group] of unitsByCustomer) {
    if (group.length < 2) continue;
    // Keep the one with most details (brand + model)
    group.sort((a, b) => {
      const aScore = (a.brand ? 1 : 0) + (a.model ? 1 : 0) + (a.storageLocation ? 1 : 0);
      const bScore = (b.brand ? 1 : 0) + (b.model ? 1 : 0) + (b.storageLocation ? 1 : 0);
      return bScore - aScore;
    });
    const keep = group[0];
    const dupes = group.slice(1);

    for (const dupe of dupes) {
      console.log(`  Unit merge: keep "${keep.brand} ${keep.model} ${keep.registration}" (${keep.id.slice(0,8)}), remove "${dupe.brand} ${dupe.model} ${dupe.registration}" (${dupe.id.slice(0,8)})`);
      if (!DRY_RUN) {
        // Move repairs to the kept unit
        await db.update(repairJobs).set({ unitId: keep.id }).where(eq(repairJobs.unitId, dupe.id));
        await db.delete(units).where(eq(units.id, dupe.id));
      }
      mergedUnits++;
    }
  }
  console.log(`Units merged: ${mergedUnits}`);

  // ─── Step 2: Find remaining duplicate repairs ───
  console.log("\n── Find Duplicate Repairs ──");
  
  // Get all active repairs grouped by customer
  const active = await db.select({
    id: repairJobs.id,
    title: repairJobs.title,
    customerId: repairJobs.customerId,
    unitId: repairJobs.unitId,
    status: repairJobs.status,
    holdedInvoiceId: repairJobs.holdedInvoiceId,
    holdedInvoiceNum: repairJobs.holdedInvoiceNum,
    holdedQuoteId: repairJobs.holdedQuoteId,
    invoiceStatus: repairJobs.invoiceStatus,
  }).from(repairJobs).where(isNull(repairJobs.deletedAt));

  const byCustomer = new Map<string, typeof active>();
  for (const r of active) {
    if (!r.customerId) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  // Also load unit registrations for comparison
  const unitMap = new Map<string, string>();
  for (const u of allUnits) {
    if (u.registration) unitMap.set(u.id, normReg(u.registration));
  }

  let dedupCount = 0;
  const toDelete: string[] = [];

  for (const [custId, repairs] of byCustomer) {
    if (repairs.length < 2) continue;

    for (let i = 0; i < repairs.length; i++) {
      if (toDelete.includes(repairs[i].id)) continue;
      for (let j = i + 1; j < repairs.length; j++) {
        if (toDelete.includes(repairs[j].id)) continue;
        const a = repairs[i];
        const b = repairs[j];
        if (!a.title || !b.title) continue;

        // Check if same/similar unit
        const aReg = a.unitId ? unitMap.get(a.unitId) : null;
        const bReg = b.unitId ? unitMap.get(b.unitId) : null;
        const sameUnit = a.unitId === b.unitId || (aReg && bReg && aReg === bReg);
        if (!sameUnit) continue;

        // Check fingerprint overlap (catches cross-language dupes via shared numbers/part codes)
        const aFP = extractFingerprint(a.title);
        const bFP = extractFingerprint(b.title);
        const fpOverlap = fingerprintOverlap(aFP, bFP);

        // Word overlap for same-language
        const aWords = new Set(a.title.toLowerCase().replace(/[^a-záàéèíìóòúùñç0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2));
        const bWords = new Set(b.title.toLowerCase().replace(/[^a-záàéèíìóòúùñç0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2));
        const wordInter = [...aWords].filter(w => bWords.has(w)).length;
        const wordUnion = new Set([...aWords, ...bWords]).size;
        const wordSim = wordUnion > 0 ? wordInter / wordUnion : 0;

        // Match if: high fingerprint overlap (cross-language) OR high word similarity (same-language)
        // For word similarity, require at least 3 matching words to avoid false positives
        const isMatch = (aFP.size >= 2 && fpOverlap >= 0.5) || (wordSim >= 0.4 && wordInter >= 3);
        if (!isMatch) continue;

        // Decide which to keep: prefer invoiced > completed > has Holded docs
        const score = (r: typeof a) => 
          (r.holdedInvoiceId ? 20 : 0) + (r.holdedQuoteId ? 5 : 0) +
          (r.invoiceStatus === "paid" ? 15 : r.invoiceStatus === "sent" ? 10 : 0) +
          (r.status === "invoiced" ? 8 : r.status === "completed" ? 5 : 0);

        const keep = score(a) >= score(b) ? a : b;
        const remove = score(a) >= score(b) ? b : a;

        console.log(`  Dedup: keep "${keep.title?.slice(0,55)}" (${keep.status}/${keep.invoiceStatus}), remove "${remove.title?.slice(0,55)}" (${remove.status}/${remove.invoiceStatus}) [fp=${fpOverlap.toFixed(2)}, word=${wordSim.toFixed(2)}]`);
        toDelete.push(remove.id);
        dedupCount++;
      }
    }
  }

  if (!DRY_RUN && toDelete.length > 0) {
    await db.update(repairJobs).set({ deletedAt: new Date() }).where(inArray(repairJobs.id, toDelete));
  }

  console.log(`\n── Summary ──`);
  console.log(`Units merged: ${mergedUnits}`);
  console.log(`Repairs deduped: ${dedupCount}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
