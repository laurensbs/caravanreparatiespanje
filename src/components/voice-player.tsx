"use client";

import { useRef, useState } from "react";
import { AlertCircle, Pause, Play } from "lucide-react";

/**
 * Compact, button-shaped audio player for voice notes recorded by the
 * garage. We lazy-instantiate the HTMLAudioElement on first tap (not
 * on mount) so a list of 20 voice notes doesn't fire 20 network
 * requests for metadata. Also keeps state handling simple — if playback
 * fails (codec mismatch, network) we surface an error icon instead of
 * silently doing nothing.
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
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function ensureAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "metadata";
      el.src = url;
      el.addEventListener("ended", () => setPlaying(false));
      el.addEventListener("pause", () => setPlaying(false));
      el.addEventListener("play", () => setPlaying(true));
      el.addEventListener("error", () => {
        setPlaying(false);
        setError(true);
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("voice-player: audio error", url, el.error);
        }
      });
      audioRef.current = el;
    }
    return audioRef.current;
  }

  async function toggle() {
    const audio = ensureAudio();
    setError(false);
    try {
      if (playing) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (err) {
      setPlaying(false);
      setError(true);
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.warn("voice-player: play failed", url, err);
      }
    }
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
      title={error ? "Playback failed — tap to retry" : undefined}
    >
      {error ? (
        <AlertCircle className="h-3 w-3 text-red-500" />
      ) : playing ? (
        <Pause className="h-3 w-3 fill-current" />
      ) : (
        <Play className="ml-0.5 h-3 w-3 fill-current" />
      )}
      <span className="font-mono tabular-nums">{fmtSec(durationSeconds)}</span>
      <span className="text-muted-foreground">{label ?? "voice"}</span>
    </button>
  );
}
