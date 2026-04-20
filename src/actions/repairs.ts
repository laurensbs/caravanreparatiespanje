"use server";

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, repairJobTags, repairTasks, customers, units, locations, users, tags } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { repairJobSchema, bulkUpdateSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { autoGenerateReminder } from "./reminders";
import { clearGarageAttention } from "./garage-sync";
import { syncCustomerToHolded } from "./holded";
import { SCHEDULE_NEEDS_TASKS_ADMIN_TOAST } from "./planning";
import { generatePublicCode } from "@/lib/utils";
import { repairJobHasTasks } from "@/lib/repair-has-tasks";
import { eq, desc, asc, ilike, or, and, sql, count, inArray, notInArray, isNull, isNotNull, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type RepairJobRow = InferSelectModel<typeof repairJobs>;

export type UpdateRepairJobResult =
  | { ok: true; job: RepairJobRow }
  | {
      ok: false;
      code: "validation" | "not_found" | "server_error" | "no_tasks";
      message: string;
      zodIssues?: { path: string; message: string }[];
    };

/**
 * Statusseries die de reparatie op de werkvloer zetten: "scheduled"
 * (op de planning) en "in_progress" (in de garage). Dit zijn de enige
 * transities waarvoor we taken vereisen — alle andere (bijv. blocked,
 * waiting_customer) mogen zonder taken.
 */
const WORKSHOP_STATUSES = new Set(["scheduled", "in_progress"]);

/**
 * Guard: een reparatie mag pas ingepland of naar de garage als er
 * minstens één taak op staat. Dit voorkomt dat werkers een caravan op
 * hun lijst krijgen zonder te weten wat er moet gebeuren.
 *
 * Bestaande items die al `scheduled` of `in_progress` zijn worden
 * NIET geblokkeerd — de guard vergelijkt oude met nieuwe status en
 * laat no-op transities of overgangen tussen workshop-statussen
 * ongemoeid. Pas als een reparatie een workshop-status kríjgt terwijl
 * hij die nog niet had, tellen we de taken. Zo respecteren we het
 * "sla bestaande items over"-verzoek.
 */
export async function assertRepairHasTasksForScheduling(
  repairId: string,
  nextStatus: string,
  previousStatus: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!WORKSHOP_STATUSES.has(nextStatus)) return { ok: true };
  if (WORKSHOP_STATUSES.has(previousStatus)) return { ok: true };
  if (await repairJobHasTasks(repairId)) return { ok: true };
  return {
    ok: false,
    message: SCHEDULE_NEEDS_TASKS_ADMIN_TOAST,
  };
}

/** Columns the panel may patch via `updateRepairJob` (never Holded IDs — use holded actions). */
const REPAIR_JOB_PATCH_KEYS = [
  "publicCode",
  "locationId",
  "customerId",
  "unitId",
  "title",
  "descriptionRaw",
  "descriptionNormalized",
  "partsNeededRaw",
  "notesRaw",
  "extraNotesRaw",
  "internalComments",
  "status",
  "priority",
  "businessProcessType",
  "jobType",
  "assignedUserId",
  "estimatedCost",
  "actualCost",
  "internalCost",
  "estimatedHours",
  "actualHours",
  "invoiceStatus",
  "customerResponseStatus",
  "dueDate",
  "bayReference",
  "warrantyInternalCostFlag",
  "prepaidFlag",
  "waterDamageRiskFlag",
  "safetyFlag",
  "tyresFlag",
  "lightsFlag",
  "brakesFlag",
  "windowsFlag",
  "sealsFlag",
  "partsRequiredFlag",
  "followUpRequiredFlag",
  "customFlags",
  "nextAction",
  "currentBlocker",
] as const;

type PatchKey = (typeof REPAIR_JOB_PATCH_KEYS)[number];

function buildAllowlistedRepairUpdate(
  parsed: Partial<Record<PatchKey, unknown>> & { dueDate?: string | null },
  existing: RepairJobRow
): Record<string, unknown> {
  const set: Record<string, unknown> = { updatedAt: new Date() };

  for (const key of REPAIR_JOB_PATCH_KEYS) {
    if (key === "dueDate") {
      if (parsed.dueDate !== undefined) {
        set.dueDate = parsed.dueDate ? new Date(parsed.dueDate) : null;
      }
      continue;
    }
    const v = parsed[key as PatchKey];
    if (v !== undefined) {
      set[key] = v;
    }
  }

  if (parsed.status === "completed" && existing.status !== "completed") {
    set.completedAt = new Date();
  }

  return set;
}

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
  /** Quick due-window preset: 'today' | 'week' | 'overdue' | 'unscheduled' */
  dueWithin?: string;
  /** When set, restrict to jobs assigned to the given user. */
  mine?: string;
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
    // "Scheduled" betekent in dit portaal: staat echt op de planning
    // (heeft een dueDate). Items die na een goedgekeurde Holded-offerte
    // in status=scheduled belanden zonder datum, zijn technisch wel
    // `scheduled` maar nog niet geslot op de kalender; die willen we
    // niet in deze lijst. Ze verschijnen in het No-date filter tot
    // iemand er in de planning een datum aan hangt.
    if (statuses.length === 1 && statuses[0] === "scheduled") {
      conditions.push(isNotNull(repairJobs.dueDate));
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

  if (filters.dueWithin) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    if (filters.dueWithin === "today") {
      conditions.push(gte(repairJobs.dueDate, startOfToday));
      conditions.push(lte(repairJobs.dueDate, endOfToday));
    } else if (filters.dueWithin === "week") {
      const endOfWeek = new Date(startOfToday);
      endOfWeek.setDate(endOfWeek.getDate() + 7);
      conditions.push(gte(repairJobs.dueDate, startOfToday));
      conditions.push(lte(repairJobs.dueDate, endOfWeek));
    } else if (filters.dueWithin === "overdue") {
      conditions.push(lte(repairJobs.dueDate, startOfToday));
      conditions.push(isNotNull(repairJobs.dueDate));
      // Overdue is only relevant for non-finalised jobs.
      conditions.push(notInArray(repairJobs.status, ["completed", "invoiced", "archived", "rejected"]));
    } else if (filters.dueWithin === "unscheduled") {
      conditions.push(isNull(repairJobs.dueDate));
    }
  }

  if (filters.mine === "1") {
    const session = await requireAuth();
    if (session.user.id) {
      conditions.push(eq(repairJobs.assignedUserId, session.user.id));
    }
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

export async function updateRepairJob(id: string, data: unknown): Promise<UpdateRepairJobResult> {
  try {
    const session = await requireRole("staff");
    const parsedResult = repairJobSchema.safeParse(data);
    if (!parsedResult.success) {
      const zodIssues = parsedResult.error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
      }));
      const first = zodIssues[0];
      return {
        ok: false,
        code: "validation",
        message: first ? `${first.path}: ${first.message}` : "Validation failed",
        zodIssues,
      };
    }
    const parsed = parsedResult.data;

    const [existing] = await db
      .select()
      .from(repairJobs)
      .where(eq(repairJobs.id, id))
      .limit(1);

    if (!existing) {
      return { ok: false, code: "not_found", message: "Job not found" };
    }

    // Blokkeer overgang naar 'scheduled' of 'in_progress' zonder taken.
    // Bestaande items die al in die status staan mogen wel worden
    // bijgewerkt (volgens user: "sla bestaande items over").
    if (parsed.status !== undefined && parsed.status !== existing.status) {
      const guard = await assertRepairHasTasksForScheduling(
        id,
        parsed.status,
        existing.status,
      );
      if (!guard.ok) {
        return { ok: false, code: "no_tasks", message: guard.message };
      }
    }

    // Eerste keer een dueDate zetten (via dit patch-pad i.p.v. scheduleRepair)
    // — zelfde regel als planning: zonder taken geen datum op de kalender.
    if (parsed.dueDate !== undefined) {
      const nextDue = parsed.dueDate ? new Date(parsed.dueDate) : null;
      const hadDueDate = existing.dueDate != null;
      const willHaveDueDate =
        nextDue != null && !Number.isNaN(nextDue.getTime());
      if (!hadDueDate && willHaveDueDate && !(await repairJobHasTasks(id))) {
        return {
          ok: false,
          code: "no_tasks",
          message: SCHEDULE_NEEDS_TASKS_ADMIN_TOAST,
        };
      }
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const trackFields = [
      "status",
      "priority",
      "locationId",
      "assignedUserId",
      "invoiceStatus",
      "customerResponseStatus",
      "customerId",
    ] as const;
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

    const updateSet = buildAllowlistedRepairUpdate(parsed, existing);

    const [updated] = await db
      .update(repairJobs)
      .set(updateSet as typeof repairJobs.$inferInsert)
      .where(eq(repairJobs.id, id))
      .returning();

    if (!updated) {
      return { ok: false, code: "not_found", message: "Job not found after update" };
    }

    if (Object.keys(changes).length > 0) {
      await createAuditLog("update", "repair_job", id, changes);
    }

    if (changes.status || changes.customerResponseStatus) {
      await autoGenerateReminder(
        id,
        parsed.status ?? existing.status,
        parsed.customerResponseStatus ?? existing.customerResponseStatus
      );
    }

    // When this job’s client changes and a unit is linked, keep the unit’s owner in sync
    // (same rule as data-fix scripts — avoids repair on Carlos + caravan still on Naomi).
    if (
      parsed.customerId !== undefined &&
      String(existing.customerId ?? "") !== String(updated.customerId ?? "") &&
      updated.unitId &&
      updated.customerId
    ) {
      await db
        .update(units)
        .set({ customerId: updated.customerId, updatedAt: new Date() })
        .where(eq(units.id, updated.unitId));
      await createAuditLog("update", "unit", updated.unitId, {
        customerIdAlignedFromRepairJob: id,
      });
      revalidatePath(`/units/${updated.unitId}`);
      revalidatePath("/units");
      syncCustomerToHolded(updated.customerId).catch(() => {});
      // Refresh the previous client’s Holded contact (kenteken/custom fields) now that the unit moved away
      if (existing.customerId) {
        syncCustomerToHolded(existing.customerId).catch(() => {});
      }
    }

    revalidatePath("/repairs");
    revalidatePath(`/repairs/${id}`);
    revalidatePath("/");
    return { ok: true, job: updated };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return { ok: false, code: "server_error", message };
  }
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

  // Eén breed query dat alles in één scan ophaalt: per-status, urgent en
  // de date-buckets (today/week/overdue/unscheduled) die de chip-rij op
  // /repairs gebruikt. Eén round-trip i.p.v. 5 losse SELECTs scheelt
  // merkbaar bij elke pagina-laad.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const NOT_FINAL = sql`${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived', 'rejected')`;

  const [statusRows, [aggregates]] = await Promise.all([
    db
      .select({ status: repairJobs.status, count: count() })
      .from(repairJobs)
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt)))
      .groupBy(repairJobs.status),
    db
      .select({
        urgent: count(
          sql`CASE WHEN ${repairJobs.priority} = 'urgent' AND ${repairJobs.status} NOT IN ('completed', 'invoiced', 'archived') THEN 1 END`
        ),
        today: count(
          sql`CASE WHEN ${repairJobs.dueDate} >= ${startOfToday} AND ${repairJobs.dueDate} < ${endOfToday} THEN 1 END`
        ),
        week: count(
          sql`CASE WHEN ${repairJobs.dueDate} >= ${startOfToday} AND ${repairJobs.dueDate} <= ${endOfWeek} THEN 1 END`
        ),
        overdue: count(
          sql`CASE WHEN ${repairJobs.dueDate} IS NOT NULL AND ${repairJobs.dueDate} < ${startOfToday} AND ${NOT_FINAL} THEN 1 END`
        ),
        unscheduled: count(
          sql`CASE WHEN ${repairJobs.dueDate} IS NULL THEN 1 END`
        ),
      })
      .from(repairJobs)
      .where(and(isNull(repairJobs.archivedAt), isNull(repairJobs.deletedAt))),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = Number(r.count);

  return {
    byStatus,
    urgent: Number(aggregates?.urgent ?? 0),
    byDate: {
      today: Number(aggregates?.today ?? 0),
      week: Number(aggregates?.week ?? 0),
      overdue: Number(aggregates?.overdue ?? 0),
      unscheduled: Number(aggregates?.unscheduled ?? 0),
    },
  };
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

