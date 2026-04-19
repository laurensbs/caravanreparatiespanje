"use server";

import { db } from "@/lib/db";
import { timeEntries, users, repairJobs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import { canStartGarageTimerOnRepair, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Server Actions are POST requests. If anything inside them — including
 * the implicit re-render that revalidatePath kicks off — throws, the
 * client receives an opaque 500 with only a digest. Wrap the revalidate
 * calls so a transient render glitch in /garage cannot turn a successful
 * mutation into a broken POST. The mutation itself has already been
 * committed; the worst-case fallback is that the UI refreshes a few
 * seconds later via the existing polling.
 */
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[time-entries] revalidatePath(${path}) failed:`, err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round raw minutes to nearest quarter-hour (ceiling, min 15) */
function roundToQuarter(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / 15) * 15;
}

// ─── Start / Stop Timer ─────────────────────────────────────────────────────

/** Start a timer for a user on a repair job. If no userId provided, uses the session user. */
export async function startTimer(repairJobId: string, forUserId?: string) {
  let userId: string;
  if (forUserId) {
    await requireAnyAuth();
    userId = forUserId;
  } else {
    const session = await requireAuth();
    userId = session.user.id;
  }

  // Check for existing active timer on ANY job for this user
  const existing = await db
    .select({ id: timeEntries.id, repairJobId: timeEntries.repairJobId })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
    .limit(1);

  if (existing.length > 0) {
    // Auto-stop the previous timer before starting new one
    await stopTimerById(existing[0].id);
  }

  const [job] = await db
    .select({ status: repairJobs.status })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);

  if (!job) {
    throw new Error("Repair job not found");
  }
  if (!canStartGarageTimerOnRepair(job.status)) {
    throw new Error(GARAGE_TIMER_NOT_ALLOWED);
  }

  const [entry] = await db
    .insert(timeEntries)
    .values({
      repairJobId,
      userId,
      startedAt: new Date(),
      source: "garage_timer",
    })
    .returning({ id: timeEntries.id });

  safeRevalidate(`/garage/repairs/${repairJobId}`);
  safeRevalidate(`/repairs/${repairJobId}`);
  safeRevalidate("/garage");
  return { id: entry.id };
}

/** Stop a timer by ID */
async function stopTimerById(timeEntryId: string) {
  const [entry] = await db
    .select({ startedAt: timeEntries.startedAt, repairJobId: timeEntries.repairJobId })
    .from(timeEntries)
    .where(eq(timeEntries.id, timeEntryId));

  if (!entry) return;

  const now = new Date();
  const rawMinutes = Math.round(
    (now.getTime() - new Date(entry.startedAt).getTime()) / 60000
  );
  const rounded = roundToQuarter(rawMinutes);

  await db
    .update(timeEntries)
    .set({
      endedAt: now,
      durationMinutes: rawMinutes,
      roundedMinutes: rounded,
      updatedAt: now,
    })
    .where(eq(timeEntries.id, timeEntryId));
}

/** Stop the current user's active timer (public action) */
export async function stopTimer(repairJobId: string, forUserId?: string) {
  let userId: string;
  if (forUserId) {
    await requireAnyAuth();
    userId = forUserId;
  } else {
    const session = await requireAuth();
    userId = session.user.id;
  }

  const [active] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.repairJobId, repairJobId),
        eq(timeEntries.userId, userId),
        isNull(timeEntries.endedAt)
      )
    )
    .limit(1);

  if (active) {
    await stopTimerById(active.id);
  }

  safeRevalidate(`/garage/repairs/${repairJobId}`);
  safeRevalidate(`/repairs/${repairJobId}`);
  safeRevalidate("/garage");
  return { success: true };
}

// ─── Query ───────────────────────────────────────────────────────────────────

/** Get the current user's active timer (if any) */
export async function getMyActiveTimer() {
  const session = await requireAuth();

  const [active] = await db
    .select({
      id: timeEntries.id,
      repairJobId: timeEntries.repairJobId,
      startedAt: timeEntries.startedAt,
      publicCode: repairJobs.publicCode,
    })
    .from(timeEntries)
    .leftJoin(repairJobs, eq(timeEntries.repairJobId, repairJobs.id))
    .where(
      and(eq(timeEntries.userId, session.user.id), isNull(timeEntries.endedAt))
    )
    .limit(1);

  return active ?? null;
}

/** Get all active timers for a repair job (all technicians) */
export async function getJobActiveTimers(repairJobId: string) {
  const timers = await db
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      userName: users.name,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .where(
      and(
        eq(timeEntries.repairJobId, repairJobId),
        isNull(timeEntries.endedAt)
      )
    );

  return timers;
}

/** Get all time entries for a repair job (completed + active) */
export async function getJobTimeEntries(repairJobId: string) {
  const entries = await db
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      userName: users.name,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      durationMinutes: timeEntries.durationMinutes,
      roundedMinutes: timeEntries.roundedMinutes,
      source: timeEntries.source,
      note: timeEntries.note,
    })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .where(eq(timeEntries.repairJobId, repairJobId))
    .orderBy(desc(timeEntries.startedAt));

  return entries;
}

/** Get total rounded minutes for a repair job */
export async function getJobTotalTime(repairJobId: string) {
  const [result] = await db
    .select({
      totalMinutes: sql<number>`coalesce(sum(${timeEntries.roundedMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .where(eq(timeEntries.repairJobId, repairJobId));

  return result?.totalMinutes ?? 0;
}

// ─── Manual entry (office) ──────────────────────────────────────────────────

/** Create a manual time entry */
export async function createManualTimeEntry(data: {
  repairJobId: string;
  userId: string;
  minutes: number;
  note?: string;
}) {
  await requireAuth();

  const now = new Date();
  const startedAt = new Date(now.getTime() - data.minutes * 60000);
  const rounded = roundToQuarter(data.minutes);

  await db.insert(timeEntries).values({
    repairJobId: data.repairJobId,
    userId: data.userId,
    startedAt,
    endedAt: now,
    durationMinutes: data.minutes,
    roundedMinutes: rounded,
    source: "manual",
    note: data.note,
  });

  revalidatePath(`/repairs/${data.repairJobId}`);
  revalidatePath(`/garage/repairs/${data.repairJobId}`);
}

/** Delete a time entry */
export async function deleteTimeEntry(timeEntryId: string) {
  await requireAuth();

  const [entry] = await db
    .select({ repairJobId: timeEntries.repairJobId })
    .from(timeEntries)
    .where(eq(timeEntries.id, timeEntryId));

  if (!entry) return;

  await db.delete(timeEntries).where(eq(timeEntries.id, timeEntryId));

  revalidatePath(`/repairs/${entry.repairJobId}`);
  revalidatePath(`/garage/repairs/${entry.repairJobId}`);
}

/** Get all active timers across all jobs (for today view badges) */
export async function getAllActiveTimers() {
  const timers = await db
    .select({
      id: timeEntries.id,
      repairJobId: timeEntries.repairJobId,
      userId: timeEntries.userId,
      userName: users.name,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .where(isNull(timeEntries.endedAt));

  return timers;
}
