"use server";

import { db } from "@/lib/db";
import {
  repairJobs,
  repairJobEvents,
  repairMessages,
  partRequests,
  repairTasks,
  repairBlockers,
  users,
  customers,
  locations,
  voiceNotes,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import {
  eq,
  and,
  desc,
  asc,
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

  // Mirror into the conversation thread so the new bidirectional UI shows
  // the same message the legacy composer produced.
  await db.insert(repairMessages).values({
    repairJobId,
    direction: "admin_to_garage",
    body: message,
    userId: session.user.id,
  });

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
// BIDIRECTIONAL THREAD (admin ↔ garage) — backed by repair_messages
// ─────────────────────────────────────────────────────────────────────────────

export type RepairMessage = {
  id: string;
  direction: "admin_to_garage" | "garage_to_admin";
  body: string;
  authorName: string | null;
  userName: string | null;
  readAt: Date | null;
  createdAt: Date;
  /** Gekoppelde voice-note (voice_notes.ownerType='repair_message'), zo
   *  gefetched dat de chat-UI direct een <VoicePlayer/> kan renderen
   *  zonder een tweede round-trip. */
  voice: { url: string; durationSeconds: number } | null;
};

/** Both sides — admin and garage portal — can read the thread. */
export async function listRepairMessages(repairJobId: string): Promise<RepairMessage[]> {
  await requireAnyAuth();

  const rows = await db
    .select({
      id: repairMessages.id,
      direction: repairMessages.direction,
      body: repairMessages.body,
      authorName: repairMessages.authorName,
      userName: users.name,
      readAt: repairMessages.readAt,
      createdAt: repairMessages.createdAt,
    })
    .from(repairMessages)
    .leftJoin(users, eq(repairMessages.userId, users.id))
    .where(eq(repairMessages.repairJobId, repairJobId))
    .orderBy(asc(repairMessages.createdAt))
    .limit(200);

  // Voice-notes voor alle berichten tegelijk ophalen (één query) en
  // indexeren per message-id — dat vermijdt N+1 terwijl we in de chat-UI
  // direct playback-metadata beschikbaar hebben.
  const voiceByMsg = new Map<string, { url: string; durationSeconds: number }>();
  if (rows.length > 0) {
    const msgIds = rows.map((r) => r.id);
    const vs = await db
      .select({
        ownerId: voiceNotes.ownerId,
        url: voiceNotes.url,
        durationSeconds: voiceNotes.durationSeconds,
      })
      .from(voiceNotes)
      .where(
        and(
          eq(voiceNotes.ownerType, "repair_message"),
          inArray(voiceNotes.ownerId, msgIds),
        ),
      );
    for (const v of vs) {
      if (v.url) {
        voiceByMsg.set(v.ownerId, {
          url: v.url,
          durationSeconds: v.durationSeconds ?? 0,
        });
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction as "admin_to_garage" | "garage_to_admin",
    body: r.body,
    authorName: r.authorName,
    userName: r.userName,
    readAt: r.readAt ? new Date(r.readAt) : null,
    createdAt: new Date(r.createdAt),
    voice: voiceByMsg.get(r.id) ?? null,
  }));
}

/** Admin → garage. Also keeps the legacy banner field in sync so today-card
 *  shows the latest single message. */
export async function adminReplyToGarage(repairJobId: string, body: string) {
  const session = await requireAuth();
  const trimmed = body.trim();
  // Voice-only bericht krijgt een placeholder-body zodat niet-null en
  // niet-leeg blijft (repairMessages.body is NOT NULL). Caller stuurt
  // "" of bv. "🎙" wanneer alleen spraak bedoeld is; we normaliseren
  // hier naar "🎙 Voice message" zodat admin panels die alleen body
  // printen iets leesbaars tonen — de echte audio komt via voice_notes.
  const finalBody = trimmed || "🎙 Voice message";

  const [inserted] = await db
    .insert(repairMessages)
    .values({
      repairJobId,
      direction: "admin_to_garage",
      body: finalBody,
      userId: session.user.id,
    })
    .returning({ id: repairMessages.id });

  // Mirror to legacy banner for the today-card visibility
  await db
    .update(repairJobs)
    .set({
      garageAdminMessage: finalBody,
      garageAdminMessageAt: new Date(),
      garageAdminMessageReadAt: null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "admin_message_sent",
    comment: finalBody,
  });

  revalidatePath(`/garage/repairs/${repairJobId}`);
  revalidatePath(`/repairs/${repairJobId}`);
  return { success: true, messageId: inserted?.id ?? null } as const;
}

/** Garage → admin. The garage portal uses a shared session so we accept an
 *  optional worker name typed by the technician. */
export async function garageReplyToAdmin(
  repairJobId: string,
  body: string,
  authorName?: string,
) {
  const ctx = await requireAnyAuth();
  const trimmed = body.trim();
  // Voice-only bericht mag ook, dan nemen we "🎙 Voice message" als body
  // zodat panels die enkel body tonen een leesbaar label zien.
  const finalBody = trimmed || "🎙 Voice message";

  const [inserted] = await db
    .insert(repairMessages)
    .values({
      repairJobId,
      direction: "garage_to_admin",
      body: finalBody,
      userId: ctx.userId ?? null,
      authorName: authorName?.trim() || ctx.userName || null,
    })
    .returning({ id: repairMessages.id });

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: ctx.userId ?? null,
    eventType: "garage_message_sent",
    comment: finalBody,
  });

  // Surface as admin attention so the inbox lights up.
  await recordGarageUpdate(repairJobId, "garage_message", ctx.userId);

  revalidatePath(`/garage/repairs/${repairJobId}`);
  revalidatePath(`/repairs/${repairJobId}`);
  return { success: true, messageId: inserted?.id ?? null } as const;
}

