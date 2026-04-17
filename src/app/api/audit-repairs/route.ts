import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers } from "@/lib/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { isHoldedConfigured } from "@/lib/holded/client";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "@/lib/holded/invoices";

// Vercel cron: runs every 6 hours
// 1. Verifies linked invoice statuses match Holded
// 2. Detects and soft-deletes duplicate repairs

export const dynamic = "force-dynamic";

const PAYMENT_TOLERANCE_EUR = 0.05;

function holdedInvoiceStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) {
    const remaining = getPartiallyPaidRemaining(inv);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
    if (remaining === null && inv.total > 0 && inv.total <= PAYMENT_TOLERANCE_EUR * 2) {
      return "paid";
    }
  }
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

function getPartiallyPaidRemaining(inv: HoldedInvoice): number | null {
  if (typeof inv.due === "number") return Math.abs(inv.due);
  if (inv.payments && inv.payments.length > 0) {
    const totalPaid = inv.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return Math.max(0, inv.total - totalPaid);
  }
  return null;
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function completenessScore(r: {
  holdedInvoiceId: string | null;
  invoiceStatus: string;
  unitId: string | null;
  publicCode: string | null;
  completedAt: Date | null;
  descriptionRaw: string | null;
}): number {
  let score = 0;
  if (r.holdedInvoiceId) score += 100;
  if (r.invoiceStatus === "paid") score += 50;
  if (r.invoiceStatus === "sent") score += 30;
  if (r.unitId) score += 20;
  if (r.publicCode) score += 10;
  if (r.completedAt) score += 5;
  if (r.descriptionRaw) score += (r.descriptionRaw.length > 100 ? 3 : 1);
  return score;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  const stats = {
    statusFixed: 0,
    duplicatesRemoved: 0,
    errors: 0,
  };

  try {
    // ─── Part 1: Invoice status audit ───
    const allInvoices = await listAllInvoices();

    // Fetch details for partially paid invoices to check remaining amounts
    for (const inv of allInvoices) {
      if (inv.status === 2 && getPartiallyPaidRemaining(inv) === null) {
        try {
          const detail = await getInvoice(inv.id);
          if (detail.payments) inv.payments = detail.payments;
          if (typeof detail.due === "number") inv.due = detail.due;
        } catch { /* skip */ }
      }
    }

    const invoiceById = new Map<string, HoldedInvoice>();
    for (const inv of allInvoices) invoiceById.set(inv.id, inv);

    const allRepairs = await db
      .select({
        id: repairJobs.id,
        customerId: repairJobs.customerId,
        title: repairJobs.title,
        descriptionRaw: repairJobs.descriptionRaw,
        status: repairJobs.status,
        invoiceStatus: repairJobs.invoiceStatus,
        holdedInvoiceId: repairJobs.holdedInvoiceId,
        holdedInvoiceNum: repairJobs.holdedInvoiceNum,
        unitId: repairJobs.unitId,
        publicCode: repairJobs.publicCode,
        completedAt: repairJobs.completedAt,
        createdAt: repairJobs.createdAt,
      })
      .from(repairJobs)
      .where(isNull(repairJobs.deletedAt));

    // Fix status mismatches
    for (const r of allRepairs) {
      if (!r.holdedInvoiceId || ["warranty", "no_damage", "rejected"].includes(r.invoiceStatus)) continue;
      const inv = invoiceById.get(r.holdedInvoiceId);
      if (!inv) continue;

      const expected = holdedInvoiceStatus(inv);
      if (r.invoiceStatus !== expected) {
        try {
          await db
            .update(repairJobs)
            .set({ invoiceStatus: expected, updatedAt: new Date() })
            .where(eq(repairJobs.id, r.id));

          await db.insert(repairJobEvents).values({
            repairJobId: r.id,
            eventType: "payment_synced",
            fieldChanged: "invoiceStatus",
            oldValue: r.invoiceStatus,
            newValue: expected,
            comment: `Audit: ${r.invoiceStatus} → ${expected} (invoice ${r.holdedInvoiceNum})`,
          });
          stats.statusFixed++;
        } catch {
          stats.errors++;
        }
      }
    }

    // ─── Part 2: Duplicate detection & cleanup ───
    const byCustomer = new Map<string, typeof allRepairs>();
    for (const r of allRepairs) {
      if (!r.customerId) continue;
      const list = byCustomer.get(r.customerId) ?? [];
      list.push(r);
      byCustomer.set(r.customerId, list);
    }

    for (const [, repairs] of byCustomer) {
      if (repairs.length < 2) continue;

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

        // Sub-group by similar description
        const subGroups = new Map<string, typeof allRepairs>();
        for (const r of group) {
          const descKey = normalize(r.descriptionRaw).slice(0, 100) || title;
          let matched = false;
          for (const [key, sg] of subGroups) {
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
          sg.sort((a, b) => completenessScore(b) - completenessScore(a));
          const keep = sg[0];
          for (const dupe of sg.slice(1)) {
            try {
              await db
                .update(repairJobs)
                .set({ deletedAt: new Date(), updatedAt: new Date() })
                .where(eq(repairJobs.id, dupe.id));

              await db.insert(repairJobEvents).values({
                repairJobId: dupe.id,
                eventType: "status_changed",
                fieldChanged: "deletedAt",
                oldValue: "",
                newValue: new Date().toISOString(),
                comment: `Duplicate of ${keep.id.slice(0, 8)} — auto-cleaned by audit cron`,
              });
              stats.duplicatesRemoved++;
            } catch {
              stats.errors++;
            }
          }
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Audit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
}
