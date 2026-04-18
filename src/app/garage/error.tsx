"use client";

import { useEffect } from "react";

export default function GarageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[garage error]", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] text-2xl">
          ⚠
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Even niet</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Iets liep mis. Tik op opnieuw om verder te gaan — je werk is
          opgeslagen.
        </p>
        {error.digest ? (
          <p className="mt-3 inline-block rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10px] text-white/50">
            ref · {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-stone-950 transition-all active:scale-[0.97]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
