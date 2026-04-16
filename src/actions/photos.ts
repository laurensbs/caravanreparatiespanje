"use server";

import { db } from "@/lib/db";
import { repairPhotos, repairJobs, customers, units } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildRepairFolderPath, getRepairFolderUrl } from "@/lib/onedrive";

export async function getRepairPhotos(repairJobId: string) {
  await requireAuth();
  const rows = await db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.repairJobId, repairJobId))
    .orderBy(repairPhotos.createdAt);

  // Ensure all photos with a onedriveItemId use the proxy URL
  return rows.map((p) => {
    if (p.onedriveItemId && !p.url.startsWith("/api/photos/")) {
      return { ...p, url: `/api/photos/${p.id}`, thumbnailUrl: `/api/photos/${p.id}` };
    }
    return p;
  });
}

export async function getTaskPhotos(repairTaskId: string) {
  await requireAuth();
  const rows = await db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.repairTaskId, repairTaskId))
    .orderBy(repairPhotos.createdAt);

  return rows.map((p) => {
    if (p.onedriveItemId && !p.url.startsWith("/api/photos/")) {
      return { ...p, url: `/api/photos/${p.id}`, thumbnailUrl: `/api/photos/${p.id}` };
    }
    return p;
  });
}

/** Get the OneDrive folder URL for a repair job */
export async function getRepairOneDriveFolderUrl(repairJobId: string): Promise<string | null> {
  await requireAuth();

  // First check if any photo already has the folder URL cached
  const [existing] = await db
    .select({ onedriveFolderUrl: repairPhotos.onedriveFolderUrl })
    .from(repairPhotos)
    .where(eq(repairPhotos.repairJobId, repairJobId))
    .limit(1);

  if (existing?.onedriveFolderUrl) return existing.onedriveFolderUrl;

  // Otherwise, construct the path and check OneDrive
  const [job] = await db
    .select({
      publicCode: repairJobs.publicCode,
      customerName: customers.name,
      unitRegistration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(eq(repairJobs.id, repairJobId));

  if (!job) return null;

  const folderPath = buildRepairFolderPath({
    customerName: job.customerName,
    unitRegistration: job.unitRegistration,
    repairCode: job.publicCode,
  });

  return getRepairFolderUrl(folderPath);
}

export async function deleteRepairPhoto(photoId: string) {
  await requireRole("staff");

  const [photo] = await db
    .select()
    .from(repairPhotos)
    .where(eq(repairPhotos.id, photoId));

  if (!photo) throw new Error("Photo not found");

  // Remove from database only — keep file in OneDrive for archiving
  await db.delete(repairPhotos).where(eq(repairPhotos.id, photoId));

  revalidatePath(`/repairs/${photo.repairJobId}`);
  revalidatePath(`/garage/repairs/${photo.repairJobId}`);
}
