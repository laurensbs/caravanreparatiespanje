import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { repairPhotos, repairJobs, customers, units } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAnyAuth } from "@/lib/garage-auth";
import { uploadFile, buildRepairFolderPath } from "@/lib/onedrive";

export async function POST(request: NextRequest) {
  const ctx = await requireAnyAuth();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const repairJobId = formData.get("repairJobId") as string | null;
  const repairTaskId = formData.get("repairTaskId") as string | null;
  const findingId = formData.get("findingId") as string | null;
  const photoType = (formData.get("photoType") as string) || "general";
  const caption = formData.get("caption") as string | null;

  if (!file || !repairJobId) {
    return NextResponse.json({ error: "File and repairJobId are required" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Only images are allowed (JPEG, PNG, WebP, HEIC)" }, { status: 400 });
  }

  // Limit file size to 20MB (will be compressed)
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  // Fetch repair job details for folder path
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

  if (!job) {
    return NextResponse.json({ error: "Repair job not found" }, { status: 404 });
  }

  try {
    // Compress image with sharp
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressed = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75, mozjpeg: true })
      .toBuffer();

    // Build OneDrive folder path and file name
    const folderPath = buildRepairFolderPath({
      customerName: job.customerName,
      unitRegistration: job.unitRegistration,
      repairCode: job.publicCode,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const originalName = file.name.replace(/\.[^.]+$/, "");
    const fileName = `${timestamp}_${originalName}.jpg`;

    // Upload to OneDrive
    const result = await uploadFile(folderPath, fileName, compressed, "image/jpeg");

    const [photo] = await db.insert(repairPhotos).values({
      repairJobId,
      repairTaskId: repairTaskId || null,
      findingId: findingId || null,
      url: "pending", // will be updated with proxy URL
      thumbnailUrl: null,
      caption: caption || null,
      photoType,
      uploadedByUserId: ctx.userId,
      onedrivePath: result.drivePath,
      onedriveFolderUrl: result.folderWebUrl,
      onedriveItemId: result.itemId,
    }).returning();

    // Set URL to proxy endpoint so images always load via our API
    const proxyUrl = `/api/photos/${photo.id}`;
    await db.update(repairPhotos).set({ url: proxyUrl, thumbnailUrl: proxyUrl }).where(eq(repairPhotos.id, photo.id));

    return NextResponse.json({ photo: { ...photo, url: proxyUrl, thumbnailUrl: proxyUrl } });
  } catch (err: any) {
    console.error("Photo upload error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}
