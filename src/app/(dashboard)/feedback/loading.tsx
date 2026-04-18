import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-8 w-36 sm:h-9" />
          <Skeleton className="h-3.5 w-64 opacity-70" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border dark:bg-card/[0.03]">
        <div className="flex items-center justify-end border-b border-border/60 px-4 py-3 dark:border-border">
          <Skeleton className="h-10 w-32 rounded-xl sm:h-9" />
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "forwards" }}
            >
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