/** Admin marks the unread garage replies on a repair as read. */
export async function markGarageRepliesRead(repairJobId: string) {
  await requireAuth();

  await db
    .update(repairMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(repairMessages.repairJobId, repairJobId),
        eq(repairMessages.direction, "garage_to_admin"),
        isNull(repairMessages.readAt),
      ),
    );

  revalidatePath(`/repairs/${repairJobId}`);
}

/** Garage marks the unread admin messages in the thread as read.
 *  (The legacy banner has its own marker — this one covers the new thread.) */
export async function markAdminThreadMessagesRead(repairJobId: string) {
  await requireAnyAuth();

  await db
    .update(repairMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(repairMessages.repairJobId, repairJobId),
        eq(repairMessages.direction, "admin_to_garage"),
        isNull(repairMessages.readAt),
      ),
    );
}

/** Compact summary across all repairs — used by the assistant inbox badge to
 *  show how many garage replies still need an admin glance. */
/**
 * Breedere inbox-feed voor de /messages pagina. Geeft per repairJob
 * één rij met:
 *  - laatste bericht (van beide kanten)
 *  - unread count (alleen garage_to_admin & readAt IS NULL)
 *  - totale message count
 *  - meta (publicCode, titel, klant, status)
 *
 * Sorteert op laatste activiteit desc. Filter "onlyUnread" toont
 * alleen threads waar garage iets heeft gezegd dat admin nog niet
 * gelezen heeft; handig voor de standaard-weergave.
 */
export async function listMessageThreads(opts?: { onlyUnread?: boolean }) {
  await requireAuth();

  const conversationJobIds = await db
    .selectDistinct({ id: repairMessages.repairJobId })
    .from(repairMessages);

  if (conversationJobIds.length === 0) return [];

  const jobIds = conversationJobIds.map((r) => r.id);

  const messageStats = await db
    .select({
      repairJobId: repairMessages.repairJobId,
      lastAt: sql<Date>`max(${repairMessages.createdAt})`,
      totalCount: sql<number>`count(*)::int`,
      unreadCount: sql<number>`count(*) filter (where ${repairMessages.direction} = 'garage_to_admin' and ${repairMessages.readAt} is null)::int`,
    })
    .from(repairMessages)
    .where(inArray(repairMessages.repairJobId, jobIds))
    .groupBy(repairMessages.repairJobId);

  // Voor elke repair het laatste bericht (body + direction + author)
  // ophalen. Subquery per repair is simpel en blijft klein (< 100
  // repairs realistisch).
  const lastMessages = await db
    .select({
      repairJobId: repairMessages.repairJobId,
      body: repairMessages.body,
      direction: repairMessages.direction,
      authorName: repairMessages.authorName,
      createdAt: repairMessages.createdAt,
    })
    .from(repairMessages)
    .where(inArray(repairMessages.repairJobId, jobIds))
    .orderBy(desc(repairMessages.createdAt));

  const lastByJob = new Map<string, (typeof lastMessages)[0]>();
  for (const m of lastMessages) {
    if (!lastByJob.has(m.repairJobId)) lastByJob.set(m.repairJobId, m);
  }

  const jobInfos = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      customerName: customers.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(inArray(repairJobs.id, jobIds));

  const jobMap = new Map(jobInfos.map((j) => [j.id, j]));

  const rows = messageStats
    .map((s) => {
      const j = jobMap.get(s.repairJobId);
      const last = lastByJob.get(s.repairJobId);
      if (!j) return null;
      return {
        repairJobId: s.repairJobId,
        publicCode: j.publicCode,
        title: j.title,
        status: j.status,
        customerName: j.customerName,
        totalCount: Number(s.totalCount),
        unreadCount: Number(s.unreadCount),
        lastAt: s.lastAt ? new Date(s.lastAt) : null,
        lastBody: last?.body ?? null,
        lastDirection: last?.direction ?? null,
        lastAuthor: last?.authorName ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const filtered = opts?.onlyUnread ? rows.filter((r) => r.unreadCount > 0) : rows;

  return filtered.sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}

export async function getUnreadGarageRepliesSummary() {
  await requireAuth();

  const rows = await db
    .select({
      repairJobId: repairMessages.repairJobId,
      lastBody: sql<string>`max(${repairMessages.body})`,
      lastAt: sql<Date>`max(${repairMessages.createdAt})`,
      unreadCount: sql<number>`count(*)::int`,
    })
    .from(repairMessages)
    .where(
      and(
        eq(repairMessages.direction, "garage_to_admin"),
        isNull(repairMessages.readAt),
      ),
    )
    .groupBy(repairMessages.repairJobId)
    .limit(50);

  if (rows.length === 0) return [];

  const jobIds = rows.map((r) => r.repairJobId);
  const jobInfos = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      customerName: customers.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(inArray(repairJobs.id, jobIds));

  const jobMap = new Map(jobInfos.map((j) => [j.id, j]));

  return rows
    .map((r) => {
      const j = jobMap.get(r.repairJobId);
      if (!j) return null;
      return {
        repairJobId: r.repairJobId,
        publicCode: j.publicCode,
        title: j.title,
        customerName: j.customerName,
        unreadCount: Number(r.unreadCount),
        lastAt: r.lastAt ? new Date(r.lastAt) : null,
        lastBody: r.lastBody,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
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
