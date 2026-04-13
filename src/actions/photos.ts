"use server";

import { db } from "@/lib/db";
import { repairPhotos } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { eq, and } from "drizzle-orm";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export async function getRepairPhotos(repairJobId: string) {
  await requireAuth();
  return db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.repairJobId, repairJobId))
    .orderBy(repairPhotos.createdAt);
}

export async function getTaskPhotos(repairTaskId: string) {
  await requireAuth();
  return db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.repairTaskId, repairTaskId))
    .orderBy(repairPhotos.createdAt);
}

export async function deleteRepairPhoto(photoId: string) {
  await requireRole("staff");

  const [photo] = await db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.id, photoId));

  if (!photo) throw new Error("Photo not found");

  // Delete from Vercel Blob storage
  try {
    await del(photo.url);
  } catch {
    // Blob may already be deleted, continue with DB cleanup
  }

  await db.delete(repairPhotos).where(eq(repairPhotos.id, photoId));

  revalidatePath(`/repairs/${photo.repairJobId}`);
  revalidatePath(`/garage/repairs/${photo.repairJobId}`);
}
