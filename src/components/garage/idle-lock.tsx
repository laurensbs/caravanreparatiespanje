"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { garageLock } from "@/actions/garage-auth";
import { useLanguage } from "@/components/garage/language-toggle";

// Total time after which the iPad returns to the PIN screen.
// Matches the admin session timeout so the whole app behaves the same.
const IDLE_LOCK_MS = 30 * 60 * 1000; // 30 minutes
// When the warning toast appears before the lock, giving the worker a chance
// to tap anything to stay signed in.
const WARNING_BEFORE_LOCK_MS = 30 * 1000; // 30 seconds

/**
 * Soft idle lock for the shared garage iPad.
 *
 * Behaviour:
 *   • Any interaction (tap, key, pointer move) resets the timer.
 *   • 30 s before lock we show a warning toast. The toast itself counts
 *     as an interaction, so a single tap on anything dismisses it and
 *     restarts the idle countdown.
 *   • After 30 minutes of real inactivity we clear the garage cookie and
 *     reload to the PIN screen.
 */
export function GarageIdleLock() {
  const { t } = useLanguage();
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningToastIdRef = useRef<string | number | null>(null);
  const lockingRef = useRef(false);

  useEffect(() => {
    function clearWarning() {
      if (warningToastIdRef.current != null) {
        toast.dismiss(warningToastIdRef.current);
        warningToastIdRef.current = null;
      }
    }

    function clearTimers() {
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (warnTimeoutRef.current) clearTimeout(warnTimeoutRef.current);
      lockTimeoutRef.current = null;
      warnTimeoutRef.current = null;
    }

    async function doLock() {
      if (lockingRef.current) return;
      lockingRef.current = true;
      clearWarning();
      try {
        await garageLock();
      } finally {
        window.location.href = "/garage";
      }
    }

    function showWarning() {
      warningToastIdRef.current = toast(
        t(
          "Locking in 30 s — tap to stay",
          "Bloqueando en 30 s — toca para continuar",
          "Over 30 s vergrendeld — tik om door te gaan",
        ),
        {
          duration: WARNING_BEFORE_LOCK_MS,
          // Intentionally no action — any interaction on the page dismisses
          // and reschedules via the resetTimer handler below.
        },
      );
    }

    function resetTimer() {
      clearTimers();
      clearWarning();
      warnTimeoutRef.current = setTimeout(showWarning, IDLE_LOCK_MS - WARNING_BEFORE_LOCK_MS);
      lockTimeoutRef.current = setTimeout(doLock, IDLE_LOCK_MS);
    }

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "mousemove",
    ];
    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      clearTimers();
      clearWarning();
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [t]);

  return null;
}
