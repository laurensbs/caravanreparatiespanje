"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Touch-friendly image lightbox. Renders into a full-screen overlay
 * with click-to-close, ←/→ keyboard nav, swipe nav on touch, and a
 * download button.
 *
 *   <ImageLightbox
 *     images={[{ src, alt }]}
 *     index={0}
 *     onClose={() => setOpen(false)}
 *     onIndexChange={setIndex}
 *   />
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: { src: string; alt?: string; downloadName?: string }[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}) {
  const safeIndex = Math.max(0, Math.min(index, images.length - 1));
  const current = images[safeIndex];
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const setIdx = useCallback(
    (next: number) => {
      const clamped = (next + images.length) % images.length;
      onIndexChange?.(clamped);
    },
    [images.length, onIndexChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx(safeIndex + 1);
      else if (e.key === "ArrowLeft") setIdx(safeIndex - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, setIdx, safeIndex]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!current) return null;

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      setIdx(safeIndex + (dx < 0 ? 1 : -1));
    }
    setTouchStartX(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/85 backdrop-blur-md animate-in fade-in-0 duration-200"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        type="button"
        aria-label="Sluit"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/10 text-background transition-colors hover:bg-background/20"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Download */}
      {current.src && (
        <a
          href={current.src}
          download={current.downloadName}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          aria-label="Download"
          className="absolute right-16 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/10 text-background transition-colors hover:bg-background/20"
        >
          <Download className="h-4 w-4" />
        </a>
      )}

      {/* Counter */}
      {images.length > 1 && (
        <span className="absolute left-4 top-4 rounded-full bg-background/10 px-3 py-1.5 text-xs font-medium tabular-nums text-background/80">
          {safeIndex + 1} / {images.length}
        </span>
      )}

      {/* Prev/Next on desktop */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Vorige"
            onClick={(e) => {
              e.stopPropagation();
              setIdx(safeIndex - 1);
            }}
            className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/10 text-background transition-colors hover:bg-background/20 sm:inline-flex sm:h-12 sm:w-12"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Volgende"
            onClick={(e) => {
              e.stopPropagation();
              setIdx(safeIndex + 1);
            }}
            className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-background/10 text-background transition-colors hover:bg-background/20 sm:inline-flex sm:h-12 sm:w-12"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Image */}
      <div
        className={cn(
          "relative max-h-[90vh] max-w-[92vw] animate-in zoom-in-95 fade-in-0 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.alt ?? ""}
          className="block max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)]"
        />
        {current.alt ? (
          <p className="mt-3 text-center text-xs text-background/70">{current.alt}</p>
        ) : null}
      </div>
    </div>
  );
}
