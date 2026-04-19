"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  toolRequests,
  voiceNotes,
  repairJobs,
  customers,
  units,
  users,
} from "@/lib/db/schema";
import { requireAnyAuth } from "@/lib/garage-auth";
import { auth } from "@/lib/auth";

/**
 * Tool requests are short, free-text "we need this in the workshop" notes
 * the iPad fires off to the office. Kept deliberately minimal: one body
 * field, optional repair link, three states. The office acts on them in
 * an admin inbox.
 */

export type ToolRequestStatus = "open" | "resolved" | "cancelled";

export type ToolRequestRow = {
  id: string;
  description: string;
  status: ToolRequestStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  requestedByName: string | null;
  resolvedByName: string | null;
  repairJob: {
    id: string;
    publicCode: string | null;
    title: string | null;
    customerName: string | null;
    unitRegistration: string | null;
  } | null;
  voiceNote: {
    id: string;
    url: string;
    durationSeconds: number;
  } | null;
};

/**
 * Garage iPad creates a new request. We return the row id so the caller
 * can immediately attach a voice note via /api/garage/voice-notes/upload.
 */
export async function createToolRequest(input: {
  description: string;
  repairJobId?: string | null;
  requestedByUserId?: string | null;
  requestedByLabel?: string | null;
}) {
  const ctx = await requireAnyAuth();
  const description = input.description.trim();
  if (!description) {
    throw new Error("Description is required");
  }

  const [row] = await db
    .insert(toolRequests)
    .values({
      description,
      repairJobId: input.repairJobId ?? null,
      requestedByUserId: input.requestedByUserId ?? ctx.userId ?? null,
      requestedByLabel: input.requestedByLabel ?? ctx.userName ?? null,
    })
    .returning({ id: toolRequests.id });

  try {
    revalidatePath("/dashboard");
    revalidatePath("/repairs");
  } catch {
    // best-effort
  }
  return { id: row.id };
}

/**
 * Admin marks a request as fixed.
 */
export async function resolveToolRequest(input: {
  id: string;
  resolutionNote?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  await db
    .update(toolRequests)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedByUserId: session.user.id,
      resolutionNote: input.resolutionNote ?? null,
      updatedAt: new Date(),
    })
    .where(eq(toolRequests.id, input.id));
  try {
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }
}

/** Admin cancels (e.g. duplicate / not actually needed). */
export async function cancelToolRequest(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await db
    .update(toolRequests)
    .set({
      status: "cancelled",
      resolvedAt: new Date(),
      resolvedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(toolRequests.id, id));
  try {
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }
}

/** Admin un-resolves (re-opens). */
export async function reopenToolRequest(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await db
    .update(toolRequests)
    .set({
      status: "open",
      resolvedAt: null,
      resolvedByUserId: null,
      resolutionNote: null,
      updatedAt: new Date(),
    })
    .where(eq(toolRequests.id, id));
  try {
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }
}

/**
 * Admin lists requests for the inbox tile. Joins the optional repair, the
 * requester, and the (optional) voice note in a single query.
 */
export async function listToolRequests(
  status: ToolRequestStatus | "all" = "open",
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const requester = sql`requester`;
  const resolver = sql`resolver`;

  const whereStatus =
    status === "all" ? undefined : eq(toolRequests.status, status);

  const rows = await db
    .select({
      id: toolRequests.id,
      description: toolRequests.description,
      status: toolRequests.status,
      createdAt: toolRequests.createdAt,
      resolvedAt: toolRequests.resolvedAt,
      resolutionNote: toolRequests.resolutionNote,
      requestedByLabel: toolRequests.requestedByLabel,
      requestedByName: sql<string | null>`${requester}.name`,
      resolvedByName: sql<string | null>`${resolver}.name`,
      repairJobId: toolRequests.repairJobId,
      repairCode: repairJobs.publicCode,
      repairTitle: repairJobs.title,
      customerName: customers.name,
      unitRegistration: units.registration,
    })
    .from(toolRequests)
    .leftJoin(repairJobs, eq(repairJobs.id, toolRequests.repairJobId))
    .leftJoin(customers, eq(customers.id, repairJobs.customerId))
    .leftJoin(units, eq(units.id, repairJobs.unitId))
    .leftJoin(
      sql`${users} as requester`,
      sql`requester.id = ${toolRequests.requestedByUserId}`,
    )
    .leftJoin(
      sql`${users} as resolver`,
      sql`resolver.id = ${toolRequests.resolvedByUserId}`,
    )
    .where(whereStatus)
    .orderBy(desc(toolRequests.createdAt))
    .limit(100);

  // Pull voice notes for these rows in one query.
  const ids = rows.map((r) => r.id);
  const notes = ids.length
    ? await db
        .select({
          id: voiceNotes.id,
          ownerId: voiceNotes.ownerId,
          url: voiceNotes.url,
          durationSeconds: voiceNotes.durationSeconds,
        })
        .from(voiceNotes)
        .where(
          and(
            eq(voiceNotes.ownerType, "tool_request"),
            // Drizzle's `in` helper isn't imported here but eq+or would be
            // verbose; SQL `IN` keeps it simple and safe (parameterised).
            sql`${voiceNotes.ownerId} = ANY(${ids})`,
          ),
        )
    : [];
  const noteByOwner = new Map(notes.map((n) => [n.ownerId, n]));

  const result: ToolRequestRow[] = rows.map((r) => ({
    id: r.id,
    description: r.description,
    status: r.status as ToolRequestStatus,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    resolutionNote: r.resolutionNote,
    requestedByName: r.requestedByName ?? r.requestedByLabel,
    resolvedByName: r.resolvedByName,
    repairJob: r.repairJobId
      ? {
          id: r.repairJobId,
          publicCode: r.repairCode,
          title: r.repairTitle,
          customerName: r.customerName,
          unitRegistration: r.unitRegistration,
        }
      : null,
    voiceNote: noteByOwner.get(r.id)
      ? {
          id: noteByOwner.get(r.id)!.id,
          url: noteByOwner.get(r.id)!.url,
          durationSeconds: noteByOwner.get(r.id)!.durationSeconds,
        }
      : null,
  }));

  return result;
}

/** Lightweight count for dashboard badge / poll. */
export async function countOpenToolRequests(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(toolRequests)
    .where(and(eq(toolRequests.status, "open"), isNull(toolRequests.resolvedAt)));
  return row?.n ?? 0;
}
