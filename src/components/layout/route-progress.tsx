"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Lightweight top-of-page progress bar for App Router navigations.
 *
 * We can't use the classic "router events" API any more (it's gone in the
 * App Router), so we detect navigations two ways:
 *
 *  1. Intercept `<a>` clicks globally – the click fires well before the new
 *     route's server component has streamed back, which is exactly when we
 *     want to *start* the bar. We only intercept plain left-clicks on same-
 *     origin links that aren't modified (`⌘/ctrl/shift/alt`, `target=_blank`
 *     etc). This catches Next `<Link>` too because it renders a real <a>.
 *  2. When `pathname + search` changes, the navigation is done, so we finish
 *     the bar. If nothing triggered step 1 (e.g. programmatic `router.push`
 *     inside a Server Action), the pathname change alone will flash a short
 *     bar which still reads as "something happened".
 *
 * The animation tweens progress towards ~85% while loading, then snaps to
 * 100% and fades out. No external dep.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (finishRef.current) clearTimeout(finishRef.current);
    if (trickleRef.current) clearInterval(trickleRef.current);
    setVisible(true);
    setProgress(8);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 86) return p;
        // ease towards 86 with shrinking steps so the bar never stalls
        // visually while we wait for the server component to stream.
        const step = Math.max(0.5, (90 - p) / 14);
        return p + step;
      });
    }, 200);
  };

  const finish = () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    setProgress(100);
    finishRef.current = setTimeout(() => {
      setVisible(false);
      // reset after the fade-out so next navigation starts clean.
      setTimeout(() => setProgress(0), 200);
    }, 220);
  };

  // Click interceptor: start the bar right when a link is clicked.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = (e.target as HTMLElement | null)?.closest?.("a");
      if (!target) return;
      if (target.getAttribute("target") === "_blank") return;
      if (target.hasAttribute("download")) return;
      const href = target.getAttribute("href");
      if (!href) return;
      // External or hash-only: don't show progress
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) return;
      if (href.startsWith("#")) return;
      // Same path + same search: no navigation
      try {
        const url = new URL(href, window.location.href);
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }
      start();
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Pathname / search change: the navigation committed, finish the bar.
  useEffect(() => {
    // Small delay so we don't finish *before* the start trickled into view.
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      finish();
    }, 60);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, search]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (trickleRef.current) clearInterval(trickleRef.current);
      if (finishRef.current) clearTimeout(finishRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 220ms ease-out",
      }}
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-foreground/80 via-foreground to-foreground/80 shadow-[0_0_10px_rgba(0,0,0,0.25)] dark:shadow-[0_0_10px_rgba(255,255,255,0.35)]"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition:
            progress >= 100
              ? "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)"
              : "transform 200ms linear",
        }}
      />
    </div>
  );
}
