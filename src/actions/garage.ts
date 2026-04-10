"use server";

import { db } from "@/lib/db";
import { repairJobs, repairTasks, repairPhotos, customers, units, users, repairJobEvents, communicationLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq, and, isNull, gte, lte, desc, asc, count, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// TODAY's REPAIRS
// ─────────────────────────────────────────────────────────────────────────────

export async function getGarageRepairsToday() {
  const session = await requireAuth();

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const jobs = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      priority: repairJobs.priority,
      dueDate: repairJobs.dueDate,
      customerName: customers.name,
      unitRegistration: units.registration,
      unitBrand: units.brand,
      unitModel: units.model,
      assignedUserName: users.name,
      finalCheckStatus: repairJobs.finalCheckStatus,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
    .where(
      and(
        isNull(repairJobs.deletedAt),
        isNull(repairJobs.archivedAt),
        gte(repairJobs.dueDate, startOfDay),
        lte(repairJobs.dueDate, endOfDay)
      )
    )
    .orderBy(asc(repairJobs.priority), asc(repairJobs.title));

  // Get task counts per job
  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length === 0) return [];

  const taskCounts = await db
    .select({
      repairJobId: repairTasks.repairJobId,
      total: count(),
      done: sql<number>`count(*) filter (where ${repairTasks.status} = 'done')`,
      problem: sql<number>`count(*) filter (where ${repairTasks.status} = 'problem')`,
    })
    .from(repairTasks)
    .groupBy(repairTasks.repairJobId);

  const countsMap = new Map(
    taskCounts.map((c) => [
      c.repairJobId,
      { total: Number(c.total), done: Number(c.done), problem: Number(c.problem) },
    ])
  );

  return jobs.map((job) => ({
    ...job,
    tasks: countsMap.get(job.id) ?? { total: 0, done: 0, problem: 0 },
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR DETAIL (for garage view)
// ─────────────────────────────────────────────────────────────────────────────

export async function getGarageRepairDetail(id: string) {
  const session = await requireAuth();

  const [job] = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      priority: repairJobs.priority,
      dueDate: repairJobs.dueDate,
      descriptionRaw: repairJobs.descriptionRaw,
      notesRaw: repairJobs.notesRaw,
      internalComments: repairJobs.internalComments,
      customerName: customers.name,
      customerId: repairJobs.customerId,
      unitRegistration: units.registration,
      unitBrand: units.brand,
      unitModel: units.model,
      unitId: repairJobs.unitId,
      assignedUserName: users.name,
      assignedUserId: repairJobs.assignedUserId,
      finalCheckStatus: repairJobs.finalCheckStatus,
      finalCheckNotes: repairJobs.finalCheckNotes,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
    .where(eq(repairJobs.id, id));

  if (!job) return null;

  const tasks = await db
    .select()
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, id))
    .orderBy(asc(repairTasks.sortOrder), asc(repairTasks.createdAt));

  const photos = await db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.repairJobId, id))
    .orderBy(desc(repairPhotos.createdAt));

  return { ...job, tasks, photos };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTaskStatus(
  taskId: string,
  status: "pending" | "in_progress" | "done" | "problem" | "review",
  problemCategory?: string,
  problemNote?: string
) {
  const session = await requireAuth();
  const userId = session.user.id;

  const [task] = await db
    .select()
    .from(repairTasks)
    .where(eq(repairTasks.id, taskId));

  if (!task) throw new Error("Task not found");

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "in_progress" && !task.startedAt) {
    updates.startedAt = new Date();
  }
  if (status === "done") {
    updates.completedAt = new Date();
    updates.completedByUserId = userId;
    updates.problemCategory = null;
    updates.problemNote = null;
  }
  if (status === "problem") {
    updates.problemCategory = problemCategory ?? "other";
    updates.problemNote = problemNote ?? null;
    updates.completedAt = null;
    updates.completedByUserId = null;
  }
  if (status === "pending") {
    updates.startedAt = null;
    updates.completedAt = null;
    updates.completedByUserId = null;
    updates.problemCategory = null;
    updates.problemNote = null;
  }

  await db.update(repairTasks).set(updates).where(eq(repairTasks.id, taskId));

  // Log event on the repair job
  await db.insert(repairJobEvents).values({
    repairJobId: task.repairJobId,
    userId,
    eventType: "task_status_changed",
    fieldChanged: "task_status",
    oldValue: task.status,
    newValue: status,
    comment: status === "problem"
      ? `Task "${task.title}" — Problem: ${problemCategory}${problemNote ? `. ${problemNote}` : ""}`
      : `Task "${task.title}" → ${status}`,
  });

  // Auto-update repair status based on task progress
  await autoUpdateRepairStatus(task.repairJobId);

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO STATUS: sync repair status based on task progress
// ─────────────────────────────────────────────────────────────────────────────

async function autoUpdateRepairStatus(repairJobId: string) {
  const tasks = await db
    .select({ status: repairTasks.status })
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId));

  if (tasks.length === 0) return;

  const allDone = tasks.every((t) => t.status === "done");
  const anyInProgress = tasks.some((t) => t.status === "in_progress");
  const anyProblem = tasks.some((t) => t.status === "problem");

  const [job] = await db
    .select({ status: repairJobs.status })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId));

  if (!job) return;

  // Only auto-update if status is in a garage-relevant state
  const garageStatuses = ["scheduled", "in_progress", "blocked"];
  if (!garageStatuses.includes(job.status) && job.status !== "completed") return;

  if (allDone && job.status !== "completed") {
    await db
      .update(repairJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        finalCheckStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(repairJobs.id, repairJobId));
  } else if (anyProblem && job.status !== "blocked") {
    await db
      .update(repairJobs)
      .set({ status: "blocked", updatedAt: new Date() })
      .where(eq(repairJobs.id, repairJobId));
  } else if (anyInProgress && job.status === "scheduled") {
    await db
      .update(repairJobs)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(repairJobs.id, repairJobId));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GARAGE COMMENT (uses communication log)
