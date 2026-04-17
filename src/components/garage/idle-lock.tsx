"use client";

import { useEffect, useRef } from "react";
import { garageLock } from "@/actions/garage-auth";

const IDLE_LOCK_MS = 3 * 60 * 1000; // 3 minutes

export function GarageIdleLock() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockingRef = useRef(false);

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        if (lockingRef.current) return;
        lockingRef.current = true;
        try {
          await garageLock();
        } finally {
          window.location.href = "/garage";
        }
      }, IDLE_LOCK_MS);
    };

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
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return null;
}
