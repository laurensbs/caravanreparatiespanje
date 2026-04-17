import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="animate-fade-in space-y-5 sm:space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-56 sm:h-9" />
        <Skeleton className="h-3.5 w-64 opacity-70" />
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-100 shadow-sm dark:border-gray-800 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`flex flex-col gap-2 px-5 py-4 ${
              i > 0 ? "sm:border-l" : ""
            } ${i >= 2 ? "border-t sm:border-t-0" : ""} ${
              i === 1 ? "border-l" : ""
            } border-gray-100 dark:border-gray-800`}
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: "forwards" }}
          >
            <Skeleton className="h-2.5 w-20 rounded-full" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] opacity-0 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: "forwards" }}
          >
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3.5 w-8" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03] opacity-0 animate-fade-in"
        style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
      >
        <Skeleton className="mb-4 h-4 w-40" />
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
