"use server";

import { db } from "@/lib/db";
import { tags, repairJobTags, customerTags, unitTags } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils";

export async function getTags() {
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(data: { name: string; color?: string }) {
  await requireRole("manager");
  const [tag] = await db
    .insert(tags)
    .values({
      name: data.name,
      slug: slugify(data.name),
      color: data.color ?? "#6b7280",
    })
    .returning();
  revalidatePath("/settings/tags");
  return tag;
}

export async function updateTag(id: string, data: { name?: string; color?: string }) {
  await requireRole("manager");
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
    updateData.slug = slugify(data.name);
  }
  if (data.color !== undefined) updateData.color = data.color;

  await db.update(tags).set(updateData).where(eq(tags.id, id));
  revalidatePath("/settings/tags");
}

export async function deleteTag(id: string) {
  await requireRole("manager");
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/settings/tags");
}

// ── Assign / remove tags for any entity ──────────────────────────────────

export async function addTagToRepair(repairJobId: string, tagId: string) {
  await requireAuth();
  await db.insert(repairJobTags).values({ repairJobId, tagId }).onConflictDoNothing();
  revalidatePath(`/repairs/${repairJobId}`);
}

export async function removeTagFromRepair(repairJobId: string, tagId: string) {
  await requireAuth();
  await db.delete(repairJobTags).where(and(eq(repairJobTags.repairJobId, repairJobId), eq(repairJobTags.tagId, tagId)));
  revalidatePath(`/repairs/${repairJobId}`);
}

export async function getRepairTags(repairJobId: string) {
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(repairJobTags)
    .innerJoin(tags, eq(repairJobTags.tagId, tags.id))
    .where(eq(repairJobTags.repairJobId, repairJobId));
  return rows;
}

export async function addTagToCustomer(customerId: string, tagId: string) {
  await requireAuth();
  await db.insert(customerTags).values({ customerId, tagId }).onConflictDoNothing();
  revalidatePath(`/customers/${customerId}`);
}

export async function removeTagFromCustomer(customerId: string, tagId: string) {
  await requireAuth();
  await db.delete(customerTags).where(and(eq(customerTags.customerId, customerId), eq(customerTags.tagId, tagId)));
  revalidatePath(`/customers/${customerId}`);
}

export async function getCustomerTags(customerId: string) {
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(customerTags)
    .innerJoin(tags, eq(customerTags.tagId, tags.id))
    .where(eq(customerTags.customerId, customerId));
  return rows;
}

export async function addTagToUnit(unitId: string, tagId: string) {
  await requireAuth();
  await db.insert(unitTags).values({ unitId, tagId }).onConflictDoNothing();
  revalidatePath(`/units/${unitId}`);
}

export async function removeTagFromUnit(unitId: string, tagId: string) {
  await requireAuth();
  await db.delete(unitTags).where(and(eq(unitTags.unitId, unitId), eq(unitTags.tagId, tagId)));
  revalidatePath(`/units/${unitId}`);
}

export async function getUnitTags(unitId: string) {
  const rows = await db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(unitTags)
    .innerJoin(tags, eq(unitTags.tagId, tags.id))
    .where(eq(unitTags.unitId, unitId));
  return rows;
}
