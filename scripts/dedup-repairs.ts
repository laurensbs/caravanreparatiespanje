/**
 * Duplicate Repair Detection & Cleanup
 * 
 * Finds duplicate repairs (same customer + same/similar title) and soft-deletes
 * the less complete one, keeping the one with invoice/unit data.
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

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/** Score a repair — higher = more complete, should be kept */
function completenessScore(r: {
  holdedInvoiceId: string | null;
  invoiceStatus: string;
  unitId: string | null;
  publicCode: string | null;
  completedAt: Date | null;
  descriptionRaw: string | null;
}): number {
  let score = 0;
  if (r.holdedInvoiceId) score += 100;   // Has invoice linked
  if (r.invoiceStatus === "paid") score += 50;
  if (r.invoiceStatus === "sent") score += 30;
  if (r.unitId) score += 20;             // Has unit linked
  if (r.publicCode) score += 10;         // Has public code
  if (r.completedAt) score += 5;         // Has completion date
  if (r.descriptionRaw) score += (r.descriptionRaw.length > 100 ? 3 : 1);
  return score;
}

async function main() {
  console.log(dryRun ? "🔍 DRY RUN — no changes will be made\n" : "🔧 LIVE RUN — duplicates will be soft-deleted\n");

  const allRepairs = await db
    .select({
      id: schema.repairJobs.id,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      descriptionRaw: schema.repairJobs.descriptionRaw,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      unitId: schema.repairJobs.unitId,
      publicCode: schema.repairJobs.publicCode,
      locationId: schema.repairJobs.locationId,
      createdAt: schema.repairJobs.createdAt,
      completedAt: schema.repairJobs.completedAt,
    })
    .from(schema.repairJobs)
    .where(isNull(schema.repairJobs.deletedAt));

  // Load customers and locations for reporting
  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));
  
  const allLocations = await db
    .select({ id: schema.locations.id, name: schema.locations.name })
    .from(schema.locations);
  const locationById = new Map(allLocations.map(l => [l.id, l]));

  // Group by customer
  const byCustomer = new Map<string, typeof allRepairs>();
  for (const r of allRepairs) {
    if (!r.customerId) continue;
    const list = byCustomer.get(r.customerId) ?? [];
    list.push(r);
    byCustomer.set(r.customerId, list);
  }

  // Find duplicates within each customer: same normalized title + similar description
  let totalDuplicateGroups = 0;
  let totalToDelete = 0;
  const deletions: Array<{ keep: typeof allRepairs[0]; remove: typeof allRepairs[0]; reason: string }> = [];

  for (const [customerId, repairs] of byCustomer) {
    if (repairs.length < 2) continue;

    // Group by normalized title
    const byTitle = new Map<string, typeof allRepairs>();
    for (const r of repairs) {
      const key = normalize(r.title);
      if (!key || key.length < 3) continue;
      const list = byTitle.get(key) ?? [];
      list.push(r);
      byTitle.set(key, list);
    }

    for (const [title, group] of byTitle) {
      if (group.length < 2) continue;

      // Further check: do they share similar description text?
      // Use first 100 chars of normalized description as fingerprint
      const subGroups = new Map<string, typeof allRepairs>();
      for (const r of group) {
        const descKey = normalize(r.descriptionRaw).slice(0, 100) || title;
        let matched = false;
        for (const [key, sg] of subGroups) {
          // If descriptions share >60% of their start, group them
          const overlap = commonPrefixLength(key, descKey);
          if (overlap > Math.min(key.length, descKey.length) * 0.6 || overlap > 40) {
            sg.push(r);
            matched = true;
            break;
          }
        }
        if (!matched) {
          subGroups.set(descKey, [r]);
        }
      }

      for (const [, sg] of subGroups) {
        if (sg.length < 2) continue;

        totalDuplicateGroups++;
        // Sort by completeness — highest score = keep
        sg.sort((a, b) => completenessScore(b) - completenessScore(a));
        const keep = sg[0];
        const dupes = sg.slice(1);

        for (const dupe of dupes) {
          totalToDelete++;
          const reason = `score ${completenessScore(keep)} vs ${completenessScore(dupe)}`;
          deletions.push({ keep, remove: dupe, reason });
        }
      }
    }
  }

  console.log(`Found ${totalDuplicateGroups} duplicate groups, ${totalToDelete} repairs to remove\n`);

  for (const { keep, remove, reason } of deletions) {
    const custName = keep.customerId ? customerById.get(keep.customerId)?.name ?? "?" : "?";
    const keepLoc = keep.locationId ? locationById.get(keep.locationId)?.name ?? "?" : "—";
    const removeLoc = remove.locationId ? locationById.get(remove.locationId)?.name ?? "?" : "—";
    
    console.log(`┌─ ${custName} — "${keep.title}"`);
    console.log(`│  KEEP:   ${keep.id.slice(0, 8)} @ ${keepLoc} | invoice: ${keep.holdedInvoiceNum ?? "—"} | ${keep.invoiceStatus} (${reason})`);
    console.log(`│  DELETE: ${remove.id.slice(0, 8)} @ ${removeLoc} | invoice: ${remove.holdedInvoiceNum ?? "—"} | ${remove.invoiceStatus}`);

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
        comment: `Duplicate of ${keep.id.slice(0, 8)} — auto-cleaned by dedup script`,
      });
      console.log(`│  ✅ Soft-deleted`);
    } else {
      console.log(`│  (dry run — would soft-delete)`);
    }
    console.log("└─");
  }

  if (totalToDelete === 0) {
    console.log("✅ No duplicates found!");
  } else {
    console.log(`\n${dryRun ? "Would delete" : "Deleted"} ${totalToDelete} duplicate repairs.`);
  }
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
