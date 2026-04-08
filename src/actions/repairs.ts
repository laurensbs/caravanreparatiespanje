"use server";

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units, locations, users } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { repairJobSchema, bulkUpdateSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { autoGenerateReminder } from "./reminders";
import { generatePublicCode } from "@/lib/utils";
import { eq, desc, asc, ilike, or, and, sql, count, inArray, isNull, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type RepairFilters = {
  q?: string;
  status?: string;
  locationId?: string;
  priority?: string;
  assignedUserId?: string;
  customerResponseStatus?: string;
  invoiceStatus?: string;
  archived?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
};

export async function getRepairJobs(filters: RepairFilters = {}) {
  await requireAuth();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (filters.archived !== "true") {
    conditions.push(isNull(repairJobs.archivedAt));
  }

  if (filters.status) {
    conditions.push(eq(repairJobs.status, filters.status as any));
  }

  if (filters.locationId) {
    conditions.push(eq(repairJobs.locationId, filters.locationId));
  }

  if (filters.priority) {
    conditions.push(eq(repairJobs.priority, filters.priority as any));
  }

  if (filters.assignedUserId) {
    conditions.push(eq(repairJobs.assignedUserId, filters.assignedUserId));
  }

  if (filters.customerResponseStatus) {
    conditions.push(eq(repairJobs.customerResponseStatus, filters.customerResponseStatus as any));
  }

  if (filters.invoiceStatus) {
    conditions.push(eq(repairJobs.invoiceStatus, filters.invoiceStatus as any));
  }

  if (filters.q) {
    const searchTerm = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(repairJobs.publicCode, searchTerm),
        ilike(repairJobs.title, searchTerm),
        ilike(repairJobs.descriptionRaw, searchTerm),
        ilike(repairJobs.notesRaw, searchTerm),
        ilike(repairJobs.partsNeededRaw, searchTerm),
        ilike(customers.name, searchTerm),
        ilike(units.registration, searchTerm),
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn: Record<string, any> = {
    updatedAt: repairJobs.updatedAt,
    createdAt: repairJobs.createdAt,
    status: repairJobs.status,
    priority: repairJobs.priority,
    customerName: customers.name,
    invoiceStatus: repairJobs.invoiceStatus,
  };
  const orderCol = sortColumn[filters.sort ?? ""] ?? repairJobs.updatedAt;
  const orderDir = filters.dir === "asc" ? asc : desc;

  const [jobsResult, countResult] = await Promise.all([
    db
      .select({
        id: repairJobs.id,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        priority: repairJobs.priority,
        invoiceStatus: repairJobs.invoiceStatus,
        customerResponseStatus: repairJobs.customerResponseStatus,
        archivedAt: repairJobs.archivedAt,
        createdAt: repairJobs.createdAt,
        updatedAt: repairJobs.updatedAt,
        dueDate: repairJobs.dueDate,
        locationName: locations.name,
        locationId: repairJobs.locationId,
        customerName: customers.name,
        customerId: repairJobs.customerId,
        unitRegistration: units.registration,
        unitId: repairJobs.unitId,
        assignedUserName: users.name,
        assignedUserId: repairJobs.assignedUserId,
        descriptionRaw: repairJobs.descriptionRaw,
        partsNeededRaw: repairJobs.partsNeededRaw,
        notesRaw: repairJobs.notesRaw,
      })
      .from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
      .where(where)
      .orderBy(orderDir(orderCol))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
      .where(where),
  ]);

  return {
    jobs: jobsResult,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

export async function getRepairJobById(id: string) {
  await requireAuth();

  const [job] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, id))
    .limit(1);

  if (!job) return null;

  const [jobLocation, jobCustomer, jobUnit, jobAssignedUser, jobEvents] = await Promise.all([
    job.locationId
      ? db.select().from(locations).where(eq(locations.id, job.locationId)).limit(1)
      : Promise.resolve([]),
    job.customerId
      ? db.select().from(customers).where(eq(customers.id, job.customerId)).limit(1)
      : Promise.resolve([]),
    job.unitId
      ? db.select().from(units).where(eq(units.id, job.unitId)).limit(1)
      : Promise.resolve([]),
    job.assignedUserId
      ? db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, job.assignedUserId))
          .limit(1)
      : Promise.resolve([]),
    db
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
      .where(eq(repairJobEvents.repairJobId, id))
      .orderBy(desc(repairJobEvents.createdAt)),
  ]);

  return {
    ...job,
    location: jobLocation[0] ?? null,
    customer: jobCustomer[0] ?? null,
    unit: jobUnit[0] ?? null,
    assignedUser: jobAssignedUser[0] ?? null,
    events: jobEvents,
  };
}

export async function createRepairJob(data: unknown) {
  const session = await requireRole("staff");
  const parsed = repairJobSchema.parse(data);

  const publicCode = parsed.publicCode || generatePublicCode();

  const [job] = await db
    .insert(repairJobs)
    .values({
      ...parsed,
      publicCode,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
    })
    .returning();

  await db.insert(repairJobEvents).values({
    repairJobId: job.id,
    userId: session.user.id,
    eventType: "created",
    comment: "Repair job created",
  });

  await createAuditLog("create", "repair_job", job.id, { publicCode });

  revalidatePath("/repairs");
  revalidatePath("/");
  return job;
}

export async function updateRepairJob(id: string, data: unknown) {
  const session = await requireRole("staff");
  const parsed = repairJobSchema.parse(data);

  const [existing] = await db
    .select()
    .from(repairJobs)
    .where(eq(repairJobs.id, id))
    .limit(1);

  if (!existing) throw new Error("Job not found");

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const trackFields = ["status", "priority", "locationId", "assignedUserId", "invoiceStatus", "customerResponseStatus"] as const;
  const eventValues: { repairJobId: string; userId: string; eventType: string; fieldChanged: string; oldValue: string; newValue: string }[] = [];

  for (const field of trackFields) {
    if (parsed[field] !== undefined && parsed[field] !== existing[field]) {
      changes[field] = { from: existing[field], to: parsed[field] };
      eventValues.push({
        repairJobId: id,
        userId: session.user.id,
        eventType: "field_changed",
        fieldChanged: field,
        oldValue: String(existing[field] ?? ""),
        newValue: String(parsed[field] ?? ""),
      });
    }
  }

  if (eventValues.length > 0) {
    await db.insert(repairJobEvents).values(eventValues);
  }

  const [updated] = await db
    .update(repairJobs)
    .set({
      ...parsed,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
      updatedAt: new Date(),
      completedAt:
        parsed.status === "completed" && existing.status !== "completed"
          ? new Date()
          : undefined,
    })
    .where(eq(repairJobs.id, id))
    .returning();

  if (Object.keys(changes).length > 0) {
    await createAuditLog("update", "repair_job", id, changes);
  }

  // Auto-generate reminders based on status/response changes
  if (changes.status || changes.customerResponseStatus) {
    await autoGenerateReminder(
      id,
      parsed.status ?? existing.status,
      parsed.customerResponseStatus ?? existing.customerResponseStatus
    );
  }

  revalidatePath("/repairs");
  revalidatePath(`/repairs/${id}`);
  revalidatePath("/");
  return updated;
}

export async function bulkUpdateRepairJobs(data: unknown) {
  const session = await requireRole("manager");
  const parsed = bulkUpdateSchema.parse(data);

  const updateValues: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.status) updateValues.status = parsed.status;
  if (parsed.locationId !== undefined) updateValues.locationId = parsed.locationId;
  if (parsed.assignedUserId !== undefined) updateValues.assignedUserId = parsed.assignedUserId;
  if (parsed.priority) updateValues.priority = parsed.priority;
  if (parsed.archivedAt !== undefined) updateValues.archivedAt = parsed.archivedAt ? new Date() : null;

  await db
    .update(repairJobs)
    .set(updateValues)
    .where(inArray(repairJobs.id, parsed.ids));

  if (parsed.ids.length > 0) {
    await db.insert(repairJobEvents).values(
      parsed.ids.map((id) => ({
        repairJobId: id,
        userId: session.user.id,
        eventType: "bulk_update",
        comment: `Bulk update: ${Object.keys(updateValues).filter((k) => k !== "updatedAt").join(", ")}`,
      }))
    );
  }

  await createAuditLog("bulk_update", "repair_job", null, {
    ids: parsed.ids,
    changes: updateValues,
  });

  revalidatePath("/repairs");
  revalidatePath("/");
  return { updated: parsed.ids.length };
}

