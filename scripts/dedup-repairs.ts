/**
 * Duplicate Repair Detection & Cleanup (v2)
 *
 * Uses Jaccard word-similarity on titles + descriptions to find duplicates
 * that the old exact-title matching missed (English/Spanish translations,
 * status notes appended, etc.)
 *
 * Three matching strategies:
 *   1. Same customer, one has Holded invoice + one doesn't, similar content → clear dup
 *   2. Same customer, similar title words (Jaccard > 0.35) → likely dup
 *   3. Same customer + same unit, any content overlap → possible dup
 *
 * Usage: npx tsx scripts/dedup-repairs.ts [--dry-run]
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { isNull, eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

const dryRun = process.argv.includes("--dry-run");

type Repair = {
  id: string;
  customerId: string | null;
  unitId: string | null;
  title: string | null;
  descriptionRaw: string | null;
  status: string;
  invoiceStatus: string;
  holdedInvoiceId: string | null;
  holdedInvoiceNum: string | null;
  publicCode: string | null;
  locationId: string | null;
  createdAt: Date | null;
  completedAt: Date | null;
};

// ── Helpers ──

/** Extract meaningful words (>2 chars), stripping noise words */
const NOISE = new Set(["the", "and", "for", "from", "with", "that", "this", "not", "but", "has", "was", "are", "por", "para", "del", "los", "las", "que", "con", "una", "hay", "new", "need", "needs", "also", "see", "don"]);

