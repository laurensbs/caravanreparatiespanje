"use server";

import { db } from "@/lib/db";
import { voiceNotes } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

export type VoiceNoteRow = {
  id: string;
  ownerType: string;
  ownerId: string;
  durationSeconds: number;
  url: string;
  uploadedByLabel: string | null;
  createdAt: Date;
};

/**
 * Fetch all voice notes for a given repair job, grouped by owner row.
 * Used by the admin repair detail page so we can render an inline
 * audio player next to each comment / blocker / finding without
 * shipping the audio binary into the React tree.
 */
export async function listVoiceNotesForRepair(
  repairJobId: string,
): Promise<Record<string, VoiceNoteRow[]>> {
  // Admin-only; the ownerless garage tablet should never call this.
  const session = await auth();
  if (!session?.user) return {};

  const rows = await db
    .select({
      id: voiceNotes.id,
      ownerType: voiceNotes.ownerType,
      ownerId: voiceNotes.ownerId,
      durationSeconds: voiceNotes.durationSeconds,
      url: voiceNotes.url,
      uploadedByLabel: voiceNotes.uploadedByLabel,
      createdAt: voiceNotes.createdAt,
    })
    .from(voiceNotes)
    .where(eq(voiceNotes.repairJobId, repairJobId));

  const byOwner: Record<string, VoiceNoteRow[]> = {};
  for (const r of rows) {
    (byOwner[r.ownerId] ??= []).push(r);
  }
  return byOwner;
}

/**
 * Bulk variant for the admin dashboard tool-request inbox: given an
 * explicit list of owner ids (regardless of repair), return the notes
 * keyed by owner_id. Avoids N+1 queries from the widget.
 */
export async function listVoiceNotesByOwnerIds(
  ownerIds: string[],
): Promise<Record<string, VoiceNoteRow[]>> {
  const session = await auth();
  if (!session?.user) return {};
  if (ownerIds.length === 0) return {};

  const rows = await db
    .select({
      id: voiceNotes.id,
      ownerType: voiceNotes.ownerType,
      ownerId: voiceNotes.ownerId,
      durationSeconds: voiceNotes.durationSeconds,
      url: voiceNotes.url,
      uploadedByLabel: voiceNotes.uploadedByLabel,
      createdAt: voiceNotes.createdAt,
    })
    .from(voiceNotes)
    .where(inArray(voiceNotes.ownerId, ownerIds));

  const byOwner: Record<string, VoiceNoteRow[]> = {};
  for (const r of rows) {
    (byOwner[r.ownerId] ??= []).push(r);
  }
  return byOwner;
}
