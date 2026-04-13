import { ExternalLink } from "lucide-react";

interface HoldedHintProps {
  children: React.ReactNode;
  /** "info" = neutral teal hint, "sync" = indicates active sync, "readonly" = data from Holded */
  variant?: "info" | "sync" | "readonly";
  className?: string;
}

const VARIANT_STYLES = {
  info: "bg-emerald-50/60 border-emerald-100 text-emerald-800",
  sync: "bg-sky-50/60 border-sky-100 text-sky-800",
  readonly: "bg-amber-50/60 border-amber-100 text-amber-800",
};

const ICON_STYLES = {
  info: "text-emerald-500",
  sync: "text-sky-500",
  readonly: "text-amber-500",
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
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
      <ExternalLink className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}