function wordSet(s: string | null | undefined): Set<string> {
  const words = (s ?? "").toLowerCase().replace(/[^a-z0-9áéíóúàèìòùüñ]/g, " ").replace(/\s+/g, " ").trim().split(" ");
  return new Set(words.filter(w => w.length > 2 && !NOISE.has(w)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Combined word set from title + first 120 chars of description */
function contentWords(r: Repair): Set<string> {
  const titleW = wordSet(r.title);
  const descW = wordSet((r.descriptionRaw ?? "").slice(0, 120));
  return new Set([...titleW, ...descW]);
}

/** Score a repair — higher = more complete, should be kept */
function completenessScore(r: Repair): number {
  let score = 0;
  if (r.holdedInvoiceId) score += 100;
  if (r.invoiceStatus === "paid") score += 50;
  if (r.invoiceStatus === "sent") score += 30;
  if (r.invoiceStatus === "warranty") score += 15;
  if (r.unitId) score += 20;
  if (r.publicCode) score += 10;
  if (r.completedAt) score += 5;
  if (r.descriptionRaw) score += (r.descriptionRaw.length > 100 ? 3 : 1);
  // Prefer more advanced status
  const statusOrder: Record<string, number> = {
    invoiced: 8, completed: 7, in_progress: 6, scheduled: 5,
    waiting_parts: 4, waiting_customer: 3, quote_needed: 2, todo: 1, new: 0,
  };
  score += (statusOrder[r.status] ?? 0);
  return score;
}

async function main() {
  console.log(dryRun ? "🔍 DRY RUN — no changes will be made\n" : "🔧 LIVE RUN — duplicates will be soft-deleted\n");

  const allRepairs: Repair[] = await db
    .select({
      id: schema.repairJobs.id,
      customerId: schema.repairJobs.customerId,
      unitId: schema.repairJobs.unitId,
      title: schema.repairJobs.title,
      descriptionRaw: schema.repairJobs.descriptionRaw,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      publicCode: schema.repairJobs.publicCode,
      locationId: schema.repairJobs.locationId,
      createdAt: schema.repairJobs.createdAt,
      completedAt: schema.repairJobs.completedAt,
    })
    .from(schema.repairJobs)
    .where(isNull(schema.repairJobs.deletedAt));

  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));

  const allLocations = await db
    .select({ id: schema.locations.id, name: schema.locations.name })
    .from(schema.locations);
  const locationById = new Map(allLocations.map(l => [l.id, l]));

  // Group by customer
  const byCustomer = new Map<string, Repair[]>();
  for (const r of allRepairs) {
    if (!r.customerId) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  // ── Find duplicates using union-find to handle transitive matches ──
  // Map: repair id → set of repair ids it's grouped with
  const toDelete = new Set<string>();  // ids to soft-delete
  const keepFor = new Map<string, Repair>(); // deleted id → the kept repair
  const deletions: Array<{ keep: Repair; remove: Repair; reason: string; similarity: number }> = [];

  for (const [customerId, repairs] of byCustomer) {
    if (repairs.length < 2) continue;

    // Pre-compute content word sets
    const wordsMap = new Map<string, Set<string>>();
    for (const r of repairs) wordsMap.set(r.id, contentWords(r));

    // Compare all pairs within this customer
    const groups: Repair[][] = [];
    const grouped = new Set<string>();

    for (let i = 0; i < repairs.length; i++) {
      if (grouped.has(repairs[i].id)) continue;

      const group: Repair[] = [repairs[i]];
      grouped.add(repairs[i].id);

      for (let j = i + 1; j < repairs.length; j++) {
        if (grouped.has(repairs[j].id)) continue;

        const a = repairs[i], b = repairs[j];
        const wordsA = wordsMap.get(a.id)!;
        const wordsB = wordsMap.get(b.id)!;
        const sim = jaccard(wordsA, wordsB);

        // Strategy 1: One has invoice, one doesn't — lower threshold
        const oneInvoiced = (!!a.holdedInvoiceId) !== (!!b.holdedInvoiceId);
        if (oneInvoiced && sim > 0.2) {
          group.push(b);
          grouped.add(b.id);
          continue;
        }

        // Strategy 2: High title word similarity
        const titleSim = jaccard(wordSet(a.title), wordSet(b.title));
        if (titleSim > 0.35) {
          group.push(b);
          grouped.add(b.id);
          continue;
        }

        // Strategy 3: Same unit + any content overlap
        if (a.unitId && b.unitId && a.unitId === b.unitId && sim > 0.15) {
          group.push(b);
          grouped.add(b.id);
          continue;
        }
      }

      if (group.length >= 2) groups.push(group);
    }

    // Process each duplicate group
    for (const group of groups) {
      group.sort((a, b) => completenessScore(b) - completenessScore(a));
      const keep = group[0];

      for (let d = 1; d < group.length; d++) {
        const dupe = group[d];
        const sim = jaccard(wordsMap.get(keep.id)!, wordsMap.get(dupe.id)!);
        const reason = `score ${completenessScore(keep)} vs ${completenessScore(dupe)}`;

        // Safety: skip if the "dupe" has an invoice that the "keep" doesn't
        if (dupe.holdedInvoiceId && !keep.holdedInvoiceId) continue;
        // Safety: skip if both have different invoice IDs (genuinely different jobs)
        if (dupe.holdedInvoiceId && keep.holdedInvoiceId && dupe.holdedInvoiceId !== keep.holdedInvoiceId) continue;

        toDelete.add(dupe.id);
        keepFor.set(dupe.id, keep);
        deletions.push({ keep, remove: dupe, reason, similarity: sim });
      }
    }
  }

  console.log(`Found ${deletions.length} duplicates to remove\n`);

  for (const { keep, remove, reason, similarity } of deletions) {
    const custName = keep.customerId ? customerById.get(keep.customerId)?.name ?? "?" : "?";
    const keepLoc = keep.locationId ? locationById.get(keep.locationId)?.name ?? "?" : "—";
    const removeLoc = remove.locationId ? locationById.get(remove.locationId)?.name ?? "?" : "—";

    console.log(`┌─ ${custName} — sim: ${(similarity * 100).toFixed(0)}%`);
    console.log(`│  KEEP:   ${keep.id.slice(0, 8)} | "${(keep.title ?? "").slice(0, 60)}" | ${keep.status} | inv: ${keep.holdedInvoiceNum ?? "—"} | ${keep.invoiceStatus} (${reason})`);
    console.log(`│  DELETE: ${remove.id.slice(0, 8)} | "${(remove.title ?? "").slice(0, 60)}" | ${remove.status} | inv: ${remove.holdedInvoiceNum ?? "—"} | ${remove.invoiceStatus}`);

    if (!dryRun) {
      await db
        .update(schema.repairJobs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.repairJobs.id, remove.id));

      await db.insert(schema.repairJobEvents).values({
        repairJobId: remove.id,
        eventType: "status_changed",
        fieldChanged: "deletedAt",
        oldValue: "",
        newValue: new Date().toISOString(),
        comment: `Duplicate of ${keep.id.slice(0, 8)} — auto-cleaned by dedup script v2`,
      });
      console.log(`│  ✅ Soft-deleted`);
    } else {
      console.log(`│  (dry run — would soft-delete)`);
    }
    console.log("└─");
  }

  if (deletions.length === 0) {
    console.log("✅ No duplicates found!");
  } else {
    console.log(`\n${dryRun ? "Would delete" : "Deleted"} ${deletions.length} duplicate repairs.`);
  }
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