export async function getDashboardStats() {
  await requireAuth();

  const [stats, recentJobs, jobsByStatus, jobsByLocation] = await Promise.all([
    db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        open: count(
          sql`CASE WHEN ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived') AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        todo: count(
          sql`CASE WHEN ${repairJobs.status} IN ('new', 'todo') AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        inProgress: count(
          sql`CASE WHEN ${repairJobs.status} IN ('in_progress', 'in_inspection', 'scheduled') AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        waitingParts: count(
          sql`CASE WHEN ${repairJobs.status} = 'waiting_parts' AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        waitingCustomer: count(
          sql`CASE WHEN ${repairJobs.status} = 'waiting_customer' AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        completed: count(
          sql`CASE WHEN ${repairJobs.status} = 'completed' AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
        urgent: count(
          sql`CASE WHEN ${repairJobs.priority} = 'urgent' AND ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived') AND ${repairJobs.archivedAt} IS NULL THEN 1 END`
        ),
      })
      .from(repairJobs),

    db
      .select({
        id: repairJobs.id,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        priority: repairJobs.priority,
        updatedAt: repairJobs.updatedAt,
        customerName: customers.name,
        locationName: locations.name,
      })
      .from(repairJobs)
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .where(isNull(repairJobs.archivedAt))
      .orderBy(desc(repairJobs.updatedAt))
      .limit(10),

    db
      .select({
        status: repairJobs.status,
        count: count(),
      })
      .from(repairJobs)
      .where(isNull(repairJobs.archivedAt))
      .groupBy(repairJobs.status),

    db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        count: count(),
      })
      .from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .where(isNull(repairJobs.archivedAt))
      .groupBy(locations.id, locations.name),
  ]);

  return {
    stats: stats[0],
    recentJobs,
    jobsByStatus,
    jobsByLocation,
  };
}

