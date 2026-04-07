"use server";

import { db } from "@/lib/db";
import { locations } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { locationSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { slugify } from "@/lib/utils";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getLocations() {
  await requireAuth();
  return db.select().from(locations).orderBy(asc(locations.sortOrder), asc(locations.name));
}

export async function createLocation(data: unknown) {
  await requireRole("admin");
  const parsed = locationSchema.parse(data);

  const [location] = await db
    .insert(locations)
    .values({
      name: parsed.name,
      slug: slugify(parsed.name),
      description: parsed.description,
      active: parsed.active ?? true,
      sortOrder: parsed.sortOrder ?? 0,
    })
    .returning();

  await createAuditLog("create", "location", location.id, { name: location.name });
  revalidatePath("/settings/locations");
  return location;
}

export async function updateLocation(id: string, data: unknown) {
  await requireRole("admin");
  const parsed = locationSchema.parse(data);

  const [updated] = await db
    .update(locations)
    .set({
      name: parsed.name,
      slug: slugify(parsed.name),
      description: parsed.description,
      active: parsed.active,
      sortOrder: parsed.sortOrder,
      updatedAt: new Date(),
    })
    .where(eq(locations.id, id))
    .returning();

  await createAuditLog("update", "location", id);
  revalidatePath("/settings/locations");
  return updated;
}
