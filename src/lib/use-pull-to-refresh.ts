"use client";

import { useEffect, useRef, useState } from "react";

/**
 * iOS-style pull-to-refresh.
 *
 * Attach the returned `bind` props to a scroll container (or window-level
 * element). When the user is at scrollTop=0 and drags down past `threshold`,
 * `onRefresh` is called and a spinner stays visible until the returned
 * promise resolves.
 *
 * Notes:
 * - We use `touch-action: pan-y` on the bound element so vertical drag still
 *   feels native and doesn't fight scrolling.
 * - The "rubber band" amount is square-rooted to mimic iOS resistance.
 * - Mouse drag is intentionally NOT supported; this is purely a touch UX.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0); // px
  const [refreshing, setRefreshing] = useState(false);
  const threshold = 70;

  useEffect(() => {
    function getScrollTop() {
      return (
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0
      );
    }

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      if (getScrollTop() > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    }

    function onTouchMove(e: TouchEvent) {
      if (refreshing || startY.current === null) return;
      const y = e.touches[0]?.clientY ?? 0;
      const dy = y - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band resistance
      const resisted = Math.sqrt(dy) * 6;
      setPull(Math.min(resisted, 110));
    }

    async function onTouchEnd() {
      if (refreshing) return;
      const reached = pull >= threshold;
      startY.current = null;
      if (reached) {
        setRefreshing(true);
        setPull(60);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, pull, refreshing]);

  const armed = pull >= threshold;

  return { pull, refreshing, armed, threshold };
}
