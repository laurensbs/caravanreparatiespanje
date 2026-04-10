/**
 * merge-customers.ts
 * 
 * Merges orphan customers (from spreadsheet import, no Holded link) into their
 * matching Holded-linked customers. Also cleans up empty units and duplicate repairs.
 * 
 * Three merge strategies, in order:
 * 1. Unit linkage — orphan's repairs reference units owned by a Holded customer
 * 2. Registration match — orphan owns a unit with registration matching a Holded customer's unit
 * 3. Name match — surname extraction & comparison
 * 
 * After merging: 
 * - Cleans up empty units (no brand, model, or registration)
 * - Removes duplicate repairs (same customer + similar title)
 * 
 * Usage: npx tsx scripts/merge-customers.ts [--dry-run]
 */

import { db } from "../src/lib/db";
import { customers, units, repairJobs } from "../src/lib/db/schema";
import { eq, isNull, isNotNull, and, sql, inArray } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Helpers ───

function extractSurname(name: string): string {
  // Remove common Dutch prefixes
  let clean = name
    .replace(/^(Dhr\/mevr\.|Dhr\.|Mevr\.|De heer|Mevrouw)\s*/i, "")
    .trim();
  // Remove extra spaces
  clean = clean.replace(/\s+/g, " ");
  // Take last word as surname (handles "FirstName LastName" and "First Middle LastName")
  const parts = clean.split(" ");
  // Handle "van", "de", "den", "van der", etc. as part of surname
  const tussenvoegselIdx = parts.findIndex((p, i) =>
    i > 0 && /^(van|de|den|der|het|ten|ter|te|du|le|la|el)$/i.test(p)
  );
  if (tussenvoegselIdx > 0) {
    return parts.slice(tussenvoegselIdx).join(" ").toLowerCase();
  }
  return parts[parts.length - 1].toLowerCase();
}

