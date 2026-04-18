"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { RefreshCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Top-level App Router error boundary. Renders for any uncaught error
 * inside the dashboard (or any segment without its own error.tsx).
 * Keeps the app shell, gives the user something to do, and logs.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[error.tsx]", error);
    }
  }, [error]);

  return (
    <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-background px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-destructive/[0.06] blur-3xl"
      />
      <div className="w-full max-w-sm text-center">
        <Image
          src="/favicon.png"
          alt=""
          width={100}
          height={70}
          className="mx-auto mb-5 object-contain opacity-80 dark:invert"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-destructive/80">
          Er ging iets mis
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
          Onverwachte fout
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We zijn op de hoogte. Probeer het opnieuw — vaak helpt dat al.
        </p>
        {error.digest ? (
          <p className="mt-3 inline-block rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
            ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <RefreshCcw className="h-3.5 w-3.5" />
            Probeer opnieuw
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">
              <Home className="h-3.5 w-3.5" />
              Naar dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
