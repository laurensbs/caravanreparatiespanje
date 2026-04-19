import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { repairJobs, customers, units, voiceNotes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAnyAuth } from "@/lib/garage-auth";
import { uploadFile, buildRepairFolderPath } from "@/lib/onedrive";

/**
 * Voice notes are uploaded standalone with a referenced owner_type/owner_id.
 * The flow is: caller already created the comment/blocker/finding/tool_request
 * row and got back its id, then POSTs the audio here. We store the file in the
 * same OneDrive folder as the repair photos (or a generic "voice-notes" folder
 * if it's a tool request without a repair) and persist a row that knows where
 * the file lives.
 *
 * We deliberately accept *any* recognizable audio mime type; MediaRecorder on
 * iPad emits audio/mp4 while Chrome on Android emits audio/webm.
 */
const ALLOWED_MIME_PREFIXES = ["audio/"];
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_OWNER_TYPES = new Set([
  "comment",
  "blocker",
  "finding",
  "tool_request",
  "repair_message",
]);

export async function POST(request: NextRequest) {
  const ctx = await requireAnyAuth();

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const ownerType = formData.get("ownerType") as string | null;
  const ownerId = formData.get("ownerId") as string | null;
  const repairJobId = (formData.get("repairJobId") as string | null) || null;
  const durationRaw = formData.get("durationSeconds") as string | null;

  if (!file || !ownerType || !ownerId) {
    return NextResponse.json(
      { error: "file, ownerType and ownerId are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_OWNER_TYPES.has(ownerType)) {
    return NextResponse.json({ error: "Invalid ownerType" }, { status: 400 });
  }
  if (!ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
    return NextResponse.json(
      { error: `Unsupported audio type: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Voice note too large (max 10MB)" },
      { status: 400 },
    );
  }

  const durationSeconds = Number.parseInt(durationRaw || "0", 10) || 0;

  // Resolve a folder. For tool requests without repair we use a fallback
  // folder so OneDrive isn't littered with stray files.
  let folderPath: string;
  if (repairJobId) {
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
      return NextResponse.json({ error: "Repair not found" }, { status: 404 });
    }
    folderPath = buildRepairFolderPath({
      customerName: job.customerName,
      unitRegistration: job.unitRegistration,
      repairCode: job.publicCode,
    });
  } else {
    folderPath = "Garage voice notes";
  }

  // Pick a sensible extension for the file name.
  const ext = file.type.includes("mp4")
    ? "m4a"
    : file.type.includes("webm")
      ? "webm"
      : file.type.includes("ogg")
        ? "ogg"
        : "audio";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `${timestamp}_${ownerType}_${ownerId.slice(0, 8)}.${ext}`;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const result = await uploadFile(folderPath, fileName, buffer, file.type);

    // Look up the actor's display label so we can show it to admins without
    // joining users every time we render a voice note.
    let label: string | null = null;
    if (ctx.userId) {
      const [u] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ctx.userId));
      label = u?.name ?? null;
    }

    const [row] = await db
      .insert(voiceNotes)
      .values({
        repairJobId: repairJobId ?? null,
        ownerType: ownerType as
          | "comment"
          | "blocker"
          | "finding"
          | "tool_request"
          | "repair_message",
        ownerId,
        durationSeconds,
        mimeType: file.type,
        url: "pending",
        onedrivePath: result.drivePath,
        onedriveFolderUrl: result.folderWebUrl,
        onedriveItemId: result.itemId,
        uploadedByUserId: ctx.userId ?? null,
        uploadedByLabel: label,
      })
      .returning();

    const proxyUrl = `/api/garage/voice-notes/${row.id}`;
    await db
      .update(voiceNotes)
      .set({ url: proxyUrl })
      .where(eq(voiceNotes.id, row.id));

    return NextResponse.json({
      voiceNote: {
        id: row.id,
        url: proxyUrl,
        durationSeconds,
        mimeType: file.type,
        uploadedByLabel: label,
      },
    });
  } catch (err) {
    console.error("Voice upload error:", err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? "Failed to upload voice note" },
      { status: 500 },
    );
  }
}
