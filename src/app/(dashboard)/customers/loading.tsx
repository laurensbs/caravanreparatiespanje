import { Users } from "lucide-react";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-muted ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

export default function CustomersLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <Shimmer className="h-7 w-32" />
            <Shimmer className="h-3.5 w-20" />
          </div>
        </div>
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>
      <Shimmer className="h-12 w-full rounded-xl" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <Shimmer className="h-10 w-full rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-5 w-8 rounded-full" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-4 w-36 hidden md:block" />
            <Shimmer className="h-3.5 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
