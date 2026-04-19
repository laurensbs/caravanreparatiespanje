"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Play, Pause, Loader2 } from "lucide-react";
import { hapticTap, hapticSuccess } from "@/lib/haptic";

/* ─────────────────────────────────────────────────────────────────────
   Voice recorder for the garage app
   ─────────────────────────────────────────────────────────────────────
   Why this exists: workers wear gloves and the iPad keyboard is slow.
   Recording a 10-second voice note is dramatically faster than typing
   "boiler leaks left side near scarf, ask customer if it's been like
   that long" — and it preserves the worker's actual phrasing for the
   office to listen back to.

   How it works:
   - Caller renders <VoiceRecorder onChange={setBlob} /> next to a
     textarea. The blob is uploaded by the parent when the form is
     submitted, attached to whatever owner type the form is for.
   - Mobile Safari (iPad) supports MediaRecorder since iOS 14.3, so
     no polyfill needed. We pick the most compatible mime type.
   - We deliberately do NOT auto-upload; the parent owns the lifecycle
     so a comment + voice note become a single atomic write.
   ───────────────────────────────────────────────────────────────── */

type RecorderState = "idle" | "recording" | "ready" | "playing";

function pickMimeType(): string {
  // Prefer formats Safari + Chrome both decode nicely.
  const candidates = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // ignore
    }
  }
  return "audio/webm";
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export type VoiceClip = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  url: string; // object URL for local playback only
};

export function VoiceRecorder({
  value,
  onChange,
  t,
  maxSeconds = 120,
}: {
  value: VoiceClip | null;
  onChange: (clip: VoiceClip | null) => void;
  t: (en: string, es: string, nl: string) => string;
  maxSeconds?: number;
}) {
  const [state, setState] = useState<RecorderState>(value ? "ready" : "idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset internal state when the parent clears `value`.
  useEffect(() => {
    if (!value) setState((s) => (s === "ready" || s === "playing" ? "idle" : s));
  }, [value]);

  // Cleanup stream + interval on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (value?.url) URL.revokeObjectURL(value.url);
    };
    // We intentionally skip `value` here; we only want unmount cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        t(
          "Recording is not supported on this device.",
          "La grabación no es compatible con este dispositivo.",
          "Opnemen wordt op dit apparaat niet ondersteund.",
        ),
      );
      return;
    }
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const dur = seconds; // closure-captured; reset right after
        onChange({ blob, mimeType, durationSeconds: dur, url });
        setState("ready");
        // Tear down the mic so the browser's recording indicator clears.
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setState("recording");
      hapticTap();
      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= maxSeconds) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = (err as Error)?.message ?? "permission";
      setError(
        t(
          `Microphone blocked (${msg}). Allow access in Settings → Safari → Microphone.`,
          `Micrófono bloqueado (${msg}). Permite acceso en Ajustes → Safari → Micrófono.`,
          `Microfoon geblokkeerd (${msg}). Sta toegang toe in Instellingen → Safari → Microfoon.`,
        ),
      );
    } finally {
      setRequesting(false);
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    hapticSuccess();
  }

  function discard() {
    if (value?.url) URL.revokeObjectURL(value.url);
    onChange(null);
    setSeconds(0);
    setState("idle");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  function togglePlayback() {
    if (!value || !audioRef.current) return;
    if (state === "playing") {
      audioRef.current.pause();
      setState("ready");
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setState("playing"))
        .catch(() => setState("ready"));
    }
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-rose-500/[0.12] p-2.5 ring-1 ring-rose-500/30">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
        </span>
        <span className="flex-1 font-mono text-sm font-semibold text-rose-200 tabular-nums">
          {fmtSec(seconds)}{" "}
          <span className="ml-1 text-xs font-normal text-rose-300/70">
            {t("recording…", "grabando…", "opnemen…")}
          </span>
        </span>
        <button
          type="button"
          onClick={stopRecording}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-bold text-stone-950 active:scale-[0.97]"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          {t("Stop", "Parar", "Stop")}
        </button>
      </div>
    );
  }

  if (state === "ready" || state === "playing") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/[0.10] p-2.5 ring-1 ring-emerald-500/25">
        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-stone-950 active:scale-[0.97]"
          aria-label={state === "playing" ? t("Pause", "Pausa", "Pauze") : t("Play", "Reproducir", "Afspelen")}
        >
          {state === "playing" ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>
        <span className="flex-1 font-mono text-sm font-semibold text-emerald-200 tabular-nums">
          {fmtSec(value?.durationSeconds ?? 0)}{" "}
          <span className="ml-1 text-xs font-normal text-emerald-300/70">
            {t("voice note", "nota de voz", "spraakbericht")}
          </span>
        </span>
        <button
          type="button"
          onClick={discard}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-white/70 hover:bg-white/[0.1] active:scale-[0.97]"
          aria-label={t("Delete", "Borrar", "Verwijder")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {value?.url ? (
          <audio
            ref={audioRef}
            src={value.url}
            preload="metadata"
            onEnded={() => setState("ready")}
            className="hidden"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={startRecording}
        disabled={requesting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] text-sm font-semibold text-white/80 ring-1 ring-white/[0.08] transition-all hover:bg-white/[0.1] active:scale-[0.98] disabled:opacity-50"
      >
        {requesting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4 text-rose-300" />
        )}
        {t("Record voice note", "Grabar nota de voz", "Spraakbericht opnemen")}
      </button>
      {error ? (
        <p className="text-[11px] text-rose-300/80">{error}</p>
      ) : null}
    </div>
  );
}
