"use server";

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, repairJobTags, repairTasks, customers, units, locations, users, tags } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { repairJobSchema, bulkUpdateSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { autoGenerateReminder } from "./reminders";
import { clearGarageAttention } from "./garage-sync";
import { generatePublicCode } from "@/lib/utils";
import { eq, desc, asc, ilike, or, and, sql, count, inArray, isNull, isNotNull, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type RepairFilters = {
  q?: string;
  status?: string;
  locationId?: string;
  priority?: string;
  assignedUserId?: string;
  customerResponseStatus?: string;
  invoiceStatus?: string;
  tagId?: string;
  jobType?: string;
  archived?: string;
  dateFrom?: string;
  dateTo?: string;
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

  // Always exclude soft-deleted repairs from the main list
  conditions.push(isNull(repairJobs.deletedAt));

  if (filters.archived !== "true") {
    conditions.push(isNull(repairJobs.archivedAt));
  }

  if (filters.status) {
    const statuses = filters.status.split(",").filter(Boolean);
    if (statuses.length === 1) {
      conditions.push(eq(repairJobs.status, statuses[0] as any));
    } else if (statuses.length > 1) {
      conditions.push(inArray(repairJobs.status, statuses as any));
    }
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
    if (filters.invoiceStatus === "overdue") {
      // Overdue = sent but not paid, invoice date > 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      conditions.push(eq(repairJobs.invoiceStatus, "sent"));
      conditions.push(isNotNull(repairJobs.holdedInvoiceDate));
      conditions.push(lte(repairJobs.holdedInvoiceDate, thirtyDaysAgo));
    } else {
      const invoiceStatuses = filters.invoiceStatus.split(",").filter(Boolean);
      if (invoiceStatuses.length === 1) {
        conditions.push(eq(repairJobs.invoiceStatus, invoiceStatuses[0] as any));
      } else if (invoiceStatuses.length > 1) {
        conditions.push(inArray(repairJobs.invoiceStatus, invoiceStatuses as any));
      }
    }
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

  // Tag filter: get repair IDs with that tag, then filter
  if (filters.tagId) {
    const tagRows = await db.select({ repairJobId: repairJobTags.repairJobId }).from(repairJobTags).where(eq(repairJobTags.tagId, filters.tagId));
    const ids = tagRows.map((r) => r.repairJobId);
    if (ids.length === 0) return { jobs: [], total: 0, page, limit };
    conditions.push(inArray(repairJobs.id, ids));
  }

  if (filters.dateFrom) {
    conditions.push(gte(repairJobs.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(lte(repairJobs.createdAt, to));
  }

  if (filters.jobType) {
    conditions.push(eq(repairJobs.jobType, filters.jobType as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn: Record<string, any> = {
    updatedAt: repairJobs.updatedAt,
    createdAt: repairJobs.createdAt,
    status: repairJobs.status,
    priority: repairJobs.priority,
    customerName: customers.name,
    invoiceStatus: repairJobs.invoiceStatus,
    dueDate: repairJobs.dueDate,
  };
  const orderCol = sortColumn[filters.sort ?? ""] ?? repairJobs.updatedAt;
  const orderDir = filters.dir === "asc" ? asc : desc;

  // Push completed/invoiced repairs to the bottom of the list
  const completedLast = sql`CASE WHEN ${repairJobs.status} IN ('completed', 'invoiced') THEN 1 ELSE 0 END`;

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
        warrantyInternalCostFlag: repairJobs.warrantyInternalCostFlag,
        internalCost: repairJobs.internalCost,
        jobType: repairJobs.jobType,
        holdedInvoiceId: repairJobs.holdedInvoiceId,
        holdedInvoiceNum: repairJobs.holdedInvoiceNum,
        holdedQuoteId: repairJobs.holdedQuoteId,
        holdedQuoteNum: repairJobs.holdedQuoteNum,
        garageNeedsAdminAttention: repairJobs.garageNeedsAdminAttention,
        garageUnreadUpdatesCount: repairJobs.garageUnreadUpdatesCount,
        garageLastUpdateType: repairJobs.garageLastUpdateType,
      })
      .from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
      .where(where)
      .orderBy(asc(completedLast), orderDir(orderCol))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .leftJoin(customers, eq(repairJobs.customerId, customers.id))
      .leftJoin(units, eq(repairJobs.unitId, units.id))
      .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
      .where(where),
  ]);

  // Fetch tags for jobs in one query
  const jobIds = jobsResult.map((j) => j.id);
  const jobTagRows = jobIds.length > 0
    ? await db
        .select({
          repairJobId: repairJobTags.repairJobId,
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
        })
        .from(repairJobTags)
        .innerJoin(tags, eq(repairJobTags.tagId, tags.id))
        .where(inArray(repairJobTags.repairJobId, jobIds))
    : [];

  const tagsByJob = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of jobTagRows) {
    if (!tagsByJob.has(row.repairJobId)) tagsByJob.set(row.repairJobId, []);
    tagsByJob.get(row.repairJobId)!.push({ id: row.tagId, name: row.tagName, color: row.tagColor });
  }

  return {
    jobs: jobsResult.map((j) => ({ ...j, tags: tagsByJob.get(j.id) ?? [] })),
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

export async function getCustomerRepairs(customerId: string, excludeRepairId: string) {
  await requireAuth();
  return db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      createdAt: repairJobs.createdAt,
      completedAt: repairJobs.completedAt,
    })
    .from(repairJobs)
    .where(
      and(
        eq(repairJobs.customerId, customerId),
        isNull(repairJobs.deletedAt),
        sql`${repairJobs.id} != ${excludeRepairId}`
      )
    )
    .orderBy(desc(repairJobs.updatedAt))
    .limit(20);
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

  // Auto-create task checklist for wax jobs
  if (parsed.jobType === "wax") {
    const waxTasks = [
      "Pre-clean / inspect",
      "Wash caravan",
      "Dry caravan",
      "Apply wax",
      "Buff / polish",
      "Final inspection",
    ];
    await db.insert(repairTasks).values(
      waxTasks.map((title, i) => ({
        repairJobId: job.id,
        title,
        source: "office" as const,
        sortOrder: i + 1,
      }))
    );
  }

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

export async function getRepairStatusCounts() {
  await requireAuth();
  const rows = await db
    .select({ status: repairJobs.status, count: count() })
    .from(repairJobs)
    .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt)))
    .groupBy(repairJobs.status);
  const urgentRow = await db
    .select({ count: count() })
    .from(repairJobs)
    .where(and(
      isNull(repairJobs.archivedAt),
      isNull(repairJobs.deletedAt),
      sql`${repairJobs.priority} = 'urgent'`,
      sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
    ));
  const map: Record<string, number> = {};
  for (const r of rows) map[r.status] = Number(r.count);
  return { byStatus: map, urgent: Number(urgentRow[0]?.count ?? 0) };
}

export async function getDashboardStats() {
  await requireAuth();

  const [stats, recentJobs, jobsByStatus, jobsByLocation, pipelineJobs] = await Promise.all([
    db
      .select({
        total: count(),
        active: count(
          sql`CASE WHEN ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        open: count(
          sql`CASE WHEN ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived') AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        todo: count(
          sql`CASE WHEN ${repairJobs.status} IN ('new', 'todo') AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        inProgress: count(
          sql`CASE WHEN ${repairJobs.status} IN ('in_progress', 'in_inspection', 'scheduled') AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        waitingParts: count(
          sql`CASE WHEN ${repairJobs.status} = 'waiting_parts' AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        waitingCustomer: count(
          sql`CASE WHEN ${repairJobs.status} = 'waiting_customer' AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        completed: count(
          sql`CASE WHEN ${repairJobs.status} = 'completed' AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        readyForCheck: count(
          sql`CASE WHEN ${repairJobs.status} = 'ready_for_check' AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
        ),
        urgent: count(
          sql`CASE WHEN ${repairJobs.priority} = 'urgent' AND ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived') AND ${repairJobs.archivedAt} IS NULL AND ${repairJobs.deletedAt} IS NULL THEN 1 END`
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
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt)))
      .orderBy(desc(repairJobs.updatedAt))
      .limit(10),

    db
      .select({
        status: repairJobs.status,
        count: count(),
      })
      .from(repairJobs)
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt)))
      .groupBy(repairJobs.status),

    db
      .select({
        locationId: locations.id,
        locationName: locations.name,
        count: count(),
      })
      .from(repairJobs)
      .leftJoin(locations, eq(repairJobs.locationId, locations.id))
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt)))
      .groupBy(locations.id, locations.name),

    // Pipeline data for workflow visualization
    db
      .select({
        status: repairJobs.status,
        invoiceStatus: repairJobs.invoiceStatus,
        holdedQuoteId: repairJobs.holdedQuoteId,
        holdedInvoiceId: repairJobs.holdedInvoiceId,
      })
      .from(repairJobs)
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt))),
  ]);

  return {
    stats: stats[0],
    recentJobs,
    jobsByStatus,
    jobsByLocation,
    pipelineJobs,
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

  // Soft delete — move to bin
  await db.update(repairJobs).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(repairJobs.id, id));

  await createAuditLog("delete", "repair_job", id, { publicCode: existing.publicCode });

  revalidatePath("/repairs");
  revalidatePath("/repairs/bin");
  revalidatePath("/");
  return { deleted: true };
}

