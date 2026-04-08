import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents } from "@/lib/db/schema";
import { eq, isNotNull, ne } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { getInvoice } from "@/lib/holded/invoices";

// Vercel cron: runs every 30 minutes
// Add to vercel.json: { "crons": [{ "path": "/api/sync-payments", "schedule": "*/30 * * * *" }] }

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify cron secret or skip auth for Vercel cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  // Find all repair jobs with a Holded invoice that aren't marked as paid yet
  const unpaidJobs = await db
    .select({
      id: repairJobs.id,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      invoiceStatus: repairJobs.invoiceStatus,
    })
    .from(repairJobs)
    .where(isNotNull(repairJobs.holdedInvoiceId));

  // Filter to only non-paid ones
  const toCheck = unpaidJobs.filter(j => j.invoiceStatus !== "paid" && j.holdedInvoiceId);

  let synced = 0;
  let errors = 0;

  for (const job of toCheck) {
    try {
      const invoice = await getInvoice(job.holdedInvoiceId!);

      // Holded status: 0 = unpaid, 1 = paid, 2 = partially paid
      if (invoice.status === 1 && job.invoiceStatus !== "paid") {
        await db
          .update(repairJobs)
          .set({ invoiceStatus: "paid", updatedAt: new Date() })
          .where(eq(repairJobs.id, job.id));

        await db.insert(repairJobEvents).values({
          repairJobId: job.id,
          eventType: "payment_synced",
          fieldChanged: "invoiceStatus",
          oldValue: job.invoiceStatus,
          newValue: "paid",
          comment: `Payment for ${job.holdedInvoiceNum} confirmed via Holded sync`,
        });

        synced++;
      } else if (invoice.status === 0 && job.invoiceStatus === "sent") {
        // Still unpaid — no action needed, status is correct
      } else if (invoice.status === 2 && job.invoiceStatus !== "sent") {
        // Partially paid — keep as "sent" status
        await db
          .update(repairJobs)
          .set({ invoiceStatus: "sent", updatedAt: new Date() })
          .where(eq(repairJobs.id, job.id));
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    checked: toCheck.length,
    synced,
    errors,
    timestamp: new Date().toISOString(),
  });
}
