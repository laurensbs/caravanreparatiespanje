import type { VoiceClip } from "@/components/garage/voice-recorder";

/**
 * Shared helper that takes a freshly-recorded voice clip and uploads it
 * to /api/garage/voice-notes/upload, attaching it to the row that the
 * caller just persisted (comment, blocker, finding, tool-request, …).
 *
 * Best-effort by design: the parent action already succeeded by the time
 * we call this, so a failed audio upload should warn the user but not
 * roll back. Returns true on success, false on failure.
 */
export async function uploadVoiceNote(opts: {
  clip: VoiceClip;
  ownerType: "comment" | "blocker" | "finding" | "tool_request" | "repair_message";
  ownerId: string;
  repairJobId?: string | null;
}): Promise<boolean> {
  const ext = opts.clip.mimeType.includes("mp4")
    ? "m4a"
    : opts.clip.mimeType.includes("webm")
      ? "webm"
      : opts.clip.mimeType.includes("ogg")
        ? "ogg"
        : "audio";
  const fd = new FormData();
  fd.append(
    "file",
    new File([opts.clip.blob], `${opts.ownerType}-${opts.ownerId}.${ext}`, {
      type: opts.clip.mimeType,
    }),
  );
  fd.append("ownerType", opts.ownerType);
  fd.append("ownerId", opts.ownerId);
  fd.append("durationSeconds", String(opts.clip.durationSeconds));
  if (opts.repairJobId) fd.append("repairJobId", opts.repairJobId);
  try {
    const res = await fetch("/api/garage/voice-notes/upload", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("voice upload failed", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("voice upload threw", err);
    return false;
  }
}
