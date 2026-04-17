/**
 * One-off: split merged Jubitana family data — Carlos vs Naomi.
 *
 * Rule used (from user story: 2 repairs Naomi, 1 Carlos):
 * - WH-99-YS → Carlos (single job on that plate)
 * - WP-XS-52 → Naomi (two jobs on same van)
 *
 * Idempotent: safe to re-run; skips if Carlos repair already reassigned.
 * Duplicate empty "Naomi" row (57ee…) is removed; soft-deleted repairs on it
 * get customer_id set null via FK if needed.
 *
 *   npx tsx scripts/split-jubitana-customers.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers, repairJobs, repairJobEvents, units } from "../src/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

const NAOMI_CUSTOMER_ID = "3bae1e0b-9ca8-4264-8c23-84bbb0785532";
const DUPLICATE_NAOMI_ID = "57ee0fcb-e662-4294-b748-8fc182aa91d2";

/** Repair on WH-99-YS → assign to new Carlos client */
const CARLOS_REPAIR_ID = "51f27f84-069c-4e3a-b48f-f17a76b49f63";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const [naomi] = await db.select().from(customers).where(eq(customers.id, NAOMI_CUSTOMER_ID)).limit(1);
  if (!naomi) {
    console.error("Naomi customer row not found — abort.");
    process.exit(1);
  }

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(and(eq(repairJobs.id, CARLOS_REPAIR_ID), isNull(repairJobs.deletedAt)))
    .limit(1);
  if (!job) {
    console.error("Repair not found:", CARLOS_REPAIR_ID);
    process.exit(1);
  }
  if (job.customerId !== NAOMI_CUSTOMER_ID) {
    console.log("Already split — repair", CARLOS_REPAIR_ID, "customerId is", job.customerId);
    process.exit(0);
  }

  const [carlos] = await db
    .insert(customers)
    .values({
      name: "Dhr. Carlos Jubitana",
      contactType: naomi.contactType,
      phone: naomi.phone,
      email: naomi.email,
      mobile: naomi.mobile,
      address: naomi.address,
      city: naomi.city,
      postalCode: naomi.postalCode,
      province: naomi.province,
      country: naomi.country,
      notes: naomi.notes ? `${naomi.notes}\n\n[Split from shared family record — own client for WH-99-YS repairs.]` : "[Split from shared family record — own client for WH-99-YS repairs.]",
      holdedContactId: null,
      provisional: false,
      updatedAt: new Date(),
    })
    .returning();

  if (!carlos) {
    console.error("Failed to create Carlos customer");
    process.exit(1);
  }

  console.log("Created Carlos customer:", carlos.id);

  await db
    .update(repairJobs)
    .set({ customerId: carlos.id, updatedAt: new Date() })
    .where(eq(repairJobs.id, CARLOS_REPAIR_ID));

  await db.insert(repairJobEvents).values({
    repairJobId: CARLOS_REPAIR_ID,
    userId: null,
    eventType: "field_changed",
    fieldChanged: "customerId",
    oldValue: NAOMI_CUSTOMER_ID,
    newValue: carlos.id,
    comment: "Data fix: assign this repair to Carlos (family split); Naomi keeps WP-XS-52 jobs.",
  });

  if (job.unitId) {
    await db.update(units).set({ customerId: carlos.id, updatedAt: new Date() }).where(eq(units.id, job.unitId));
    console.log("Unit", job.unitId, "→ Carlos");
  }

  const dupStill = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, DUPLICATE_NAOMI_ID)).limit(1);
  if (dupStill.length > 0) {
    const dupRepairs = await db.select().from(repairJobs).where(eq(repairJobs.customerId, DUPLICATE_NAOMI_ID));
    const active = dupRepairs.filter((r) => !r.deletedAt);
    if (active.length > 0) {
      for (const r of active) {
        await db
          .update(repairJobs)
          .set({ customerId: NAOMI_CUSTOMER_ID, updatedAt: new Date() })
          .where(eq(repairJobs.id, r.id));
        await db.insert(repairJobEvents).values({
          repairJobId: r.id,
          userId: null,
          eventType: "field_changed",
          fieldChanged: "customerId",
          oldValue: DUPLICATE_NAOMI_ID,
          newValue: NAOMI_CUSTOMER_ID,
          comment: "Data fix: merge stray repair onto primary Naomi client before removing duplicate row.",
        });
      }
      console.log("Moved", active.length, "active repair(s) from duplicate Naomi → main Naomi");
    }
    await db.delete(customers).where(eq(customers.id, DUPLICATE_NAOMI_ID));
    console.log("Removed duplicate Naomi row:", DUPLICATE_NAOMI_ID);
  }

  console.log("Done. Naomi:", NAOMI_CUSTOMER_ID, "— Carlos:", carlos.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
