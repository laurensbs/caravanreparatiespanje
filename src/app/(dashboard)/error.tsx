"use client";

import { useEffect } from "react";
import { RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dashboard segment error boundary. Keeps sidebar + header in place,
 * only the main content area renders this fallback.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[dashboard error]", error);
    }
  }, [error]);

  return (
    <div className="animate-fade-in flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h2 className="mt-3 text-lg font-semibold tracking-[-0.01em]">
          Dit blok kon niet laden
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Geen zorgen — de rest van de app werkt nog. Klik om dit deel opnieuw
          op te halen.
        </p>
        {error.digest ? (
          <p className="mt-3 inline-block rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
            ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-5">
          <Button onClick={reset}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Probeer opnieuw
          </Button>
        </div>
      </div>
    </div>
  );
}
