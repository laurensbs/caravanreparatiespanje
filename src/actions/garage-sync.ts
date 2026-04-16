"use server";

import { db } from "@/lib/db";
import {
  repairJobs,
  repairJobEvents,
  partRequests,
  repairTasks,
  repairBlockers,
  users,
  customers,
  locations,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import {
  eq,
  and,
  desc,
  isNull,
  sql,
  count,
  inArray,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// ATTENTION LEVELS
// ─────────────────────────────────────────────────────────────────────────────

type AttentionLevel = "low" | "medium" | "high";

const UPDATE_TYPE_ATTENTION: Record<string, AttentionLevel> = {
  task_completed: "low",
  timer_logged: "low",
  timer_started: "low",
  note_added: "low",
  photo_uploaded: "low",
  task_reopened: "low",
  work_started: "low",
  part_requested: "medium",
  issue_reported: "medium",
  task_suggested: "medium",
  job_blocked: "medium",
  ready_for_check: "high",
  urgent_issue: "high",
  blocker_added: "medium",
};

// ─────────────────────────────────────────────────────────────────────────────
// RECORD GARAGE UPDATE — called from garage actions
// ─────────────────────────────────────────────────────────────────────────────

export async function recordGarageUpdate(
  repairJobId: string,
  updateType: string,
  userId: string | null
) {
  const attention = UPDATE_TYPE_ATTENTION[updateType] ?? "low";
  const needsAttention = attention === "medium" || attention === "high";

  await db
    .update(repairJobs)
    .set({
      garageLastUpdateAt: new Date(),
      garageLastUpdateType: updateType,
      garageLastUpdatedByUserId: userId,
      ...(needsAttention
        ? { garageNeedsAdminAttention: true }
        : {}),
      garageUnreadUpdatesCount: sql`${repairJobs.garageUnreadUpdatesCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));
}

// ─────────────────────────────────────────────────────────────────────────────
// MARK AS READ — called when admin opens a repair detail page
// ─────────────────────────────────────────────────────────────────────────────

export async function markGarageUpdatesRead(repairJobId: string) {
  await requireAuth();

  await db
    .update(repairJobs)
    .set({
      garageUnreadUpdatesCount: 0,
    })
    .where(eq(repairJobs.id, repairJobId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR ATTENTION — called when admin takes action (approve, send back, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export async function clearGarageAttention(repairJobId: string) {
  await requireAuth();

  await db
    .update(repairJobs)
    .set({
      garageNeedsAdminAttention: false,
      garageUnreadUpdatesCount: 0,
    })
    .where(eq(repairJobs.id, repairJobId));
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN → GARAGE MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

export async function sendMessageToGarage(repairJobId: string, message: string) {
  const session = await requireAuth();

  await db
    .update(repairJobs)
    .set({
      garageAdminMessage: message,
      garageAdminMessageAt: new Date(),
      garageAdminMessageReadAt: null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  // Log the event for audit trail
  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "admin_message_sent",
    comment: message,
  });

  revalidatePath("/");
}

export async function markAdminMessageRead(repairJobId: string) {
  await requireAnyAuth();

  await db
    .update(repairJobs)
    .set({
      garageAdminMessageReadAt: new Date(),
    })
    .where(
      and(
        eq(repairJobs.id, repairJobId),
        isNull(repairJobs.garageAdminMessageReadAt)
      )
    );
}

export async function clearGarageMessage(repairJobId: string) {
  await requireAuth();

  await db
    .update(repairJobs)
    .set({
      garageAdminMessage: null,
      garageAdminMessageAt: null,
      garageAdminMessageReadAt: null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  revalidatePath("/");
}

// ─────────────────────────────────────────────────────────────────────────────
// GET GARAGE ACTIVITY — recent events for a repair (admin detail view)
// ─────────────────────────────────────────────────────────────────────────────

const GARAGE_EVENT_TYPES = [
  "status_changed",
  "task_status_changed",
  "part_requested",
  "task_suggested",
  "task_deleted",
  "finding_added",
  "blocker_added",
  "blocker_resolved",
  "finding_resolved",
  "final_check_passed",
  "final_check_failed",
  "photo_uploaded",
];

export async function getGarageActivity(repairJobId: string, limit = 10) {
  await requireAuth();

  const events = await db
    .select({
      id: repairJobEvents.id,
      eventType: repairJobEvents.eventType,
      fieldChanged: repairJobEvents.fieldChanged,
      oldValue: repairJobEvents.oldValue,
      newValue: repairJobEvents.newValue,
      comment: repairJobEvents.comment,
      createdAt: repairJobEvents.createdAt,
      userName: users.name,
      userId: repairJobEvents.userId,
    })
    .from(repairJobEvents)
    .leftJoin(users, eq(repairJobEvents.userId, users.id))
    .where(
      and(
        eq(repairJobEvents.repairJobId, repairJobId),
        inArray(repairJobEvents.eventType, GARAGE_EVENT_TYPES)
      )
    )
    .orderBy(desc(repairJobEvents.createdAt))
    .limit(limit);

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ATTENTION ITEMS — for admin dashboard widget
// ─────────────────────────────────────────────────────────────────────────────

export async function getGarageAttentionItems() {
  await requireAuth();

  // Count by category
  const [readyForCheck, blocked, partsRequested] = await Promise.all([
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          eq(repairJobs.status, "ready_for_check"),
          isNull(repairJobs.deletedAt),
          isNull(repairJobs.archivedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          eq(repairJobs.status, "blocked"),
          isNull(repairJobs.deletedAt),
          isNull(repairJobs.archivedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(partRequests)
      .where(eq(partRequests.status, "requested")),
  ]);

  // Top items needing attention
  const items = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      garageLastUpdateType: repairJobs.garageLastUpdateType,
      garageLastUpdateAt: repairJobs.garageLastUpdateAt,
      garageNeedsAdminAttention: repairJobs.garageNeedsAdminAttention,
      garageUnreadUpdatesCount: repairJobs.garageUnreadUpdatesCount,
      customerName: customers.name,
      locationName: locations.name,
      lastUpdatedByName: users.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .leftJoin(users, eq(repairJobs.garageLastUpdatedByUserId, users.id))
    .where(
      and(
        eq(repairJobs.garageNeedsAdminAttention, true),
        isNull(repairJobs.deletedAt),
        isNull(repairJobs.archivedAt)
      )
    )
    .orderBy(desc(repairJobs.garageLastUpdateAt))
    .limit(10);

  return {
    counts: {
      readyForCheck: readyForCheck[0]?.count ?? 0,
      blocked: blocked[0]?.count ?? 0,
      partsRequested: partsRequested[0]?.count ?? 0,
    },
    items,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SYNC STATE — for repair detail sync strip
// ─────────────────────────────────────────────────────────────────────────────

export async function getRepairSyncState(repairJobId: string) {
  await requireAuth();

  const [job] = await db
    .select({
      garageLastUpdateAt: repairJobs.garageLastUpdateAt,
      garageLastUpdateType: repairJobs.garageLastUpdateType,
      garageNeedsAdminAttention: repairJobs.garageNeedsAdminAttention,
      garageUnreadUpdatesCount: repairJobs.garageUnreadUpdatesCount,
      garageAdminMessage: repairJobs.garageAdminMessage,
      garageAdminMessageAt: repairJobs.garageAdminMessageAt,
      lastUpdatedByName: users.name,
      status: repairJobs.status,
      finalCheckStatus: repairJobs.finalCheckStatus,
    })
    .from(repairJobs)
    .leftJoin(users, eq(repairJobs.garageLastUpdatedByUserId, users.id))
    .where(eq(repairJobs.id, repairJobId));

  if (!job) return null;

  // Get summary of recent garage work
  const recentEvents = await db
    .select({
      eventType: repairJobEvents.eventType,
      comment: repairJobEvents.comment,
      userName: users.name,
      createdAt: repairJobEvents.createdAt,
      newValue: repairJobEvents.newValue,
    })
    .from(repairJobEvents)
    .leftJoin(users, eq(repairJobEvents.userId, users.id))
    .where(
      and(
        eq(repairJobEvents.repairJobId, repairJobId),
        inArray(repairJobEvents.eventType, GARAGE_EVENT_TYPES)
      )
    )
    .orderBy(desc(repairJobEvents.createdAt))
    .limit(3);

  return {
    ...job,
    recentEvents,
  };
}
