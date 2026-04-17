/**
 * link-missing-invoices.ts
 *
 * For repairs marked as paid/sent without a Holded link:
 * 1. If customer has Holded invoices linked to deleted/other repairs → re-link
 * 2. If customer has no Holded invoices → search ALL invoices by name
 * 3. Report what's genuinely missing from Holded
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "../src/lib/holded/invoices";
import {
  pickHoldedInvoiceForRepairFromCandidates,
  type RepairHoldedMatchFields,
} from "../src/lib/holded/repair-ref-match";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql, schema });

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN\n" : "🔧 LIVE MODE\n");

  const allInvoices = await listAllInvoices();
  console.log(`Holded: ${allInvoices.length} invoices\n`);

  const allCustomers = await db.select().from(schema.customers);
  const custById = new Map(allCustomers.map((c) => [c.id, c]));

  const allRepairs = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
      spreadsheetInternalId: schema.repairJobs.spreadsheetInternalId,
      completedAt: schema.repairJobs.completedAt,
      createdAt: schema.repairJobs.createdAt,
      deletedAt: schema.repairJobs.deletedAt,
      registration: schema.units.registration,
    })
    .from(schema.repairJobs)
    .leftJoin(schema.units, eq(schema.repairJobs.unitId, schema.units.id));

  const activeLinkedIds = new Set(
    allRepairs.filter((r) => !r.deletedAt && r.holdedInvoiceId).map((r) => r.holdedInvoiceId!),
  );

  const invoicesByName = new Map<string, HoldedInvoice[]>();
  for (const inv of allInvoices) {
    const name = inv.contactName?.toLowerCase().trim();
    if (name) {
      const list = invoicesByName.get(name) || [];
      list.push(inv);
      invoicesByName.set(name, list);
    }
  }

  const unlinked = allRepairs.filter(
    (r) => !r.deletedAt && ["sent", "paid"].includes(r.invoiceStatus) && !r.holdedInvoiceId,
  );

  console.log(`=== ${unlinked.length} unlinked paid/sent repairs ===\n`);

  let linked = 0;
  const stillMissing: Array<{ name: string; title: string; invoiceStatus: string; id: string }> = [];

  for (const r of unlinked) {
    const cust = r.customerId ? custById.get(r.customerId) : null;
    const custName = cust?.name || "?";

    if (cust?.holdedContactId) {
      const custInvoices = allInvoices.filter((i) => i.contact === cust.holdedContactId);
      const available = custInvoices.filter((i) => !activeLinkedIds.has(i.id));

      if (available.length > 0) {
        const best = await pickBest(available, r);
        if (best) {
          const st = best.status === 1 ? "paid" : best.status === 2 ? "paid" : best.draft ? "draft" : "sent";
          console.log(`  ✓ ${custName} → #${best.docNumber} (€${best.total.toFixed(2)}, ${st})`);
          if (!DRY_RUN) {
            await db
              .update(schema.repairJobs)
              .set({
                holdedInvoiceId: best.id,
                holdedInvoiceNum: best.docNumber,
                holdedInvoiceDate: new Date(best.date * 1000),
                invoiceStatus: st === "draft" ? r.invoiceStatus : st,
                updatedAt: new Date(),
              })
              .where(eq(schema.repairJobs.id, r.id));
          }
          activeLinkedIds.add(best.id);
          linked++;
          continue;
        }
      }
    }

    if (cust?.name) {
      const nameKey = cust.name.toLowerCase().trim();
      let found = invoicesByName.get(nameKey)?.filter((i) => !activeLinkedIds.has(i.id));

      if (!found || found.length === 0) {
        let surname = "";
        const cleaned = nameKey.replace(/^(dhr|mevr|mr|mrs|dhr\/mevr)[.\s]*/g, "").trim();
        if (cleaned.includes(",")) {
          surname = cleaned.split(",")[0].trim();
        } else {
          const parts = cleaned.split(/\s+/);
          const prepIdx = parts.findIndex((p) => ["van", "de", "den", "der", "het", "von"].includes(p));
          surname = prepIdx >= 0 ? parts.slice(prepIdx).join(" ") : parts[parts.length - 1] || "";
        }
        if (surname.length > 3) {
          const regex = new RegExp(`\\b${surname.replace(/\s+/g, "\\s+")}\\b`);
          for (const [key, invs] of invoicesByName) {
            if (regex.test(key)) {
              const avail = invs.filter((i) => !activeLinkedIds.has(i.id));
              if (avail.length > 0) {
                found = avail;
                break;
              }
            }
          }
        }
      }

      if (found && found.length > 0) {
        const best = await pickBest(found, r);
        if (best) {
          const st = best.status === 1 ? "paid" : best.status === 2 ? "paid" : best.draft ? "draft" : "sent";
          console.log(
            `  ✓ ${custName} → #${best.docNumber} (€${best.total.toFixed(2)}, ${st}) [name match: ${best.contactName}]`,
          );
          if (!DRY_RUN) {
            await db
              .update(schema.repairJobs)
              .set({
                holdedInvoiceId: best.id,
                holdedInvoiceNum: best.docNumber,
                holdedInvoiceDate: new Date(best.date * 1000),
                invoiceStatus: st === "draft" ? r.invoiceStatus : st,
                updatedAt: new Date(),
              })
              .where(eq(schema.repairJobs.id, r.id));
          }
          activeLinkedIds.add(best.id);
          linked++;
          continue;
        }
      }
    }

    stillMissing.push({ name: custName, title: r.title?.slice(0, 60) || "-", invoiceStatus: r.invoiceStatus, id: r.id });
    console.log(`  ✗ ${custName} | NO invoice found in Holded | ${r.title?.slice(0, 50)}`);
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`Linked: ${linked}`);
  console.log(`Still missing from Holded: ${stillMissing.length}`);

  if (stillMissing.length > 0) {
    console.log(`\n=== Repairs without ANY Holded invoice ===`);
    for (const m of stillMissing) {
      console.log(`  ${m.name} | ${m.invoiceStatus} | ${m.title}`);
    }
  }

  if (DRY_RUN) console.log("\n⚠ DRY RUN — run without --dry-run to apply.");
}

async function pickBest(
  invoices: HoldedInvoice[],
  repair: {
    id: string;
    title: string | null;
    publicCode: string | null;
    spreadsheetInternalId: string | null;
    registration: string | null;
    completedAt: Date | null;
    createdAt: Date;
  },
): Promise<HoldedInvoice | null> {
  const real = invoices.filter((i) => i.docNumber && i.docNumber !== "---" && i.total > 0);
  const pool = real.length > 0 ? real : invoices;
  if (pool.length === 0) return null;

  const details = await Promise.all(pool.map((i) => getInvoice(i.id)));
  const repairFields: RepairHoldedMatchFields = {
    id: repair.id,
    publicCode: repair.publicCode,
    spreadsheetInternalId: repair.spreadsheetInternalId,
    title: repair.title,
    registration: repair.registration,
    createdAt: repair.createdAt,
    completedAt: repair.completedAt,
  };
  return pickHoldedInvoiceForRepairFromCandidates(repairFields, details);
}

main().catch(console.error);
