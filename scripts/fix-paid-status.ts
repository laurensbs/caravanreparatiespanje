import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

const earlyStatuses = [
  "new", "todo", "in_inspection", "quote_needed", "waiting_approval",
  "waiting_customer", "waiting_parts", "scheduled", "in_progress", "blocked", "completed",
] as const;

async function main() {
  // Find repairs with a sent or paid invoice that are still in an early status
  const stuck = await db
    .select({
      id: repairJobs.id,
      status: repairJobs.status,
      invoiceStatus: repairJobs.invoiceStatus,
      publicCode: repairJobs.publicCode,
    })
    .from(repairJobs)
    .where(
      and(
        isNull(repairJobs.deletedAt),
        inArray(repairJobs.invoiceStatus, ["paid", "sent"]),
        inArray(repairJobs.status, [...earlyStatuses]),
      ),
    );

  console.log(`\nRepairs with sent/paid invoice but early status: ${stuck.length}\n`);
  for (const r of stuck) {
    console.log(`  ${r.publicCode ?? "?"} — ${r.status} (invoice: ${r.invoiceStatus}) → invoiced`);
  }

  for (const r of stuck) {
    await db
      .update(repairJobs)
      .set({ status: "invoiced", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(repairJobs.id, r.id));

    await db.insert(repairJobEvents).values({
      repairJobId: r.id,
      eventType: "status_changed",
      fieldChanged: "status",
      oldValue: r.status,
      newValue: "invoiced",
      comment: `Auto-advanced to invoiced — invoice is ${r.invoiceStatus}`,
    });
  }

  console.log(`\nDone. Updated ${stuck.length} repairs.\n`);
  process.exit(0);
}

main();
