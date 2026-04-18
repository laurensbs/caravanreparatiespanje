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
  // Resume context if suspended (autoplay policy)
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

/** Light tap — button press, card tap */
export function hapticTap() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
  playTone(800, 0.05, 0.04);
}

/** Medium feedback — action confirmed (start timer, assign worker) */
export function hapticSuccess() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([15, 50, 15]);
  }
  playTone(880, 0.06, 0.06);
  setTimeout(() => playTone(1200, 0.08, 0.06), 80);
}

/** Notification — new task available */
export function hapticNotify() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([30, 80, 30, 80, 50]);
  }
  // Ascending two-tone chime
  playTone(660, 0.12, 0.1);
  setTimeout(() => playTone(880, 0.15, 0.12), 150);
  setTimeout(() => playTone(1100, 0.2, 0.1), 350);
}
