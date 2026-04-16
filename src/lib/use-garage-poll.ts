"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

export function useGaragePoll(repairId?: string, intervalMs = 5000) {
  const router = useRouter();
  const lastKnown = useRef<string | null>(null);
  const failCount = useRef(0);

  const poll = useCallback(async () => {
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

      if (
        lastKnown.current &&
        data.lastUpdate &&
        data.lastUpdate !== lastKnown.current
      ) {
        router.refresh();
      }
      lastKnown.current = data.lastUpdate;
    } catch {
      failCount.current++;
    }
  }, [repairId, router]);

  useEffect(() => {
    poll(); // initial fetch to set baseline
    const ms = failCount.current > 3 ? 30000 : intervalMs;
    const id = setInterval(poll, ms);
    return () => clearInterval(id);
  }, [poll, intervalMs]);
}
