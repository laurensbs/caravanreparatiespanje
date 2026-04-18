import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Soft white panel that matches the Repair detail "edit section" look:
 * 2xl radius, hairline gray border, subtle shadow. Use this for every
 * settings sub-page section so the whole Settings area feels stitched
 * together with the rest of the app.
 */
export function SettingsPanel({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border dark:bg-card/[0.03]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Compact section heading for inside a SettingsPanel.
 * Title + optional icon + optional description + optional right-side action.
 */
export function SettingsSectionHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground dark:text-foreground">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground dark:text-muted-foreground/70">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Empty-state used by settings list panels (e.g. "No locations yet").
 */
export function SettingsEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center dark:border-border dark:bg-card/[0.02]",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/70 dark:bg-card/[0.06] dark:text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground dark:text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground dark:text-muted-foreground/70">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/**
 * Pill-styled list-grid item used by Locations / Tags / Users tiles.
 */
export function SettingsTile({
  children,
  onClick,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  index?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        animationDelay: `${index * 35}ms`,
        animationFillMode: "backwards",
      }}
      className={cn(
        "group relative flex w-full flex-col gap-1 rounded-2xl border border-border/60 bg-card p-4 text-left shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md active:scale-[0.99]",
        "dark:border-border dark:bg-card/[0.03] dark:hover:border-border",
        "motion-safe:animate-slide-up",
        className,
      )}
    >
      {children}
    </button>
  );
}
