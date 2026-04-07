"use server";

import { db } from "@/lib/db";
import { tags } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
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