export async function deleteRepairJob(id: string) {
  const session = await requireRole("admin");

  const [existing] = await db
    .select({ id: repairJobs.id, publicCode: repairJobs.publicCode })
    .from(repairJobs)
    .where(eq(repairJobs.id, id))
    .limit(1);

  if (!existing) throw new Error("Job not found");

  await db.delete(repairJobs).where(eq(repairJobs.id, id));

  await createAuditLog("delete", "repair_job", id, { publicCode: existing.publicCode });

  revalidatePath("/repairs");
  revalidatePath("/");
  return { deleted: true };
}

export async function getFollowUpItems() {
  await requireAuth();

  // Jobs waiting for customer response for > 3 days with no recent contact
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const overdueFollowUps = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      customerResponseStatus: repairJobs.customerResponseStatus,
      lastContactAt: repairJobs.lastContactAt,
      updatedAt: repairJobs.updatedAt,
      customerName: customers.name,
      locationName: locations.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .where(
      and(
        isNull(repairJobs.archivedAt),
        or(
          // Waiting for customer with no contact or old contact
          and(
            eq(repairJobs.customerResponseStatus, "waiting_response"),
            or(
              isNull(repairJobs.lastContactAt),
              sql`${repairJobs.lastContactAt} < ${threeDaysAgo}`
            )
          ),
          // No response status — needs follow-up
          eq(repairJobs.customerResponseStatus, "no_response"),
          // Follow-up required flag set
          eq(repairJobs.followUpRequiredFlag, true)
        )
      )
    )
    .orderBy(repairJobs.lastContactAt)
    .limit(20);

  return overdueFollowUps;
}