export async function bulkDeleteRepairJobs(ids: string[]) {
  await requireRole("admin");
  if (ids.length === 0) throw new Error("No IDs provided");

  // Soft delete — move to bin
  await db.update(repairJobs).set({ deletedAt: new Date(), updatedAt: new Date() }).where(inArray(repairJobs.id, ids));

  await createAuditLog("bulk_delete", "repair_job", null, { ids, count: ids.length });

  revalidatePath("/repairs");
  revalidatePath("/repairs/bin");
  revalidatePath("/");
  return { deleted: ids.length };
}

export async function getDeletedRepairJobs() {
  await requireRole("admin");

  return db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      priority: repairJobs.priority,
      invoiceStatus: repairJobs.invoiceStatus,
      deletedAt: repairJobs.deletedAt,
      createdAt: repairJobs.createdAt,
      customerName: customers.name,
      locationName: locations.name,
      unitRegistration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(isNotNull(repairJobs.deletedAt))
    .orderBy(desc(repairJobs.deletedAt));
}

export async function restoreRepairJob(id: string) {
  await requireRole("admin");

  await db.update(repairJobs).set({ deletedAt: null, updatedAt: new Date() }).where(eq(repairJobs.id, id));

  await createAuditLog("restore", "repair_job", id, {});

  revalidatePath("/repairs");
  revalidatePath("/repairs/bin");
  revalidatePath("/");
  return { restored: true };
}

