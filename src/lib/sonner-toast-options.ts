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
      "group rounded-xl border shadow-lg !p-4 !gap-3 !border-zinc-200 !bg-white !text-zinc-900 dark:!border-gray-800 dark:!bg-gray-900 dark:!text-gray-100",
    title: "!text-sm !font-semibold !text-zinc-900 dark:!text-gray-100",
    description: "!text-xs !leading-relaxed !text-zinc-600 dark:!text-gray-400",
    closeButton:
      "!left-auto !right-2 !top-3 !border-0 !bg-transparent !text-zinc-500 hover:!bg-zinc-100 dark:!text-gray-400 dark:hover:!bg-white/[0.06]",
    success: "!border-emerald-500/50 !bg-white dark:!bg-gray-900",
    error: "!border-red-500/50 !bg-white dark:!bg-gray-900",
    warning: "!border-amber-500/50 !bg-white dark:!bg-gray-900",
    info: "!border-sky-500/50 !bg-white dark:!bg-gray-900",
  },
};
