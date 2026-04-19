/**
 * Haptic feedback + subtle audio feedback for native-app feel.
 * Uses navigator.vibrate() on supported devices and short AudioContext beeps as fallback.
 *
 * Sound output is opt-out: respect a "haptic.sound.enabled" key in
 * localStorage (default: true). The garage settings sheet exposes a
 * toggle. Vibration is always enabled because it's already silent.
 *
 * Also respects prefers-reduced-motion — if the user signals they want
 * less motion / stimulus, we mute the audio fallback automatically.
 */

const SOUND_KEY = "haptic.sound.enabled";

function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const v = window.localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setHapticSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {
    // ignore quota errors
  }
}

export function getHapticSoundEnabled(): boolean {
  return soundEnabled();
}

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function playTone(frequency: number, duration: number, volume = 0.08) {
  if (!soundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/**
 * Click — short filtered noise burst with sharp envelope.
 * Mimics a mechanical/keyboard tap; on iPad speakers this is much more
 * convincing than a sine tone (which sounds like a beep).
 *
 * Tone color is controlled by a band-pass filter:
 *   - higher freq + tighter Q  → sharper "tick"
 *   - lower freq + wider Q     → softer "thud"
 */
function playClick(opts?: {
  freq?: number;
  q?: number;
  duration?: number;
  volume?: number;
}) {
  if (!soundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const duration = opts?.duration ?? 0.025;
  const volume = opts?.volume ?? 0.18;
  const freq = opts?.freq ?? 2400;
  const q = opts?.q ?? 6;

  // White noise buffer (one-shot, freshly generated each time)
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  // Sharp attack, fast exponential decay → "tick"
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(now);
  src.stop(now + duration + 0.01);
}

/** Light tap — button press, card tap */
export function hapticTap() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
  playClick({ freq: 2600, q: 8, duration: 0.022, volume: 0.16 });
}

/** Even lighter tap — keypad digit, repeat-tap */
export function hapticKey() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(6);
  }
  playClick({ freq: 3200, q: 10, duration: 0.018, volume: 0.12 });
}

/** Medium feedback — action confirmed (start timer, assign worker) */
export function hapticSuccess() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([15, 50, 15]);
  }
  // Two-tap "ka-chunk"
  playClick({ freq: 1800, q: 5, duration: 0.03, volume: 0.18 });
  setTimeout(() => playClick({ freq: 2800, q: 8, duration: 0.025, volume: 0.16 }), 60);
}

/** Error — used by login on wrong PIN, also good for invalid actions */
export function hapticError() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([20, 60, 20]);
  }
  playClick({ freq: 380, q: 3, duration: 0.06, volume: 0.18 });
  setTimeout(() => playClick({ freq: 320, q: 3, duration: 0.06, volume: 0.16 }), 70);
}

/** Notification — new task available */
export function hapticNotify() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([30, 80, 30, 80, 50]);
  }
  // Ascending two-tone chime — keep musical for notifications
  playTone(660, 0.12, 0.1);
  setTimeout(() => playTone(880, 0.15, 0.12), 150);
  setTimeout(() => playTone(1100, 0.2, 0.1), 350);
}

/**
 * Prime the audio context on the very first user gesture.
 * iOS requires a user-initiated unlock before any audio plays. Without
 * priming, the very first hapticTap() of a session is silent. Call this
 * once from a top-level "pointerdown" listener.
 */
export function primeHaptics() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
