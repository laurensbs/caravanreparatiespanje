import type { ToasterProps } from "sonner";

/**
 * Sonner applies its own dark-theme toast colors when the OS/dashboard is dark.
 * We force a light, high-contrast panel via ! modifiers so text stays readable everywhere.
 */
export const sonnerToastOptions: NonNullable<ToasterProps["toastOptions"]> = {
  classNames: {
    toast:
      "group rounded-xl border shadow-lg !p-4 !gap-3 !border-zinc-200 !bg-white !text-zinc-900",
    title: "!text-sm !font-semibold !text-zinc-900",
    description: "!text-xs !leading-relaxed !text-zinc-600",
    closeButton:
      "!left-auto !right-2 !top-3 !border-0 !bg-transparent !text-zinc-500 hover:!bg-zinc-100",
    success: "!border-emerald-500/50 !bg-white",
    error: "!border-red-500/50 !bg-white",
    warning: "!border-amber-500/50 !bg-white",
    info: "!border-sky-500/50 !bg-white",
  },
};
