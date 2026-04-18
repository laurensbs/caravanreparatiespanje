"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Cross-route fade + slide. Wraps the dashboard <main> children and
 * triggers a quick (220ms) re-mount animation when the pathname or
 * search params change. Runs entirely on the client — no Framer
 * Motion, no Suspense, no server-component changes required.
 *
 * Respects prefers-reduced-motion automatically because we use plain
 * Tailwind animation classes that are already 'animation-duration: 0'
 * under the OS toggle.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const key = `${pathname}?${search.toString()}`;
  const [renderKey, setRenderKey] = useState(key);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setRenderKey(key);
  }, [key]);

  return (
    <div key={renderKey} className="animate-page-in">
      {children}
    </div>
  );
}
