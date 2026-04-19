"use client";

import { RefreshCw } from "lucide-react";

/**
 * Visual indicator for pull-to-refresh.
 *
 * Sits absolutely at the top of the screen and reveals as the user pulls.
 * The arrow rotates as they cross the threshold; once refreshing it spins.
 */
export function PullToRefreshIndicator({
  pull,
  armed,
  refreshing,
}: {
  pull: number;
  armed: boolean;
  refreshing: boolean;
}) {
  if (pull <= 1 && !refreshing) return null;
  const opacity = Math.min(1, pull / 50);
  const translate = Math.min(pull, 90);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{
        transform: `translateY(${translate - 40}px)`,
        opacity,
        transition: refreshing ? "transform 200ms ease-out" : "none",
      }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/85 text-white shadow-lg backdrop-blur ${
          armed && !refreshing ? "scale-110" : ""
        } transition-transform`}
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          style={{
            transform: refreshing ? undefined : `rotate(${Math.min(pull * 3, 180)}deg)`,
            transition: refreshing ? "none" : "transform 80ms linear",
          }}
        />
      </div>
    </div>
  );
}
