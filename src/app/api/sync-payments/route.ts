import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers } from "@/lib/db/schema";
import { eq, isNotNull, isNull } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, type HoldedInvoice } from "@/lib/holded/invoices";

// Vercel cron: runs every minute
// Fetches ALL invoices from Holded, matches to repairs, syncs invoice status

export const dynamic = "force-dynamic";

function holdedInvoiceStatus(invoice: HoldedInvoice): "draft" | "sent" | "paid" {
  if (invoice.status === 1) return "paid";
  if (invoice.draft || !invoice.docNumber || invoice.docNumber === "---") return "draft";
  return "sent";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  const stats = { discovered: 0, statusUpdated: 0, errors: 0, invoicesTotal: 0 };

  try {
    // ─── Step 1: Fetch ALL invoices from Holded ───
    const allInvoices = await listAllInvoices();
    stats.invoicesTotal = allInvoices.length;

    // ─── Step 2: Load all repairs and customers ───
    const allRepairs = await db
      .select({
        id: repairJobs.id,
        customerId: repairJobs.customerId,
        holdedInvoiceId: repairJobs.holdedInvoiceId,
        invoiceStatus: repairJobs.invoiceStatus,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        createdAt: repairJobs.createdAt,
        completedAt: repairJobs.completedAt,
      })
      .from(repairJobs)
      .where(isNull(repairJobs.deletedAt));

    const allCustomers = await db
      .select({ id: customers.id, holdedContactId: customers.holdedContactId })
      .from(customers)
      .where(isNotNull(customers.holdedContactId));

    // Build lookup: holdedContactId → customerId
    const customerByHoldedId = new Map<string, string>();
    for (const c of allCustomers) {
      if (c.holdedContactId) customerByHoldedId.set(c.holdedContactId, c.id);
    }

    // Build lookup: customerId → repairs[]
    const repairsByCustomer = new Map<string, typeof allRepairs>();
    for (const r of allRepairs) {
      if (!r.customerId) continue;
      const list = repairsByCustomer.get(r.customerId) ?? [];
      list.push(r);
      repairsByCustomer.set(r.customerId, list);
    }

    // Build lookup: holdedInvoiceId → repair (already linked)
    const repairByInvoiceId = new Map<string, (typeof allRepairs)[0]>();
    for (const r of allRepairs) {
      if (r.holdedInvoiceId) repairByInvoiceId.set(r.holdedInvoiceId, r);
    }

    // ─── Step 3: Process each Holded invoice ───
    for (const inv of allInvoices) {
      try {
        const newStatus = holdedInvoiceStatus(inv);

        // Case A: Invoice already linked to a repair → sync status
        const existingRepair = repairByInvoiceId.get(inv.id);
        if (existingRepair) {
          if (existingRepair.invoiceStatus !== newStatus && existingRepair.invoiceStatus !== "warranty") {
            await db
              .update(repairJobs)
              .set({ invoiceStatus: newStatus, updatedAt: new Date() })
              .where(eq(repairJobs.id, existingRepair.id));

            await db.insert(repairJobEvents).values({
              repairJobId: existingRepair.id,
              eventType: "payment_synced",
              fieldChanged: "invoiceStatus",
              oldValue: existingRepair.invoiceStatus,
              newValue: newStatus,
              comment: `Invoice ${inv.docNumber} status synced: ${existingRepair.invoiceStatus} → ${newStatus}`,
            });

            existingRepair.invoiceStatus = newStatus;
            stats.statusUpdated++;
          }
          continue;
        }

        // Case B: Invoice not linked — try to discover and link to a repair
        const customerId = customerByHoldedId.get(inv.contact);
        if (!customerId) continue;

        const customerRepairs = repairsByCustomer.get(customerId);
        if (!customerRepairs) continue;

        // Only consider repairs without an invoice linked and not warranty
        const unlinkedRepairs = customerRepairs.filter(
          r => !r.holdedInvoiceId && r.invoiceStatus !== "warranty"
        );
        if (unlinkedRepairs.length === 0) continue;

        // Build searchable text from invoice
        const invText = [
          inv.desc ?? "",
          inv.docNumber ?? "",
          ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
        ].join(" ").toLowerCase();

        // Strategy 1: Match by publicCode in invoice text
        let matched = unlinkedRepairs.find(r =>
          r.publicCode && invText.includes(r.publicCode.toLowerCase())
        );

        // Strategy 2: Match by title keywords in invoice text
        if (!matched) {
          matched = unlinkedRepairs.find(r =>
            r.title && r.title.length > 3 && invText.includes(r.title.toLowerCase())
          );
        }

        // Strategy 3: Date proximity — match invoice date to closest repair
        if (!matched) {
          const invDate = inv.date * 1000;
          let bestMatch: (typeof unlinkedRepairs)[0] | null = null;
          let bestDist = Infinity;
          for (const r of unlinkedRepairs) {
            const repairDate = (r.completedAt ?? r.createdAt).getTime();
            const dist = Math.abs(invDate - repairDate);
            if (dist < bestDist) {
              bestDist = dist;
              bestMatch = r;
            }
          }
          // Only auto-match if within 90 days
          if (bestMatch && bestDist < 90 * 24 * 60 * 60 * 1000) {
            matched = bestMatch;
          }
        }

        if (matched) {
          await db
            .update(repairJobs)
            .set({
              holdedInvoiceId: inv.id,
              holdedInvoiceNum: inv.docNumber,
              holdedInvoiceDate: new Date(inv.date * 1000),
              invoiceStatus: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(repairJobs.id, matched.id));

          await db.insert(repairJobEvents).values({
            repairJobId: matched.id,
            eventType: "invoice_discovered",
            fieldChanged: "holdedInvoiceId",
            oldValue: "",
            newValue: inv.docNumber,
            comment: `Invoice ${inv.docNumber} (€${inv.total.toFixed(2)}) linked from Holded — status: ${newStatus}`,
          });

          // Update in-memory state to prevent double-matching
          matched.holdedInvoiceId = inv.id;
          matched.invoiceStatus = newStatus;
          repairByInvoiceId.set(inv.id, matched);
          stats.discovered++;
        }
      } catch {
        stats.errors++;
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}
