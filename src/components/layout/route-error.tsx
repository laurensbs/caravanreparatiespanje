"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Short human label for the area that errored, e.g. "Dashboard" or "Repair detail". */
  area?: string;
  /** Where to link "Home" to. Defaults to `/`. */
  homeHref?: string;
};

/**
 * Shared fallback UI for App Router `error.tsx` boundaries. Keeps one
 * consistent layout across admin + garage so a crash never looks like a
 * blank page or a raw Next.js error overlay in production.
 */
export function RouteError({ error, reset, area, homeHref = "/" }: Props) {
  useEffect(() => {
    // Surface the error in the browser console so we can still diagnose
    // from the user's devtools. In production this is the only clue, since
    // `error.message` is redacted when `digest` is present.
    console.error(`[${area ?? "route"}]`, error);
  }, [error, area]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {area ? `Something went wrong in ${area}.` : "Something went wrong."}
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page hit an unexpected error. You can try again — if it keeps
          happening, please share the reference below with support.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Button onClick={() => reset()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </Button>
          <Button variant="outline" asChild className="gap-1.5">
            <Link href={homeHref}>
              <Home className="h-3.5 w-3.5" aria-hidden /> Back to dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
