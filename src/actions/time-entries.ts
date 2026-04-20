"use server";

import { db } from "@/lib/db";
import { timeEntries, users, repairJobs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import { canStartGarageTimerOnRepair, GARAGE_TIMER_NOT_ALLOWED } from "@/lib/garage-timer-policy";
import { repairJobHasTasks } from "@/lib/repair-has-tasks";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Foutcode die de garage-UI herkent om een vriendelijke toast te tonen
 * wanneer een werker een timer probeert te starten op een reparatie
 * zonder taken. Export zodat client-components kunnen matchen op string.
 */
export const GARAGE_TIMER_NO_TASKS = "GARAGE_TIMER_NO_TASKS";

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

/** Afronden naar dichtstbijzijnde kwartier voor facturatie.
 *  Voorbeelden:
 *    3  → 0  (dichter bij 0 dan bij 15)
 *    8  → 15 (dichter bij 15 dan bij 0)
 *    32 → 30
 *    37 → 45
 *    45 → 45
 *  Bewust `Math.round` (= banker's neutral) i.p.v. ceiling: een werker
 *  die 32 min werkt krijgt 30m geregistreerd, niet 45m. */
function roundToQuarter(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.round(minutes / 15) * 15;
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
  // Auto-promote klus naar `in_progress` zodra iemand een timer start vanaf
  // een "klaar om te beginnen"-status. Dit spiegelt de mentale flow van de
  // werker: "ik pak 'm op → timer aan" zonder dat ze eerst in een ander
  // menu de status moeten veranderen. Alleen wachtstatussen blokkeren
  // we nog steeds expliciet (waiting_customer, waiting_parts, blocked).
  const autoPromotableStatuses = new Set(["new", "todo", "scheduled", "in_inspection"]);
  if (!canStartGarageTimerOnRepair(job.status)) {
    if (autoPromotableStatuses.has(job.status)) {
      // Elke auto-promote naar `in_progress` vereist minstens één taak —
      // ook vanuit `scheduled`, anders kunnen werkers alsnog klokken op
      // een lege klus totdat iemand taken toevoegt.
      if (!(await repairJobHasTasks(repairJobId))) {
        throw new Error(GARAGE_TIMER_NO_TASKS);
      }
      await db
        .update(repairJobs)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(repairJobs.id, repairJobId));
    } else {
      throw new Error(GARAGE_TIMER_NOT_ALLOWED);
    }
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

  // Bij pauze/stop NIET afronden. We schrijven de echte minuten weg
  // in zowel `durationMinutes` als `roundedMinutes`; de
  // kwartier-afronding gebeurt pas bij "Klaar voor controle"
  // (finalizeRepairTimeRounding) zodat bv. twee sessies van 20 + 17
  // minuten samen als 37 → 45m worden geboekt, niet als 15 + 15 = 30.
  await db
    .update(timeEntries)
    .set({
      endedAt: now,
      durationMinutes: rawMinutes,
      roundedMinutes: rawMinutes,
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

/**
 * Rondt alle time-entries van een klus af op kwartiertjes — per werker
 * gecumuleerd. Wordt aangeroepen door `garageMarkDone` op het moment dat
 * de werkplaats de klus klaar meldt.
 *
 * Aanpak:
 *   1. Groepeer alle (niet-lopende) entries per userId.
 *   2. Som `durationMinutes` per werker → nearest-15m target.
 *   3. De oudste entries behouden hun echte `durationMinutes` in
 *      `roundedMinutes`; het verschil wordt op de *laatste* entry
 *      geplakt. Zo blijft de som exact gelijk aan het target en heeft
 *      geen enkele entry een negatieve waarde.
 *
 * Lopende timers (endedAt IS NULL) slaan we over — daar zit nog geen
 * definitieve tijd in. In de praktijk stopt garageMarkDone ze niet
 * automatisch; als er nog iemand loopt, past finalize dat op die
 * entry toe zodra 'ie later stopt/handmatig vastgezet wordt.
 */
export async function finalizeRepairTimeRounding(repairJobId: string): Promise<void> {
  const entries = await db
    .select({
      id: timeEntries.id,
      userId: timeEntries.userId,
      durationMinutes: timeEntries.durationMinutes,
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
    })
    .from(timeEntries)
    .where(eq(timeEntries.repairJobId, repairJobId));

  type Row = (typeof entries)[number];
  const byUser = new Map<string, Row[]>();
  for (const e of entries) {
    if (!e.endedAt) continue; // skip lopende timers
    const list = byUser.get(e.userId) ?? [];
    list.push(e);
    byUser.set(e.userId, list);
  }

  for (const [, rows] of byUser) {
    // chronologisch sorteren — laatste entry pakt het restant
    rows.sort((a, b) => {
      const ta = new Date(a.startedAt).getTime();
      const tb = new Date(b.startedAt).getTime();
      return ta - tb;
    });
    const sumRaw = rows.reduce((acc, r) => acc + (r.durationMinutes ?? 0), 0);
    if (sumRaw <= 0) continue;
    const target = Math.round(sumRaw / 15) * 15;
    // Alle entries behalve de laatste: roundedMinutes = durationMinutes
    // (hun werkelijke tijd). Laatste: target - som van overige.
    const allButLast = rows.slice(0, -1);
    const last = rows[rows.length - 1];
    const kept = allButLast.reduce((acc, r) => acc + (r.durationMinutes ?? 0), 0);
    const lastRounded = Math.max(0, target - kept);

    const now = new Date();
    for (const r of allButLast) {
      await db
        .update(timeEntries)
        .set({ roundedMinutes: r.durationMinutes ?? 0, updatedAt: now })
        .where(eq(timeEntries.id, r.id));
    }
    await db
      .update(timeEntries)
      .set({ roundedMinutes: lastRounded, updatedAt: now })
      .where(eq(timeEntries.id, last.id));
  }
}

/** Get total actual minutes for a repair job — niet afgerond, want we
 *  gebruiken dit tijdens het werk (garage-overview / detail-hero) waar
 *  kwartaalafronding verwarrend is (een sessie van 3 min zou
 *  anders als "15m" verschijnen). Afronding hoort pas bij facturatie. */
export async function getJobTotalTime(repairJobId: string) {
  const [result] = await db
    .select({
      totalMinutes: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
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

  // Handmatige entry: geen sessie-afronding, de finalize-stap bij
  // "Klaar voor controle" rondt straks het totaal per werker af.
  await db.insert(timeEntries).values({
    repairJobId: data.repairJobId,
    userId: data.userId,
    startedAt,
    endedAt: now,
    durationMinutes: data.minutes,
    roundedMinutes: data.minutes,
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
