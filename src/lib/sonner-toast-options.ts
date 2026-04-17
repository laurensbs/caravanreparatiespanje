import type { ToasterProps } from "sonner";

/** Shared Sonner styling (compact, high-contrast, type-accent borders). */
export const sonnerToastOptions: NonNullable<ToasterProps["toastOptions"]> = {
  classNames: {
    toast:
      "group rounded-xl border border-border/80 bg-background/95 text-foreground shadow-lg backdrop-blur-sm !p-4 !gap-3",
    title: "!text-sm !font-semibold !text-foreground",
    description: "!text-xs !text-muted-foreground !leading-relaxed",
    closeButton:
      "!left-auto !right-2 !top-3 !border-0 !bg-transparent !text-muted-foreground hover:!bg-muted",
    success: "!border-emerald-500/25",
    error: "!border-red-500/30",
    warning: "!border-amber-500/25",
    info: "!border-cyan-500/25",
  },
};
