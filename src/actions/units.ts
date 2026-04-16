"use server";

import { db } from "@/lib/db";
import { units, customers, repairJobs, unitTags, tags } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { unitSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { eq, desc, asc, ilike, or, and, count, inArray, gte, lte, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncCustomerToHolded } from "./holded";

export async function getUnits(filters: { q?: string; tagId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}) {
  await requireAuth();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  // If filtering by tag, first get matching unit IDs
  let tagUnitIds: string[] | undefined;
  if (filters.tagId) {
    const rows = await db.select({ unitId: unitTags.unitId }).from(unitTags).where(eq(unitTags.tagId, filters.tagId));
    tagUnitIds = rows.map((r) => r.unitId);
    if (tagUnitIds.length === 0) return { units: [], total: 0, page, limit };
  }

  const conditions = [];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(units.registration, term),
        ilike(units.brand, term),
        ilike(units.model, term),
        ilike(units.chassisId, term),
      )!
    );
  }
  if (tagUnitIds) {
    conditions.push(inArray(units.id, tagUnitIds));
  }

  if (filters.dateFrom) {
    conditions.push(gte(units.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(lte(units.createdAt, to));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions.length === 1 ? conditions[0] : undefined;

  const [result, countResult] = await Promise.all([
    db
      .select({
        id: units.id,
        registration: units.registration,
        brand: units.brand,
        model: units.model,
        year: units.year,
        chassisId: units.chassisId,
        length: units.length,
        storageLocation: units.storageLocation,
        storageType: units.storageType,
        currentPosition: units.currentPosition,
        nfcTag: units.nfcTag,
        customerId: units.customerId,
        customerName: customers.name,
        createdAt: units.createdAt,
        updatedAt: units.updatedAt,
      })
      .from(units)
      .leftJoin(customers, eq(units.customerId, customers.id))
      .where(where)
      .orderBy(asc(units.registration), desc(units.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(units).where(where),
  ]);

  return { units: result, total: countResult[0]?.count ?? 0, page, limit };
}

export async function getUnitById(id: string) {
  await requireAuth();
  const [unit] = await db.select().from(units).where(eq(units.id, id)).limit(1);
  if (!unit) return null;

  const [customer, jobs, unitTagRows] = await Promise.all([
    unit.customerId
      ? db.select().from(customers).where(eq(customers.id, unit.customerId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ id: repairJobs.id, publicCode: repairJobs.publicCode, title: repairJobs.title, status: repairJobs.status })
      .from(repairJobs)
      .where(and(eq(repairJobs.unitId, id), isNull(repairJobs.deletedAt)))
      .orderBy(desc(repairJobs.updatedAt)),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(unitTags)
      .innerJoin(tags, eq(unitTags.tagId, tags.id))
      .where(eq(unitTags.unitId, id)),
  ]);

  return { ...unit, customer: customer[0] ?? null, repairJobs: jobs, tags: unitTagRows };
}

export async function createUnit(data: unknown) {
  await requireRole("staff");
  const parsed = unitSchema.parse(data);

  const [unit] = await db.insert(units).values(parsed).returning();
  await createAuditLog("create", "unit", unit.id);
  revalidatePath("/units");
  return unit;
}

/** Same as createUnit but without revalidatePath — for inline creation inside dialogs */
export async function createUnitInline(data: unknown) {
  await requireRole("staff");
  const parsed = unitSchema.parse(data);

  const [unit] = await db.insert(units).values(parsed).returning();
  await createAuditLog("create", "unit", unit.id);
  return unit;
}

export async function updateUnit(id: string, data: unknown) {
  await requireRole("staff");
  const parsed = unitSchema.parse(data);

  const [updated] = await db
    .update(units)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(units.id, id))
    .returning();

  await createAuditLog("update", "unit", id);
  revalidatePath("/units");
  revalidatePath(`/units/${id}`);

  // Sync unit custom fields back to Holded via the customer
  if (updated?.customerId) {
    syncCustomerToHolded(updated.customerId).catch(() => {});
  }

  return updated;
}

export async function getAllUnits() {
  await requireAuth();
  return db
    .select({
      id: units.id,
      registration: units.registration,
      brand: units.brand,
      model: units.model,
      year: units.year,
      customerId: units.customerId,
    })
    .from(units)
    .orderBy(asc(units.registration));
}
