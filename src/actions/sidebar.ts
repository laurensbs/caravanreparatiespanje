"use server";

import { db } from "@/lib/db";
import {
  repairJobs,
  partRequests,
  customers,
  units,
  repairJobAssignments,
  toolRequests,
  repairMessages,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { and, eq, isNull, isNotNull, sql, inArray, notInArray } from "drizzle-orm";
import { autoPromoteDueRepairsToInProgress } from "./garage";

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
 *   planning         – repairs with status=scheduled AND a dueDate set
 *                      (i.e. actually on the planning). A quote just
 *                      approved in Holded goes to status=scheduled
 *                      without a date; those aren't on the planning
 *                      yet so we don't count them here — they'd
 *                      otherwise inflate the badge to 100+ and lose
 *                      its meaning.
 *   contacts         – total customers
 *   units            – total units (caravans)
 *   parts            – pending part requests + open workshop tool
 *                      requests. Both surface in the same /parts page
 *                      (the "Equipment" tab holds tool requests), so
 *                      the sidebar badge bundles them to match what
 *                      the admin sees when they click through.
 *   invoices         – completed without a Holded invoice link
 */
export async function getSidebarCounts() {
  await requireAuth();

  // Vóór we gaan tellen: promote geplande reparaties waarvan de dag
  // aangebroken is naar `in_progress`, zodat elk admin-scherm (én de
  // cijfers hieronder) consistent is met wat werkers in /garage zien.
  // Best-effort: mislukte promote mag de layout nooit kraken.
  try {
    await autoPromoteDueRepairsToInProgress();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[sidebar] autoPromoteDueRepairsToInProgress failed:", err);
  }

  const baseActiveRepair = and(
    isNull(repairJobs.archivedAt),
    isNull(repairJobs.deletedAt),
    notInArray(repairJobs.status, ["completed", "invoiced", "archived"]),
  );

  const [
    openRepairs,
    urgentOpen,
    scheduled,
    customerTotal,
    unitTotal,
    pendingParts,
    openToolRequests,
    uninvoiced,
    unreadGarageMessages,
    readyForCheckCount,
  ] = await Promise.all([
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
            // Alleen echt-geplande items tellen: anders zou de badge
            // elk net-goedgekeurd Holded-offerte-reparatie meetellen,
            // terwijl die pas werkelijk "scheduled" is zodra kantoor
            // er een datum aan hangt in de planning.
            isNotNull(repairJobs.dueDate),
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
        .from(toolRequests)
        .where(eq(toolRequests.status, "open")),

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

      // Ongelezen berichten van garage — drijft de "Messages" badge in
      // de sidebar. We tellen alle `garage_to_admin` messages zonder
      // `readAt`; de mark-read gebeurt al via markGarageRepliesRead /
      // markAdminThreadMessagesRead.
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairMessages)
        .where(
          and(
            eq(repairMessages.direction, "garage_to_admin"),
            isNull(repairMessages.readAt),
          ),
        ),

      // Reparaties die de garage als klaar heeft gemeld en wachten op
      // controle door kantoor — drijft de amber attention-dot op
      // "Work Orders" in de sidebar.
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(repairJobs)
        .where(
          and(
            isNull(repairJobs.archivedAt),
            isNull(repairJobs.deletedAt),
            eq(repairJobs.status, "ready_for_check"),
            notInArray(repairJobs.jobType, ["service"]),
          ),
        ),
    ]);

  return {
    workOrdersOpen: openRepairs[0]?.c ?? 0,
    workOrdersUrgent: urgentOpen[0]?.c ?? 0,
    planning: scheduled[0]?.c ?? 0,
    contacts: customerTotal[0]?.c ?? 0,
    units: unitTotal[0]?.c ?? 0,
    parts: (pendingParts[0]?.c ?? 0) + (openToolRequests[0]?.c ?? 0),
    invoices: uninvoiced[0]?.c ?? 0,
    messages: unreadGarageMessages[0]?.c ?? 0,
    readyForCheck: readyForCheckCount[0]?.c ?? 0,
  };
}

export type SidebarCounts = Awaited<ReturnType<typeof getSidebarCounts>>;

// Suppress TS unused warnings — these schemas are imported for type
// inference in case we extend the function later.
void units; void repairJobAssignments;
