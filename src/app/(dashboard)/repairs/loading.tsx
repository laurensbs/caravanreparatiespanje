import { Wrench } from "lucide-react";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-muted ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

export default function RepairsLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Wrench className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <Shimmer className="h-7 w-28" />
            <Shimmer className="h-3.5 w-20" />
          </div>
        </div>
        <Shimmer className="h-9 w-28 rounded-lg" />
      </div>
      <Shimmer className="h-12 w-full rounded-lg" />
      <div className="rounded-lg border bg-card overflow-hidden">
        <Shimmer className="h-10 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t px-4 py-3">
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-4 w-16" />
            <Shimmer className="h-4 w-40" />
            <Shimmer className="h-5 w-20 rounded-full" />
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-4 w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
