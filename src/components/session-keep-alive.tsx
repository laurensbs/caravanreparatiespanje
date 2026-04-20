"use client";

/**
 * Keeps the admin NextAuth JWT cookie fresh while the user is actually
 * using the app.
 *
 * Why this exists:
 *   NextAuth is configured with `maxAge: 30 min` and `updateAge: 0` so the
 *   cookie renews on every server request — a "sliding window" that
 *   re-arms whenever the server sees activity. In practice many pages in
 *   this panel are client-rendered: a user can type, scroll, and browse
 *   forms for a long time without hitting the server at all. The cookie
 *   then expires mid-session and the next server action/page nav dumps
 *   them at `/login`, even though they were clearly active.
 *
 * What it does:
 *   1. Listens for real user input (pointerdown / keydown / touchstart).
 *   2. When activity is detected and we haven't refreshed recently, fires
 *      a lightweight GET `/api/auth/session` request. With `updateAge: 0`
 *      NextAuth rewrites the session cookie with a fresh 30-minute
 *      lifetime.
 *   3. Pauses while the tab is hidden — no point keeping a forgotten tab
 *      alive forever.
 *
 * Net effect: an active user stays logged in indefinitely, but an idle
 * tab (no input for 30 minutes) still expires and ends up back on the
 * login screen on their next navigation.
 */

import { useEffect, useRef } from "react";

// Refresh at most once per REFRESH_THROTTLE_MS even if the user is
// hammering the keyboard. Comfortably below the 30-minute cookie TTL so
// the cookie never runs out while the user is active.
const REFRESH_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export function SessionKeepAlive() {
  const lastRefreshRef = useRef<number>(Date.now());
  const pendingRef = useRef(false);

  useEffect(() => {
    async function refresh() {
      if (pendingRef.current) return;
      if (document.visibilityState === "hidden") return;
      pendingRef.current = true;
      try {
        // A plain GET hits NextAuth's session handler which re-issues the
        // cookie when `updateAge: 0` is configured. No body needed.
        await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        lastRefreshRef.current = Date.now();
      } catch {
        // Offline / network hiccup — we'll just retry on the next burst
        // of activity. No need to surface this to the user.
      } finally {
        pendingRef.current = false;
      }
    }

    function onActivity() {
      const now = Date.now();
      if (now - lastRefreshRef.current < REFRESH_THROTTLE_MS) return;
      void refresh();
    }

    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
    ];
    for (const evt of events) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    // Also refresh immediately when the tab becomes visible again — the
    // user returning from another app is a strong "still here" signal.
    function onVisibility() {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastRefreshRef.current >= REFRESH_THROTTLE_MS) {
          void refresh();
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const evt of events) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
