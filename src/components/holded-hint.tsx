import { ExternalLink } from "lucide-react";

interface HoldedHintProps {
  children: React.ReactNode;
  /** "info" = neutral teal hint, "sync" = indicates active sync, "readonly" = data from Holded */
  variant?: "info" | "sync" | "readonly";
  className?: string;
}

const VARIANT_STYLES = {
  info: "bg-emerald-50/80 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  sync: "bg-sky-50/80 border-sky-300 text-sky-900 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300",
  readonly: "bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
};

const ICON_STYLES = {
  info: "text-emerald-600 dark:text-emerald-400",
  sync: "text-sky-600 dark:text-sky-400",
  readonly: "text-amber-600 dark:text-amber-400",
};

export function HoldedHint({ children, variant = "info", className }: HoldedHintProps) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${VARIANT_STYLES[variant]} ${className ?? ""}`}>
      <ExternalLink className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${ICON_STYLES[variant]}`} />
      <div>{children}</div>
    </div>
  );
}

export function HoldedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
      <ExternalLink className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
