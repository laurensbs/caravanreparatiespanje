import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers } from "@/lib/db/schema";
import { eq, and, isNotNull, isNull, inArray } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { getInvoice, listInvoicesByContact, type HoldedInvoice } from "@/lib/holded/invoices";

// Vercel cron: runs every minute
// Phase 1: Discover invoices from Holded per customer and link to repairs
// Phase 2: Sync payment status for already-linked invoices

export const dynamic = "force-dynamic";

function holdedInvoiceStatus(invoice: HoldedInvoice): "draft" | "sent" | "paid" {
  // Holded status: 0 = not paid (sent), 1 = paid, 2 = partially paid
  if (invoice.status === 1) return "paid";
  // Draft invoices have draft flag or no real docNumber
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

  const stats = { discovered: 0, statusUpdated: 0, errors: 0, customersChecked: 0 };

  // ─── Phase 1: Discover unlinked invoices from Holded per customer ───

  // Get all customers with a Holded contact ID
  const holdedCustomers = await db
    .select({ id: customers.id, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));

  // Get all repairs grouped by customer to match against
  const allRepairs = await db
    .select({
      id: repairJobs.id,
      customerId: repairJobs.customerId,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      invoiceStatus: repairJobs.invoiceStatus,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
    })
    .from(repairJobs)
    .where(isNull(repairJobs.deletedAt));

  // Build lookup: customerId → repairs[]
  const repairsByCustomer = new Map<string, typeof allRepairs>();
  for (const r of allRepairs) {
    if (!r.customerId) continue;
    const list = repairsByCustomer.get(r.customerId) ?? [];
    list.push(r);
    repairsByCustomer.set(r.customerId, list);
  }

  // Set of already-linked Holded invoice IDs
  const linkedInvoiceIds = new Set(
    allRepairs.filter(r => r.holdedInvoiceId).map(r => r.holdedInvoiceId!)
  );

  for (const customer of holdedCustomers) {
    const customerRepairs = repairsByCustomer.get(customer.id);
    if (!customerRepairs || customerRepairs.length === 0) continue;

    try {
      stats.customersChecked++;
      const invoices = await listInvoicesByContact(customer.holdedContactId!);
      if (!invoices || invoices.length === 0) continue;

      for (const inv of invoices) {
        // Skip if already linked to a repair
        if (linkedInvoiceIds.has(inv.id)) continue;

        // Find unlinked repairs for this customer (no holdedInvoiceId yet)
        const unlinkedRepairs = customerRepairs.filter(
          r => !r.holdedInvoiceId && r.invoiceStatus !== "warranty"
        );
        if (unlinkedRepairs.length === 0) continue;

        // Try to match by publicCode or title in the invoice description/items
        const invText = [
          inv.desc ?? "",
          inv.docNumber ?? "",
          ...(inv.items ?? []).map(i => `${i.name} ${i.desc ?? ""}`),
        ].join(" ").toLowerCase();

        let matched = unlinkedRepairs.find(r =>
          r.publicCode && invText.includes(r.publicCode.toLowerCase())
        );

        // If no match by publicCode and customer has exactly 1 unlinked repair, auto-link
        if (!matched && unlinkedRepairs.length === 1) {
          matched = unlinkedRepairs[0];
        }

        if (matched) {
          const newStatus = holdedInvoiceStatus(inv);
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
            comment: `Invoice ${inv.docNumber} (€${inv.total.toFixed(2)}) discovered from Holded — status: ${newStatus}`,
          });

          // Mark as linked so we don't double-match
          linkedInvoiceIds.add(inv.id);
          matched.holdedInvoiceId = inv.id;
          stats.discovered++;
        }
      }
    } catch {
      stats.errors++;
    }
  }

  // ─── Phase 2: Sync payment status for already-linked invoices ───

  const linkedJobs = allRepairs.filter(
    j => j.holdedInvoiceId && j.invoiceStatus !== "paid" && j.invoiceStatus !== "warranty"
  );

  for (const job of linkedJobs) {
    try {
      const invoice = await getInvoice(job.holdedInvoiceId!);
      const newStatus = holdedInvoiceStatus(invoice);

      if (newStatus !== job.invoiceStatus) {
        await db
          .update(repairJobs)
          .set({ invoiceStatus: newStatus, updatedAt: new Date() })
          .where(eq(repairJobs.id, job.id));

        await db.insert(repairJobEvents).values({
          repairJobId: job.id,
          eventType: "payment_synced",
          fieldChanged: "invoiceStatus",
          oldValue: job.invoiceStatus,
          newValue: newStatus,
          comment: `Invoice ${job.holdedInvoiceId} status synced: ${job.invoiceStatus} → ${newStatus}`,
        });

        stats.statusUpdated++;
      }
    } catch {
      stats.errors++;
    }
  }

  return NextResponse.json({
    ...stats,
    linkedChecked: linkedJobs.length,
    timestamp: new Date().toISOString(),
  });
}
