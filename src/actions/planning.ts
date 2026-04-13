"use server";

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, locations, users, units, tags, repairJobTags } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq, and, gte, lte, isNull, isNotNull, or, ilike, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const FUTURE_TAG_SLUG = "future-repair";
const FUTURE_TAG_NAME = "Future Repair";
const FUTURE_TAG_COLOR = "#f59e0b"; // amber

async function ensureFutureTag(): Promise<string> {
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, FUTURE_TAG_SLUG));
  if (existing) return existing.id;
  const [created] = await db.insert(tags).values({ name: FUTURE_TAG_NAME, slug: FUTURE_TAG_SLUG, color: FUTURE_TAG_COLOR }).returning();
  return created.id;
}

async function autoTagFutureRepair(repairId: string, dueDate: Date) {
  const isFuture = dueDate.getFullYear() > new Date().getFullYear();
  const tagId = await ensureFutureTag();
  if (isFuture) {
    await db.insert(repairJobTags).values({ repairJobId: repairId, tagId }).onConflictDoNothing();
  } else {
    await db.delete(repairJobTags).where(and(eq(repairJobTags.repairJobId, repairId), eq(repairJobTags.tagId, tagId)));
  }
}

// Statuses that indicate a repair is still "active" and can be planned
const PLANNABLE_STATUSES = [
  "new", "todo", "in_inspection", "no_damage", "quote_needed", "waiting_approval",
  "waiting_customer", "waiting_parts", "scheduled", "in_progress", "blocked",
] as const;

export interface PlannedRepair {
  id: string;
  publicCode: string | null;
  title: string | null;
  descriptionRaw: string | null;
  dueDate: Date;
  status: string;
  priority: string;
  estimatedHours: string | null;
  customerName: string | null;
  locationName: string | null;
  locationId: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  unitInfo: string | null;
}

export async function getPlannedRepairs(
  weekStart: string,
  weekEnd: string,
): Promise<PlannedRepair[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      descriptionRaw: repairJobs.descriptionRaw,
      dueDate: repairJobs.dueDate,
      status: repairJobs.status,
      priority: repairJobs.priority,
      estimatedHours: repairJobs.estimatedHours,
      customerName: customers.name,
      locationName: locations.name,
      locationId: repairJobs.locationId,
      assignedUserName: users.name,
      assignedUserId: repairJobs.assignedUserId,
      unitBrand: units.brand,
      unitModel: units.model,
      unitRegistration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .leftJoin(users, eq(repairJobs.assignedUserId, users.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(
      and(
        isNull(repairJobs.deletedAt),
        isNotNull(repairJobs.dueDate),
        gte(repairJobs.dueDate, new Date(weekStart)),
        lte(repairJobs.dueDate, new Date(weekEnd)),
      ),
    );

  return rows
    .filter((r) => r.dueDate !== null)
    .map((r) => ({
      id: r.id,
      publicCode: r.publicCode,
      title: r.title,
      descriptionRaw: r.descriptionRaw,
      dueDate: r.dueDate!,
      status: r.status,
      priority: r.priority,
      estimatedHours: r.estimatedHours,
      customerName: r.customerName,
      locationName: r.locationName,
      locationId: r.locationId,
      assignedUserName: r.assignedUserName,
      assignedUserId: r.assignedUserId,
      unitInfo: [r.unitBrand, r.unitModel, r.unitRegistration].filter(Boolean).join(" · ") || null,
    }) as PlannedRepair);
}

export async function scheduleRepair(repairId: string, dueDate: string) {
  const session = await requireAuth();

  const [job] = await db
    .select({ id: repairJobs.id, status: repairJobs.status, dueDate: repairJobs.dueDate })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairId));

  if (!job) throw new Error("Repair not found");

  const newDueDate = new Date(dueDate);
  const updates: Record<string, unknown> = {
    dueDate: newDueDate,
    updatedAt: new Date(),
  };

  // Auto-set status to "scheduled" if in an earlier workflow stage
  const earlyStatuses = ["new", "todo", "no_damage"];
  if (earlyStatuses.includes(job.status)) {
    updates.status = "scheduled";
  }

  await db.update(repairJobs).set(updates).where(eq(repairJobs.id, repairId));

  await db.insert(repairJobEvents).values({
    repairJobId: repairId,
    eventType: "status_changed",
    fieldChanged: "dueDate",
    oldValue: job.dueDate?.toISOString() ?? "",
    newValue: newDueDate.toISOString(),
    userId: session.user.id,
    comment: `Scheduled for ${newDueDate.toISOString().slice(0, 16).replace("T", " ")}`,
  });

  // Auto-tag/untag as "Future Repair" based on year
  await autoTagFutureRepair(repairId, newDueDate);

  revalidatePath("/planning");
  revalidatePath(`/repairs/${repairId}`);
}

export async function unscheduleRepair(repairId: string) {
  const session = await requireAuth();

  const [job] = await db
    .select({ id: repairJobs.id, status: repairJobs.status, dueDate: repairJobs.dueDate })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairId));

  if (!job) throw new Error("Repair not found");

  const updates: Record<string, unknown> = { dueDate: null, updatedAt: new Date() };

  // Auto-revert status to "todo" if currently in a scheduled/in-progress state
  const revertStatuses = ["scheduled", "in_progress"];
  if (revertStatuses.includes(job.status)) {
    updates.status = "todo";
  }

  await db.update(repairJobs).set(updates).where(eq(repairJobs.id, repairId));

  await db.insert(repairJobEvents).values({
    repairJobId: repairId,
    eventType: "status_changed",
    fieldChanged: "dueDate",
    oldValue: job.dueDate?.toISOString() ?? "",
    newValue: "",
    userId: session.user.id,
    comment: "Removed from planning",
  });

  revalidatePath("/planning");
  revalidatePath(`/repairs/${repairId}`);
}

export interface SearchableRepair {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  customerName: string | null;
  locationName: string | null;
}

export async function searchUnscheduledRepairs(query: string): Promise<SearchableRepair[]> {
  await requireAuth();

  const conditions = [
    isNull(repairJobs.deletedAt),
    isNull(repairJobs.dueDate),
    inArray(repairJobs.status, [...PLANNABLE_STATUSES]),
  ];

  if (query.trim()) {
    conditions.push(
      or(
        ilike(repairJobs.title, `%${query}%`),
        ilike(repairJobs.publicCode, `%${query}%`),
        ilike(customers.name, `%${query}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: repairJobs.id,
      publicCode: repairJobs.publicCode,
      title: repairJobs.title,
      status: repairJobs.status,
      priority: repairJobs.priority,
      customerName: customers.name,
      locationName: locations.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(locations, eq(repairJobs.locationId, locations.id))
    .where(and(...conditions))
    .limit(20);

  return rows;
}

export async function getPlanningUsers() {
  await requireAuth();
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true));
}

export async function getPlanningLocations() {
  await requireAuth();
  return db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.active, true));
}
