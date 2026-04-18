import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Same visual language as {@link RepairDetail} cards: soft white panel, 2xl radius, gray border.
 * Use for list shells, filters bars, and page sections outside the repair editor.
 */
export const dashboardPanelClass =
  "rounded-2xl border border-border/60 bg-card text-card-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_1px_0_0_rgba(255,255,255,0.6)_inset] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.30),0_1px_0_0_rgba(255,255,255,0.04)_inset]";

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
        "animate-fade-in min-h-[calc(100dvh-3.25rem)] bg-background px-3 py-4 sm:px-4 sm:py-5",
        "max-lg:mx-0 max-lg:px-3",
        "-mx-3 md:-mx-4 md:px-4",
        "print:mx-0 print:min-h-0 print:bg-card print:px-0 print:py-0",
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-3xl">
          {title}
        </h1>
        {metadata ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            {metadata}
          </div>
        ) : null}
        {description ? (
          <div className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
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
    default: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-destructive",
    sky: "text-foreground/80",
    violet: "text-violet-600 dark:text-violet-400",
  };
  return (
    <div
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] sm:grid-cols-4",
        className,
      )}
    >
      {items.map((item, i) => {
        const body = (
          <div className="flex flex-col gap-0.5 px-5 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
              {item.label}
            </p>
            <p
              className={cn(
                "text-[22px] font-semibold tabular-nums leading-none tracking-[-0.02em] mt-1.5",
                toneClass[item.tone ?? "default"],
              )}
            >
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-1 text-[11px] text-muted-foreground/80">{item.hint}</p>
            ) : null}
          </div>
        );
        const classes = cn(
          "relative transition-colors",
          "border-border/60",
          i > 0 && "sm:border-l",
          i >= 2 && "border-t sm:border-t-0",
          i === 1 && "border-l",
          item.href && "hover:bg-muted/50",
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
        "inline-flex w-full overflow-x-auto whitespace-nowrap rounded-xl border border-border/60 bg-muted/50 p-1 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] sm:w-auto",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        const content = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-lg font-medium tracking-[-0.005em] transition-all",
              base,
              active
                ? "bg-card text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(255,255,255,0.6)_inset] ring-1 ring-border/40 dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.30)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.icon ? <span className="shrink-0 opacity-70">{tab.icon}</span> : null}
            <span className="truncate">{tab.label}</span>
            {typeof tab.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-foreground/[0.06] text-foreground"
                    : "bg-foreground/[0.04] text-muted-foreground",
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
              className="outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-lg"
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
            className="outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-lg"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
