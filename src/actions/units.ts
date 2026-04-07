"use server";

import { db } from "@/lib/db";
import { units, customers, repairJobs } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { unitSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { eq, desc, ilike, or, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getUnits(filters: { q?: string; page?: number; limit?: number } = {}) {
  await requireAuth();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

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

  const where = conditions.length > 0 ? conditions[0] : undefined;

  const [result, countResult] = await Promise.all([
    db
      .select({
        id: units.id,
        registration: units.registration,
        brand: units.brand,
        model: units.model,
        year: units.year,
        chassisId: units.chassisId,
        customerId: units.customerId,
        customerName: customers.name,
        createdAt: units.createdAt,
        updatedAt: units.updatedAt,
      })
      .from(units)
      .leftJoin(customers, eq(units.customerId, customers.id))
      .where(where)
      .orderBy(desc(units.updatedAt))
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

  const [customer, jobs] = await Promise.all([
    unit.customerId
      ? db.select().from(customers).where(eq(customers.id, unit.customerId)).limit(1)
      : Promise.resolve([]),
    db
      .select({ id: repairJobs.id, publicCode: repairJobs.publicCode, title: repairJobs.title, status: repairJobs.status })
      .from(repairJobs)
      .where(eq(repairJobs.unitId, id))
      .orderBy(desc(repairJobs.updatedAt)),
  ]);

  return { ...unit, customer: customer[0] ?? null, repairJobs: jobs };
}

export async function createUnit(data: unknown) {
  await requireRole("staff");
  const parsed = unitSchema.parse(data);

  const [unit] = await db.insert(units).values(parsed).returning();
  await createAuditLog("create", "unit", unit.id);
  revalidatePath("/units");
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
  return updated;
}
