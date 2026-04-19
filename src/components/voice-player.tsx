"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Compact, button-shaped audio player for voice notes recorded by the
 * garage. Renders as a single tap target showing duration; tapping
 * starts/stops playback. Loads metadata lazily so a long list of
 * comments doesn't fire dozens of audio decoders up-front.
 */
function fmtSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function VoicePlayer({
  url,
  durationSeconds,
  label,
  size = "md",
}: {
  url: string;
  durationSeconds: number;
  label?: string;
  size?: "sm" | "md";
}) {
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = new Audio(url);
    el.preload = "metadata";
    el.onended = () => setPlaying(false);
    el.onpause = () => setPlaying(false);
    el.onplay = () => setPlaying(true);
    setAudio(el);
    return () => {
      el.pause();
      el.src = "";
    };
  }, [url]);

  function toggle() {
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => setPlaying(false));
  }

  const sizeClass =
    size === "sm"
      ? "h-7 px-2 text-[11px] gap-1.5"
      : "h-8 px-2.5 text-xs gap-2";

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center rounded-lg bg-muted font-semibold text-foreground transition-colors hover:bg-muted/80 active:scale-95 ${sizeClass}`}
    >
      {playing ? (
        <Pause className="h-3 w-3 fill-current" />
      ) : (
        <Play className="ml-0.5 h-3 w-3 fill-current" />
      )}
      <span className="font-mono tabular-nums">{fmtSec(durationSeconds)}</span>
      <span className="text-muted-foreground">{label ?? "voice"}</span>
    </button>
  );
}
