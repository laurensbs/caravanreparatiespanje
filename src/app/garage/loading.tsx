import { Skeleton } from "@/components/ui/skeleton";

/**
 * Garage Today loading state. The portal is styled dark, so skeletons use
 * a lighter gray-on-slate tone. We mirror the real layout (top bar → stat
 * strip → segmented tabs → job cards) so the handoff feels seamless.
 */
export default function GarageLoading() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 px-3 pb-20 pt-4 text-white animate-fade-in sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="h-7 w-40 animate-pulse rounded-lg bg-white/10" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          </div>
        </header>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <div className="h-2.5 w-12 animate-pulse rounded-full bg-white/10" />
              <div className="mt-2 h-6 w-10 animate-pulse rounded-md bg-white/10" />
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-white/10"
            />
          ))}
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-16 animate-pulse rounded-md bg-white/10" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-white/10" />
                  </div>
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/10 opacity-70" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
