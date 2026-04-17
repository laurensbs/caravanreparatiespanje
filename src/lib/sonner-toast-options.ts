import type { ToasterProps } from "sonner";

/** Shared Sonner styling (compact, readable on light + dark; avoid low-contrast defaults). */
export const sonnerToastOptions: NonNullable<ToasterProps["toastOptions"]> = {
  classNames: {
    toast:
      "group rounded-xl border shadow-lg backdrop-blur-sm !p-4 !gap-3 border-border bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 dark:border-zinc-800",
    title: "!text-sm !font-semibold !text-zinc-950 dark:!text-zinc-50",
    description: "!text-xs !leading-relaxed !text-zinc-600 dark:!text-zinc-300",
    closeButton:
      "!left-auto !right-2 !top-3 !border-0 !bg-transparent !text-zinc-500 hover:!bg-zinc-100 dark:!text-zinc-400 dark:hover:!bg-zinc-800",
    success: "!border-emerald-500/40",
    error: "!border-red-500/40",
    warning: "!border-amber-500/40",
    info: "!border-cyan-500/40",
  },
};