function normalizeName(name: string): string {
  return name
    .replace(/^(Dhr\/mevr\.|Dhr\.|Mevr\.|De heer|Mevrouw)\s*/i, "")
    .replace(/[,.\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function nameSimilarity(orphanName: string, holdedName: string): number {
  const oNorm = normalizeName(orphanName);
  const hNorm = normalizeName(holdedName);

  // Exact match after normalization
  if (oNorm === hNorm) return 1.0;

  const oWords = new Set(oNorm.split(" ").filter(w => w.length > 1));
  const hWords = new Set(hNorm.split(" ").filter(w => w.length > 1));

  // Check if orphan surname (last significant word) matches holded surname
  const oSurname = extractSurname(orphanName);
  const hSurname = extractSurname(holdedName);

  if (oSurname.length >= 3 && oSurname === hSurname) return 0.8;

  // Word overlap (Jaccard)
  const intersection = [...oWords].filter(w => hWords.has(w));
  const union = new Set([...oWords, ...hWords]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

function wordSet(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-záàéèíìóòúùñç0-9\s]/g, "").split(/\s+/).filter(w => w.length > 1)
  );
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter(w => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

// ─── Merge logic ───

interface MergeAction {
  orphanId: string;
  orphanName: string;
  holdedId: string;
  holdedName: string;
  strategy: string;
  confidence: number;
}

async function mergeCustomer(action: MergeAction) {
  const { orphanId, holdedId, orphanName, holdedName, strategy } = action;

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] Would merge "${orphanName}" → "${holdedName}" (${strategy})`);
    return;
  }

  // Move all repairs from orphan to holded customer
  const movedRepairs = await db
    .update(repairJobs)
    .set({ customerId: holdedId })
    .where(eq(repairJobs.customerId, orphanId))
    .returning({ id: repairJobs.id });

  // Move units that belong to orphan → holded customer
  // But only if the holded customer doesn't already have a unit with the same registration
  const orphanUnits = await db.select().from(units).where(eq(units.customerId, orphanId));
  const holdedUnits = await db.select().from(units).where(eq(units.customerId, holdedId));
  const holdedRegs = new Set(holdedUnits.map(u => u.registration?.toLowerCase()).filter(Boolean));

  let movedUnits = 0;
  let deletedUnits = 0;
  for (const u of orphanUnits) {
    const isEmpty = !u.brand && !u.model && !u.registration;
    const isDuplicate = u.registration && holdedRegs.has(u.registration.toLowerCase());

    if (isEmpty) {
      // Re-assign any repairs still pointing to this empty unit to the holded customer's first unit
      if (holdedUnits.length > 0) {
        await db.update(repairJobs).set({ unitId: holdedUnits[0].id }).where(eq(repairJobs.unitId, u.id));
      }
      await db.delete(units).where(eq(units.id, u.id));
      deletedUnits++;
    } else if (isDuplicate) {
      // Re-assign repairs to the matching holded unit
      const matchUnit = holdedUnits.find(hu => hu.registration?.toLowerCase() === u.registration?.toLowerCase());
      if (matchUnit) {
        await db.update(repairJobs).set({ unitId: matchUnit.id }).where(eq(repairJobs.unitId, u.id));
      }
      await db.delete(units).where(eq(units.id, u.id));
      deletedUnits++;
    } else {
      // Move the unit to the holded customer
      await db.update(units).set({ customerId: holdedId }).where(eq(units.id, u.id));
      movedUnits++;
    }
  }

  // Delete the orphan customer
  await db.delete(customers).where(eq(customers.id, orphanId));

  console.log(`  Merged "${orphanName}" → "${holdedName}" (${strategy}): ${movedRepairs.length} repairs, ${movedUnits} units moved, ${deletedUnits} units cleaned`);
}

// ─── Main ───

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE RUN ===");
  console.log("");

  // Load all customers
  const allCustomers = await db.select().from(customers);
  const orphans = allCustomers.filter(c => !c.holdedContactId);
  const holdedMap = new Map(allCustomers.filter(c => c.holdedContactId).map(c => [c.id, c]));
  const holdedList = [...holdedMap.values()];

  console.log(`Orphans: ${orphans.length}, Holded: ${holdedList.length}`);

  // ─── Strategy 1: Unit linkage ───
  console.log("\n── Strategy 1: Unit Linkage ──");
  const crossLinked = await db.execute(sql`
    SELECT DISTINCT
      c_orphan.id as orphan_id,
      c_orphan.name as orphan_name,
      c_holded.id as holded_id,
      c_holded.name as holded_name
    FROM repair_jobs rj
    JOIN customers c_orphan ON rj.customer_id = c_orphan.id
    JOIN units u ON rj.unit_id = u.id
    JOIN customers c_holded ON u.customer_id = c_holded.id
    WHERE c_orphan.holded_contact_id IS NULL
      AND c_holded.holded_contact_id IS NOT NULL
      AND c_orphan.id != c_holded.id
  `);

  const mergedIds = new Set<string>();
  let strategy1 = 0;
  for (const row of crossLinked.rows) {
    const r = row as any;
    await mergeCustomer({
      orphanId: r.orphan_id,
      orphanName: r.orphan_name,
      holdedId: r.holded_id,
      holdedName: r.holded_name,
      strategy: "unit-link",
      confidence: 1.0,
    });
    mergedIds.add(r.orphan_id);
    strategy1++;
  }
  console.log(`Strategy 1 merged: ${strategy1}`);

  // ─── Strategy 2: Registration match ───
  console.log("\n── Strategy 2: Registration Match ──");
  // Reload orphans (some were merged in strategy 1)
  const remainingOrphans = await db.select().from(customers).where(
    and(isNull(customers.holdedContactId))
  );
  const remainingOrphanIds = new Set(remainingOrphans.map(c => c.id));

  // Get all units with registrations, grouped by customer
  const allUnits = await db.select().from(units).where(isNotNull(units.registration));
  const holdedUnitsByReg = new Map<string, { customerId: string; customerName: string }>();
  for (const u of allUnits) {
    if (!u.registration || !u.customerId) continue;
    const cust = holdedMap.get(u.customerId);
    if (cust) {
      holdedUnitsByReg.set(u.registration.toLowerCase(), { customerId: cust.id, customerName: cust.name });
    }
  }

  let strategy2 = 0;
  for (const orphan of remainingOrphans) {
    if (mergedIds.has(orphan.id)) continue;
    const orphanUnits = allUnits.filter(u => u.customerId === orphan.id && u.registration);
    for (const ou of orphanUnits) {
      const match = holdedUnitsByReg.get(ou.registration!.toLowerCase());
      if (match && match.customerId !== orphan.id) {
        await mergeCustomer({
          orphanId: orphan.id,
          orphanName: orphan.name,
          holdedId: match.customerId,
          holdedName: match.customerName,
          strategy: "reg-match",
          confidence: 0.9,
        });
        mergedIds.add(orphan.id);
        strategy2++;
        break;
      }
    }
  }
  console.log(`Strategy 2 merged: ${strategy2}`);

  // ─── Strategy 3: Name match ───
  console.log("\n── Strategy 3: Name Match ──");
  const stillOrphans = await db.select().from(customers).where(isNull(customers.holdedContactId));
  const refreshedHolded = await db.select().from(customers).where(isNotNull(customers.holdedContactId));

  let strategy3 = 0;
  for (const orphan of stillOrphans) {
    if (mergedIds.has(orphan.id)) continue;
    
    let bestMatch: { id: string; name: string; score: number } | null = null;
    for (const h of refreshedHolded) {
      const score = nameSimilarity(orphan.name, h.name);
      if (score >= 0.8 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: h.id, name: h.name, score };
      }
    }

    if (bestMatch) {
      // Extra safety: only merge if orphan has repairs or units
      const orphanRepairCount = await db.select({ id: repairJobs.id }).from(repairJobs).where(eq(repairJobs.customerId, orphan.id));
      const orphanUnitCount = await db.select({ id: units.id }).from(units).where(eq(units.customerId, orphan.id));
      
      if (orphanRepairCount.length > 0 || orphanUnitCount.length > 0) {
        await mergeCustomer({
          orphanId: orphan.id,
          orphanName: orphan.name,
          holdedId: bestMatch.id,
          holdedName: bestMatch.name,
          strategy: `name-match(${bestMatch.score.toFixed(2)})`,
          confidence: bestMatch.score,
        });
        mergedIds.add(orphan.id);
        strategy3++;
      }
    }
  }
  console.log(`Strategy 3 merged: ${strategy3}`);

  // ─── Clean up empty units ───
  console.log("\n── Clean Up Empty Units ──");
  const emptyUnits = await db.select({ id: units.id }).from(units)
    .where(and(isNull(units.brand), isNull(units.model), isNull(units.registration)));

  let cleanedUnits = 0;
  for (const u of emptyUnits) {
    // Check if any non-deleted repairs reference this unit
    const refs = await db.select({ id: repairJobs.id }).from(repairJobs)
      .where(and(eq(repairJobs.unitId, u.id), isNull(repairJobs.deletedAt)));
    
    if (refs.length === 0) {
      if (!DRY_RUN) {
        // Also clear deleted repair references
        await db.update(repairJobs).set({ unitId: null }).where(eq(repairJobs.unitId, u.id));
        await db.delete(units).where(eq(units.id, u.id));
      }
      cleanedUnits++;
    }
  }
  console.log(`${DRY_RUN ? "Would clean" : "Cleaned"} ${cleanedUnits} empty units (of ${emptyUnits.length} total empty)`);

  // ─── Dedup repairs ───
  console.log("\n── Dedup Repairs ──");
  // Group active repairs by customer
  const activeRepairs = await db.select({
    id: repairJobs.id,
    title: repairJobs.title,
    customerId: repairJobs.customerId,
    unitId: repairJobs.unitId,
    status: repairJobs.status,
    holdedInvoiceId: repairJobs.holdedInvoiceId,
    holdedQuoteId: repairJobs.holdedQuoteId,
    createdAt: repairJobs.createdAt,
  }).from(repairJobs).where(isNull(repairJobs.deletedAt));

  const byCustomer = new Map<string, typeof activeRepairs>();
  for (const r of activeRepairs) {
    if (!r.customerId) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  let dedupCount = 0;
  for (const [custId, repairs] of byCustomer) {
    if (repairs.length < 2) continue;

    // Compare each pair
    for (let i = 0; i < repairs.length; i++) {
      for (let j = i + 1; j < repairs.length; j++) {
        const a = repairs[i];
        const b = repairs[j];
        if (!a.title || !b.title) continue;

        const aWords = wordSet(a.title);
        const bWords = wordSet(b.title);
        const sim = jaccardSim(aWords, bWords);
        // Same unit → lower threshold; different/no unit → higher threshold
        const sameUnit = a.unitId && b.unitId && a.unitId === b.unitId;
        // Short titles need higher similarity to avoid false matches
        const shortTitle = aWords.size <= 3 || bWords.size <= 3;
        const threshold = sameUnit
          ? (shortTitle ? 0.5 : 0.25)
          : (shortTitle ? 0.7 : 0.4);
        if (sim < threshold) continue;

        // Determine which to keep: prefer one with Holded docs, then completed/invoiced status
        const aScore = (a.holdedInvoiceId ? 10 : 0) + (a.holdedQuoteId ? 5 : 0) +
          (a.status === "invoiced" ? 4 : a.status === "completed" ? 3 : 0);
        const bScore = (b.holdedInvoiceId ? 10 : 0) + (b.holdedQuoteId ? 5 : 0) +
          (b.status === "invoiced" ? 4 : b.status === "completed" ? 3 : 0);

        const keep = aScore >= bScore ? a : b;
        const remove = aScore >= bScore ? b : a;

        if (!DRY_RUN) {
          await db.update(repairJobs).set({ deletedAt: new Date() }).where(eq(repairJobs.id, remove.id));
        }
        console.log(`  Dedup: keep "${keep.title?.slice(0, 50)}" (${keep.status}), remove "${remove.title?.slice(0, 50)}" (${remove.status}) [sim=${sim.toFixed(2)}]`);
        // Mark as removed so we don't process it again
        repairs[j] = { ...repairs[j], title: null } as any;
        dedupCount++;
      }
    }
  }
  console.log(`${DRY_RUN ? "Would dedup" : "Deduped"} ${dedupCount} repairs`);

  // ─── Summary ───
  console.log("\n── Summary ──");
  console.log(`Customers merged: ${mergedIds.size} (S1:${strategy1} + S2:${strategy2} + S3:${strategy3})`);
  console.log(`Empty units cleaned: ${cleanedUnits}`);
  console.log(`Duplicate repairs removed: ${dedupCount}`);

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
