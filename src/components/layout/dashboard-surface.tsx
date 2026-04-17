import Link from "next/link";
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
        "animate-fade-in min-h-[calc(100dvh-3.25rem)] bg-[#F9FAFB] px-3 py-4 sm:px-4 sm:py-5 dark:bg-background",
        "max-lg:mx-0 max-lg:px-3",
        "-mx-3 md:-mx-4 md:px-4",
        "print:mx-0 print:min-h-0 print:bg-white print:px-0 print:py-0",
        className,
      )}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-8">{children}</div>
    </div>
  );
}

/**
 * Mollie-flavoured page header.
 *
 * - Optional `eyebrow` chip for quick context (e.g. "Operations", "Address book").
 * - `metadata` row for tiny facts next to the title (count, last sync, etc.).
 * - `actions` slot for the primary action button.
 */
export function DashboardPageHeader({
  title,
  description,
  eyebrow,
  metadata,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  metadata?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 print:hidden",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
          {title}
        </h1>
        {metadata ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500 dark:text-gray-400">
            {metadata}
          </div>
        ) : null}
        {description ? (
          <div className="max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 sm:pt-1">{actions}</div> : null}
    </div>
  );
}

/**
 * Compact connected stat strip (Mollie-style): one rounded panel with thin
 * vertical dividers between stats instead of four separate cards.
 */
export function StatStrip({
  items,
  className,
}: {
  items: {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    tone?: "default" | "emerald" | "amber" | "red" | "sky" | "violet";
    href?: string;
  }[];
  className?: string;
}) {
  const toneClass: Record<NonNullable<typeof items[number]["tone"]>, string> = {
    default: "text-gray-900 dark:text-gray-100",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    sky: "text-sky-600 dark:text-sky-400",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03] sm:grid-cols-4",
        className,
      )}
    >
      {items.map((item, i) => {
        const body = (
          <div className="flex flex-col gap-0.5 px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {item.label}
            </p>
            <p
              className={cn(
                "text-[22px] font-semibold tabular-nums leading-none mt-1.5",
                toneClass[item.tone ?? "default"],
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{item.hint}</p>
            ) : null}
          </div>
        );
        const classes = cn(
          "relative transition-colors",
          // Dividers: border between, wrapping rows on small screens.
          "border-gray-100 dark:border-gray-800",
          i > 0 && "sm:border-l",
          i >= 2 && "border-t sm:border-t-0",
          i === 1 && "border-l",
          item.href && "hover:bg-gray-50 dark:hover:bg-white/[0.04]",
        );
        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className={classes}>
              {body}
            </Link>
          );
        }
        return (
          <div key={item.label} className={classes}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Segmented tab control (pill-group). Each tab can be a link (server-driven)
 * or a button (local state).
 */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  hrefFor,
  className,
  size = "md",
}: {
  tabs: { value: T; label: React.ReactNode; count?: number; icon?: React.ReactNode }[];
  value: T;
  onValueChange?: (v: T) => void;
  /** If provided, each tab renders as a Link. */
  hrefFor?: (v: T) => string;
  className?: string;
  size?: "sm" | "md";
}) {
  const base =
    size === "sm"
      ? "h-8 px-3 text-[12px]"
      : "h-10 px-4 text-[13px]";
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex w-full overflow-x-auto whitespace-nowrap rounded-xl border border-gray-100 bg-gray-50/80 p-1 text-gray-500 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-400 sm:w-auto",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const content = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-lg font-medium transition-all",
              base,
              active
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-100 dark:ring-white/[0.04]"
                : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100",
            )}
          >
            {tab.icon ? <span className="shrink-0 opacity-70">{tab.icon}</span> : null}
            <span className="truncate">{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-200"
                    : "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </span>
        );
        if (hrefFor) {
          return (
            <Link
              key={tab.value}
              role="tab"
              aria-selected={active}
              href={hrefFor(tab.value)}
              className="outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange?.(tab.value)}
            className="outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
