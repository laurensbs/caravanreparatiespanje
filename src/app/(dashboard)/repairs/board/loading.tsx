import { Skeleton } from "@/components/ui/skeleton";

const columns = [
  "Backlog",
  "Todo",
  "In progress",
  "Waiting parts",
  "Quality check",
  "Done",
];

export default function BoardLoading() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-8 w-36 sm:h-9" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((c, col) => (
          <div
            key={c}
            className="min-w-[260px] flex-1 rounded-2xl border border-border/60 bg-muted/30 p-3 dark:border-border dark:bg-card/[0.02]"
            style={{ animationDelay: `${col * 60}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-3.5 w-20 rounded-full" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 + (col % 3) }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 bg-card p-3 opacity-0 animate-fade-in dark:border-border dark:bg-card/[0.03]"
                  style={{
                    animationDelay: `${col * 60 + i * 40}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  <Skeleton className="mb-2 h-3.5 w-3/4" />
                  <Skeleton className="mb-2 h-3 w-1/2 opacity-70" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
