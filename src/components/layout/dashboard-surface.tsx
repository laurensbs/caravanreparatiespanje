import { cn } from "@/lib/utils";

/**
 * Same visual language as {@link RepairDetail} cards: soft white panel, 2xl radius, gray border.
 * Use for list shells, filters bars, and page sections outside the repair editor.
 */
export const dashboardPanelClass =
  "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]";

/** Full-width canvas behind dashboard pages (matches repair detail `#F9FAFB` workspace). */
export function DashboardPageCanvas({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in min-h-[calc(100dvh-3.25rem)] bg-[#F9FAFB] px-3 py-4 dark:bg-background",
        "max-lg:mx-0 max-lg:px-3",
        "-mx-3 md:-mx-4 md:px-4",
        "print:mx-0 print:min-h-0 print:bg-white print:px-0 print:py-0",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-8">{children}</div>
    </div>
  );
}

/** Page title + subtitle aligned with repair detail typography. */
export function DashboardPageHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 print:hidden", className)}>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
        {title}
      </h1>
      {description ? (
        <div className="max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</div>
      ) : null}
    </div>
  );
}
