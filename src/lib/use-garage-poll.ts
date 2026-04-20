"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Live-sync hook voor het garage-paneel.
 *
 * Pollt `/api/garage/poll` periodiek en triggert een `router.refresh()`
 * zodra de server meldt dat er iets is veranderd (nieuwe timer, nieuwe
 * comment, status-wissel, etc.).
 *
 * Drie situaties waar de vorige versie niet goed op reageerde en
 * waarvan we nu wél herstellen:
 *
 * 1. **iPad gaat slapen → wakker**. Slapende tab pauzeert `setInterval`
 *    vanzelf maar bij wakker worden bleef de app op de oude data
 *    hangen tot het volgende interval-tick. Nu horen we expliciet
 *    naar `visibilitychange`: pauze wanneer verborgen, meteen één
 *    poll + `router.refresh()` bij terugkomen.
 * 2. **Tijdelijk geen internet** (werkers in een metalen loods).
 *    Bij wegvallend signaal gaan fetches crashen; bij terugkomen
 *    luisteren we naar `online` en doen we een forced poll zodat
 *    UI meteen weer gelijk loopt met de server.
 * 3. **Timer die server-side is gestopt door iemand anders**.
 *    De reguliere poll ving dit al, maar niet snel na een wake.
 *    Door op elke wake ook een `router.refresh()` te doen zonder op
 *    een delta te wachten, krijgt de werker direct de actuele
 *    timer-state te zien in plaats van 5s later.
 */
export function useGaragePoll(repairId?: string, intervalMs = 5000) {
  const router = useRouter();
  const lastKnown = useRef<string | null>(null);
  const failCount = useRef(0);
  const poll = useCallback(
    async (forceRefresh = false) => {
      try {
        const url = repairId
          ? `/api/garage/poll?repairId=${repairId}`
          : "/api/garage/poll";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          failCount.current++;
          return;
        }
        const data = await res.json();
        failCount.current = 0;

        const changed =
          lastKnown.current &&
          data.lastUpdate &&
          data.lastUpdate !== lastKnown.current;

        if (changed || forceRefresh) {
          router.refresh();
        }
        lastKnown.current = data.lastUpdate;
      } catch {
        failCount.current++;
      }
    },
    [repairId, router],
  );

  useEffect(() => {
    // Initiële poll om baseline vast te leggen — zonder refresh, we
    // renderen immers al met server-side data.
    void poll(false);

    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id) return;
      const ms = failCount.current > 3 ? 30000 : intervalMs;
      id = setInterval(() => void poll(false), ms);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Wake-up: één directe poll mét forced refresh zodat de
        // werker meteen actuele tijden/status ziet, en daarna
        // opnieuw op het interval.
        void poll(true);
        start();
      } else {
        // Verborgen (iPad in slaap, of andere app voorgrond) —
        // stop het interval om netwerk en batterij te sparen.
        stop();
      }
    };
    const onOnline = () => {
      // Internet terug — forceer directe sync.
      failCount.current = 0;
      void poll(true);
      start();
    };
    const onFocus = () => {
      // Window krijgt focus terug (bv. andere tab actief geweest);
      // lichte sync is genoeg.
      void poll(false);
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll, intervalMs]);
}
