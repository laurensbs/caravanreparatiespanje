import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { repairPhotos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  const session = await requireAuth();

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

  // Limit file size to 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const blob = await put(`repairs/${repairJobId}/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  const [photo] = await db.insert(repairPhotos).values({
    repairJobId,
    repairTaskId: repairTaskId || null,
    findingId: findingId || null,
    url: blob.url,
    thumbnailUrl: null,
    caption: caption || null,
    photoType,
    uploadedByUserId: session.user.id,
  }).returning();

  return NextResponse.json({ photo });
}