// ─────────────────────────────────────────────────────────────────────────────

export async function addGarageComment(repairJobId: string, summary: string) {
  const session = await requireAuth();

  await db.insert(communicationLogs).values({
    repairJobId,
    userId: session.user.id,
    contactMethod: "in_person",
    direction: "inbound",
    contactPerson: session.user.name ?? "Garage",
    summary,
  });

  await db
    .update(repairJobs)
    .set({ lastContactAt: new Date(), updatedAt: new Date() })
    .where(eq(repairJobs.id, repairJobId));

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUGGEST EXTRA TASK (from garage, not yet approved)
// ─────────────────────────────────────────────────────────────────────────────

export async function suggestExtraTask(
  repairJobId: string,
  title: string,
  description?: string,
  priority?: string
) {
  const session = await requireAuth();

  // Get max sort order
  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(${repairTasks.sortOrder}), 0)` })
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId));

  const [task] = await db
    .insert(repairTasks)
    .values({
      repairJobId,
      title,
      description: description ?? null,
      source: "garage",
      sortOrder: (maxSort?.max ?? 0) + 1,
    })
    .returning();

  // Log event
  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "task_suggested",
    comment: `Garage suggested: "${title}"${description ? ` — ${description}` : ""}`,
  });

  return task;
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CHECK
// ─────────────────────────────────────────────────────────────────────────────

export async function completeFinalCheck(repairJobId: string, notes?: string) {
  const session = await requireAuth();

  await db
    .update(repairJobs)
    .set({
      finalCheckStatus: "passed",
      finalCheckByUserId: session.user.id,
      finalCheckAt: new Date(),
      finalCheckNotes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "final_check_passed",
    comment: notes ? `Final check passed. ${notes}` : "Final check passed.",
  });

  return { success: true };
}

export async function failFinalCheck(repairJobId: string, notes: string) {
  const session = await requireAuth();

  await db
    .update(repairJobs)
    .set({
      finalCheckStatus: "failed",
      finalCheckByUserId: session.user.id,
      finalCheckAt: new Date(),
      finalCheckNotes: notes,
      status: "in_progress",
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  // Reset all "done" tasks back to "review" so garage re-checks
  await db
    .update(repairTasks)
    .set({ status: "review", updatedAt: new Date() })
    .where(
      and(
        eq(repairTasks.repairJobId, repairJobId),
        eq(repairTasks.status, "done")
      )
    );

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "final_check_failed",
    comment: `Final check failed: ${notes}`,
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK MANAGEMENT (from office)
// ─────────────────────────────────────────────────────────────────────────────

export async function addRepairTask(
  repairJobId: string,
  data: {
    title: string;
    titleEs?: string;
    titleNl?: string;
    description?: string;
  }
) {
  const session = await requireAuth();

  const [maxSort] = await db
    .select({ max: sql<number>`coalesce(max(${repairTasks.sortOrder}), 0)` })
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId));

  const [task] = await db
    .insert(repairTasks)
    .values({
      repairJobId,
      title: data.title,
      titleEs: data.titleEs ?? null,
      titleNl: data.titleNl ?? null,
      description: data.description ?? null,
      source: "office",
      sortOrder: (maxSort?.max ?? 0) + 1,
      approvedAt: new Date(),
    })
    .returning();

  return task;
}

export async function deleteRepairTask(taskId: string) {
  const session = await requireAuth();

  const [task] = await db
    .select({ repairJobId: repairTasks.repairJobId, title: repairTasks.title })
    .from(repairTasks)
    .where(eq(repairTasks.id, taskId));

  if (!task) throw new Error("Task not found");

  await db.delete(repairTasks).where(eq(repairTasks.id, taskId));

  await db.insert(repairJobEvents).values({
    repairJobId: task.repairJobId,
    userId: session.user.id,
    eventType: "task_deleted",
    comment: `Task removed: "${task.title}"`,
  });

  return { success: true };
}

export async function approveGarageTask(taskId: string) {
  const session = await requireAuth();

  await db
    .update(repairTasks)
    .set({
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(repairTasks.id, taskId));

  return { success: true };
}

export async function getRepairTasks(repairJobId: string) {
  return db
    .select()
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId))
    .orderBy(asc(repairTasks.sortOrder), asc(repairTasks.createdAt));
}
