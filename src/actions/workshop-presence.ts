"use server";

import { db } from "@/lib/db";
import { timeEntries, users, repairJobs, units, customers } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";

export type WorkshopPresenceRow = {
  timerId: string;
  repairJobId: string;
  publicCode: string | null;
  title: string | null;
  registration: string | null;
  customerName: string | null;
  userId: string | null;
  userName: string | null;
  startedAt: Date;
};

/**
 * Live "who is on which job right now" view for the office dashboard.
 * Joins running time entries with repair + unit + customer + user so
 * the widget renders in one query.
 *
 * Auth: admin-only. Garage workers don't need to see the office's
 * dashboard widget; they have their own per-repair presence pill.
 */
export async function listWorkshopPresence(): Promise<WorkshopPresenceRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  const rows = await db
    .select({
      timerId: timeEntries.id,
      repairJobId: timeEntries.repairJobId,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      registration: units.registration,
      customerName: customers.name,
      userId: timeEntries.userId,
      userName: users.name,
      startedAt: timeEntries.startedAt,
    })
    .from(timeEntries)
    .leftJoin(users, eq(timeEntries.userId, users.id))
    .leftJoin(repairJobs, eq(timeEntries.repairJobId, repairJobs.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(isNull(timeEntries.endedAt));

  return rows.map((r): WorkshopPresenceRow => ({
    timerId: r.timerId,
    repairJobId: r.repairJobId,
    publicCode: r.publicCode,
    title: r.title,
    registration: r.registration ?? null,
    customerName: r.customerName ?? null,
    userId: r.userId,
    userName: r.userName ?? null,
    startedAt: r.startedAt as Date,
  }));
}
