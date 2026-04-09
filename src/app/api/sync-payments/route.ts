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

  const stats = { discovered: 0, statusUpdated: 0, statusAdvanced: 0, errors: 0, invoicesTotal: 0 };

  // Statuses that should auto-advance when invoice is paid
  const earlyStatuses = ["new", "todo", "in_inspection", "quote_needed", "waiting_approval",
    "waiting_customer", "waiting_parts", "scheduled", "in_progress", "blocked", "completed"];

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
        holdedInvoiceDate: repairJobs.holdedInvoiceDate,
        invoiceStatus: repairJobs.invoiceStatus,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        dueDate: repairJobs.dueDate,
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

        // Case A: Invoice already linked to a repair → sync status + dates
        const existingRepair = repairByInvoiceId.get(inv.id);
        if (existingRepair) {
          const invDate = new Date(inv.date * 1000);
          const invDueDate = inv.dueDate ? new Date(inv.dueDate * 1000) : null;
          const statusChanged = existingRepair.invoiceStatus !== newStatus && existingRepair.invoiceStatus !== "warranty";
          const dateChanged = existingRepair.holdedInvoiceDate?.getTime() !== invDate.getTime();
          const dueDateChanged = invDueDate && existingRepair.dueDate?.getTime() !== invDueDate.getTime();

          // Auto-advance repair status when invoice is sent or paid
          const shouldAdvanceStatus = (newStatus === "paid" || newStatus === "sent")
            && earlyStatuses.includes(existingRepair.status);

          if (statusChanged || dateChanged || dueDateChanged || shouldAdvanceStatus) {
            const updates: Record<string, unknown> = { updatedAt: new Date() };
            if (statusChanged) updates.invoiceStatus = newStatus;
            if (dateChanged) updates.holdedInvoiceDate = invDate;
            if (dueDateChanged) updates.dueDate = invDueDate;
            if (shouldAdvanceStatus) {
              updates.status = "invoiced";
              if (!existingRepair.completedAt) updates.completedAt = new Date();
            }

            await db
              .update(repairJobs)
              .set(updates)
              .where(eq(repairJobs.id, existingRepair.id));

            if (statusChanged) {
              await db.insert(repairJobEvents).values({
                repairJobId: existingRepair.id,
                eventType: "payment_synced",
                fieldChanged: "invoiceStatus",
                oldValue: existingRepair.invoiceStatus,
                newValue: newStatus,
                comment: `Invoice ${inv.docNumber} status synced: ${existingRepair.invoiceStatus} → ${newStatus}`,
              });
              existingRepair.invoiceStatus = newStatus;
            }
            if (shouldAdvanceStatus) {
              await db.insert(repairJobEvents).values({
                repairJobId: existingRepair.id,
                eventType: "status_changed",
                fieldChanged: "status",
                oldValue: existingRepair.status,
                newValue: "invoiced",
                comment: `Auto-advanced to invoiced — invoice ${inv.docNumber} is ${newStatus}`,
              });
              existingRepair.status = "invoiced";
              stats.statusAdvanced++;
            }
            if (dateChanged || dueDateChanged) {
              existingRepair.holdedInvoiceDate = invDate;
              if (invDueDate) existingRepair.dueDate = invDueDate;
            }
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
          const invDueDate = inv.dueDate ? new Date(inv.dueDate * 1000) : null;
          // If invoice is sent or paid, auto-advance repair status
          const advanceStatus = (newStatus === "paid" || newStatus === "sent") && earlyStatuses.includes(matched.status);
          await db
            .update(repairJobs)
            .set({
              holdedInvoiceId: inv.id,
              holdedInvoiceNum: inv.docNumber,
              holdedInvoiceDate: new Date(inv.date * 1000),
              ...(invDueDate ? { dueDate: invDueDate } : {}),
              invoiceStatus: newStatus,
              ...(advanceStatus ? { status: "invoiced" as const, completedAt: matched.completedAt ?? new Date() } : {}),
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