export async function bulkRestoreRepairJobs(ids: string[]) {
  await requireRole("admin");
  if (ids.length === 0) return { restored: 0 };

  await db
    .update(repairJobs)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(inArray(repairJobs.id, ids));

  for (const id of ids) {
    await createAuditLog("restore", "repair_job", id, {});
  }

  revalidatePath("/repairs");
  revalidatePath("/repairs/bin");
  revalidatePath("/");
  return { restored: ids.length };
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
        // Compare as text so SQL works before enum migration 0023 is applied on the DB.
        sql`${repairJobs.customerResponseStatus}::text <> 'reply_not_required'`,
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
      // Finalcheck expliciet op "passed" zetten zodat de garage-UI
      // (die hier op filtert in `classify`) de kaart correct onder
      // "Done" laat zien in plaats van bij "Check" te laten hangen.
      finalCheckStatus: "passed",
      finalCheckByUserId: session.user.id,
      finalCheckAt: new Date(),
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

export async function searchRepairJobsForPicker(query: string) {
  await requireAuth();
  if (!query || query.length < 2) return [];

  const searchTerm = `%${query}%`;
  const results = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      customerName: customers.name,
      unitRegistration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(
      and(
        isNull(repairJobs.deletedAt),
        or(
          ilike(repairJobs.publicCode, searchTerm),
          ilike(repairJobs.title, searchTerm),
          ilike(customers.name, searchTerm),
          ilike(units.registration, searchTerm),
        ),
      )
    )
    .orderBy(desc(repairJobs.updatedAt))
    .limit(10);

  return results;
}
