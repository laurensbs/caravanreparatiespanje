import { ExternalLink } from "lucide-react";

interface HoldedHintProps {
  children: React.ReactNode;
  /** "info" = neutral teal hint, "sync" = indicates active sync, "readonly" = data from Holded */
  variant?: "info" | "sync" | "readonly";
  className?: string;
}

const VARIANT_STYLES = {
  info: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300",
  sync: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300",
  readonly: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300",
};

export function HoldedHint({ children, variant = "info", className }: HoldedHintProps) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${VARIANT_STYLES[variant]} ${className ?? ""}`}>
      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
      <div>{children}</div>
    </div>
  );
}

export function HoldedBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
      <ExternalLink className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
