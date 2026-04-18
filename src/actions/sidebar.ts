"use server";

import { db } from "@/lib/db";
import { repairJobs, partRequests, customers, units, repairJobAssignments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { and, eq, isNull, sql, inArray, notInArray } from "drizzle-orm";

/**
 * Lightweight counts for the sidebar nav. One round-trip, all `count(*)`
 * style queries gated by indexes that already exist (status,
 * archivedAt, deletedAt). Keep this fast — it runs on every layout
 * render.
 *
 * Returns:
 *   workOrdersOpen   – non-completed/invoiced/archived repairs
 *   workOrdersUrgent – open repairs with priority=urgent (drives the
 *                      red attention dot in the rail)
 *   planning         – repairs in scheduled (need to be slotted)
 *   contacts         – total customers
 *   units            – total units (caravans)
 *   parts            – pending part requests (ordered/shipped)
 *   invoices         – completed without a Holded invoice link
 */
export async function getSidebarCounts() {
  await requireAuth();

  const baseActiveRepair = and(
    isNull(repairJobs.archivedAt),
    isNull(repairJobs.deletedAt),
    notInArray(repairJobs.status, ["completed", "invoiced", "archived"]),
  );

  const [openRepairs, urgentOpen, scheduled, customerTotal, unitTotal, pendingParts, uninvoiced] =
    await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairJobs)
        .where(baseActiveRepair),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairJobs)
        .where(and(baseActiveRepair, eq(repairJobs.priority, "urgent"))),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairJobs)
        .where(
          and(
            isNull(repairJobs.archivedAt),
            isNull(repairJobs.deletedAt),
            eq(repairJobs.status, "scheduled"),
          ),
        ),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(customers),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(units),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(partRequests)
        .where(inArray(partRequests.status, ["requested", "ordered", "shipped"])),

      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairJobs)
        .where(
          and(
            isNull(repairJobs.archivedAt),
            isNull(repairJobs.deletedAt),
            eq(repairJobs.status, "completed"),
            isNull(repairJobs.holdedInvoiceId),
          ),
        ),
    ]);

  return {
    workOrdersOpen: openRepairs[0]?.c ?? 0,
    workOrdersUrgent: urgentOpen[0]?.c ?? 0,
    planning: scheduled[0]?.c ?? 0,
    contacts: customerTotal[0]?.c ?? 0,
    units: unitTotal[0]?.c ?? 0,
    parts: pendingParts[0]?.c ?? 0,
    invoices: uninvoiced[0]?.c ?? 0,
  };
}

export type SidebarCounts = Awaited<ReturnType<typeof getSidebarCounts>>;

// Suppress TS unused warnings — these schemas are imported for type
// inference in case we extend the function later.
void units; void repairJobAssignments;