export async function permanentDeleteRepairJob(id: string) {
  await requireRole("admin");

  const [existing] = await db
    .select({ id: repairJobs.id, publicCode: repairJobs.publicCode })
    .from(repairJobs)
    .where(eq(repairJobs.id, id))
    .limit(1);

  if (!existing) throw new Error("Job not found");

  await db.delete(repairJobs).where(eq(repairJobs.id, id));

  await createAuditLog("permanent_delete", "repair_job", id, { publicCode: existing.publicCode });

  revalidatePath("/repairs/bin");
  return { deleted: true };
}

export async function purgeOldDeletedRepairs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .delete(repairJobs)
    .where(
      and(
        isNotNull(repairJobs.deletedAt),
        lte(repairJobs.deletedAt, thirtyDaysAgo)
      )
    )
    .returning({ id: repairJobs.id });

  return { purged: result.length };
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
        isNull(repairJobs.deletedAt),
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

export async function getDashboardSuggestions() {
  await requireAuth();

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [
    completedNoInvoice, noEstimate, stale, unassignedUrgent, noCustomer,
    draftInvoices, waitingApproval, waitingParts, blockedRepairs,
    noResponseFollowUp, quoteNoInvoice, overdueRepairs,
    invoiceSentNotPaid, noUnit, customersNotSynced, completedRevenue,
    scheduledThisWeek,
  ] = await Promise.all([
    // Completed but not invoiced (exclude warranty)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "completed"),
          eq(repairJobs.invoiceStatus, "not_invoiced"),
          isNull(repairJobs.holdedInvoiceId),
          eq(repairJobs.warrantyInternalCostFlag, false)
        )
      ),
    // Active repairs in later stages with no cost estimate
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} IN ('in_progress', 'scheduled', 'blocked')`,
          isNull(repairJobs.estimatedCost),
          isNull(repairJobs.actualCost)
        )
      ),
    // Stale repairs — not updated in 14+ days
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          sql`${repairJobs.updatedAt} < ${twoWeeksAgo}`
        )
      ),
    // Urgent/high priority unassigned
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          sql`${repairJobs.priority} IN ('urgent', 'high')`,
          isNull(repairJobs.assignedUserId)
        )
      ),
    // Active repairs with no customer
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.archivedAt),
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          isNull(repairJobs.customerId)
        )
      ),
    // Draft invoices not yet sent
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.invoiceStatus, "draft"),
          isNotNull(repairJobs.holdedInvoiceId)
        )
      ),
    // Waiting for customer approval (quote sent)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "waiting_approval"),
          sql`${repairJobs.updatedAt} < ${threeDaysAgo}`
        )
      ),
    // Waiting for parts
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "waiting_parts")
        )
      ),
    // Blocked repairs
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "blocked")
        )
      ),
    // No response from customer for 3+ days
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          eq(repairJobs.customerResponseStatus, "no_response")
        )
      ),
    // Has quote but no invoice (completed)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "invoiced"),
          isNotNull(repairJobs.holdedQuoteId),
          isNull(repairJobs.holdedInvoiceId)
        )
      ),
    // Overdue repairs (past due date)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          sql`${repairJobs.dueDate} < NOW()`
        )
      ),
    // Invoice sent but not paid (7+ days since status changed to sent)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.invoiceStatus, "sent"),
          sql`${repairJobs.updatedAt} < ${oneWeekAgo}`
        )
      ),
    // Active repairs without a unit linked
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          isNull(repairJobs.unitId)
        )
      ),
    // Customers with active repairs not synced to Holded
    db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          isNull(customers.holdedContactId),
          sql`EXISTS (
            SELECT 1 FROM ${repairJobs}
            WHERE ${repairJobs.customerId} = ${customers.id}
            AND ${repairJobs.deletedAt} IS NULL
            AND ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')
          )`
        )
      ),
    // Total estimated revenue from completed uninvoiced repairs (exclude warranty)
    db
      .select({ total: sql<string>`COALESCE(SUM(COALESCE(${repairJobs.actualCost}, ${repairJobs.estimatedCost}, '0')::numeric), 0)` })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          eq(repairJobs.status, "completed"),
          eq(repairJobs.invoiceStatus, "not_invoiced"),
          isNull(repairJobs.holdedInvoiceId),
          eq(repairJobs.warrantyInternalCostFlag, false)
        )
      ),
    // Repairs scheduled for this week (upcoming due dates within 7 days)
    db
      .select({ count: count() })
      .from(repairJobs)
      .where(
        and(
          isNull(repairJobs.deletedAt),
          sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived')`,
          sql`${repairJobs.dueDate} >= NOW()`,
          sql`${repairJobs.dueDate} <= NOW() + INTERVAL '7 days'`
        )
      ),
  ]);

  return {
    completedNoInvoice: completedNoInvoice[0]?.count ?? 0,
    noEstimate: noEstimate[0]?.count ?? 0,
    stale: stale[0]?.count ?? 0,
    unassignedUrgent: unassignedUrgent[0]?.count ?? 0,
    noCustomer: noCustomer[0]?.count ?? 0,
    draftInvoices: draftInvoices[0]?.count ?? 0,
    waitingApproval: waitingApproval[0]?.count ?? 0,
    waitingParts: waitingParts[0]?.count ?? 0,
    blockedRepairs: blockedRepairs[0]?.count ?? 0,
    noResponseFollowUp: noResponseFollowUp[0]?.count ?? 0,
    quoteNoInvoice: quoteNoInvoice[0]?.count ?? 0,
    overdueRepairs: overdueRepairs[0]?.count ?? 0,
    invoiceSentNotPaid: invoiceSentNotPaid[0]?.count ?? 0,
    noUnit: noUnit[0]?.count ?? 0,
    customersNotSynced: customersNotSynced[0]?.count ?? 0,
    completedRevenue: parseFloat(completedRevenue[0]?.total ?? "0"),
    scheduledThisWeek: scheduledThisWeek[0]?.count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REVIEW: approve or send back "ready for check" repairs
// ─────────────────────────────────────────────────────────────────────────────

export async function adminApproveRepair(repairJobId: string) {
  const session = await requireAuth();

  await db
    .update(repairJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "status_changed",
    fieldChanged: "status",
    newValue: "completed",
    comment: `Approved and completed by ${session.user.name ?? "admin"}`,
  });

  await clearGarageAttention(repairJobId);

  revalidatePath("/");
  revalidatePath(`/repairs/${repairJobId}`);
  return { success: true };
}

export async function adminSendBackRepair(repairJobId: string, note?: string) {
  const session = await requireAuth();

  await db
    .update(repairJobs)
    .set({
      status: "in_progress",
      completedAt: null,
      finalCheckStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    userId: session.user.id,
    eventType: "status_changed",
    fieldChanged: "status",
    newValue: "in_progress",
    comment: note
      ? `Sent back to garage by ${session.user.name ?? "admin"}: ${note}`
      : `Sent back to garage by ${session.user.name ?? "admin"}`,
  });

  await clearGarageAttention(repairJobId);

  revalidatePath("/");
  revalidatePath(`/repairs/${repairJobId}`);
  return { success: true };
}
