import { cn } from "@/lib/utils";

/**
 * Mollie-style skeleton primitive: flat rounded block with a slow pulse, no
 * heavy shimmer. Used by all loading.tsx files so the dashboard shows the
 * same skeleton vocabulary during server-component suspense.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.05]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Standard loading shell for dashboard list pages. Mirrors the layout the real
 * page renders (header, stat strip, table/list) so the transition into the
 * actual content feels like content painting in rather than replacing a
 * placeholder.
 */
export function DashboardListSkeleton({
  showStats = true,
  rowCount = 7,
  hasTitle = true,
}: {
  showStats?: boolean;
  rowCount?: number;
  hasTitle?: boolean;
}) {
  return (
    <div className="animate-fade-in space-y-5 sm:space-y-8">
      {hasTitle ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-8 w-48 sm:h-9" />
            <Skeleton className="h-3.5 w-64 opacity-70" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl sm:w-36" />
        </div>
      ) : null}

      {showStats ? (
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-100 shadow-sm dark:border-gray-800 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-2 px-5 py-4",
                i > 0 && "sm:border-l border-gray-100 dark:border-gray-800",
                i >= 2 && "border-t sm:border-t-0",
                i === 1 && "border-l",
              )}
            >
              <Skeleton className="h-2.5 w-16 rounded-full" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm dark:border-gray-800">
        <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3 dark:border-gray-800 dark:bg-white/[0.02]">
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: rowCount }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3.5 opacity-0 animate-fade-in"
              style={{
                animationDelay: `${i * 40}ms`,
                animationFillMode: "forwards",
              }}
            >
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="hidden h-3.5 w-28 sm:block" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading shell for a detail page (e.g. /repairs/[id], /customers/[id]).
 * Two-column layout that degrades to stacked on mobile.
 */
export function DashboardDetailSkeleton() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-8 w-2/3 sm:h-9 sm:w-1/3" />
        <Skeleton className="h-3.5 w-1/2 opacity-70" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
