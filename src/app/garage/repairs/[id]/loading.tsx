export default function GarageRepairDetailLoading() {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-3 pb-24 pt-4 text-white animate-fade-in sm:px-5 sm:pt-5">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between">
          <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          <div className="h-7 w-32 animate-pulse rounded-lg bg-white/10" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        </header>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-xl bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-28 animate-pulse rounded bg-white/10 opacity-70" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-white/10"
            />
          ))}
        </div>

        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 opacity-0 animate-fade-in"
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "forwards" }}
          >
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-white/10" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/10 opacity-70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
