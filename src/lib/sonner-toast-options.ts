import type { ToasterProps } from "sonner";

/**
 * Sonner picks up the active theme via the Toaster's `theme` prop. We pass
 * `theme="system"` from the dashboard layout so it follows the user's chosen
 * theme (light/dark). The class names below give us a high-contrast, rounded
 * Mollie-style panel in either mode.
 *
 * Note: a pair of html-scoped overrides in globals.css guarantees a readable
 * background even when Sonner's own variables drift.
 */
export const sonnerToastOptions: NonNullable<ToasterProps["toastOptions"]> = {
  classNames: {
    toast:
      "group rounded-xl border !p-4 !gap-3 !border-border/70 !bg-card !text-foreground shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18),0_2px_6px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)]",
    title: "!text-sm !font-semibold !tracking-[-0.01em] !text-foreground",
    description: "!text-xs !leading-relaxed !text-muted-foreground",
    closeButton:
      "!left-auto !right-2 !top-3 !border-0 !bg-transparent !text-muted-foreground hover:!bg-muted",
    success: "!border-emerald-500/40",
    error: "!border-destructive/50",
    warning: "!border-amber-500/40",
    info: "!border-sky-500/40",
  },
};
