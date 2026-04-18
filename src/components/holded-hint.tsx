import { ExternalLink } from "lucide-react";

interface HoldedHintProps {
  children: React.ReactNode;
  /** "info" = neutral teal hint, "sync" = indicates active sync, "readonly" = data from Holded */
  variant?: "info" | "sync" | "readonly";
  className?: string;
}

// Neutral, Mollie-flavoured hint: subtle grey surface with a small coloured dot
// indicating the kind of relationship (sync / readonly / info). Keeps the page
// calm instead of flashing amber banners across every list.
const DOT_STYLES = {
  info: "bg-emerald-400",
  sync: "bg-foreground/80",
  readonly: "bg-amber-400",
};

const ICON_STYLES = {
  info: "text-emerald-500",
  sync: "text-foreground/80",
  readonly: "text-amber-500",
};

export function HoldedHint({ children, variant = "info", className }: HoldedHintProps) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/40/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground dark:border-border dark:bg-card/[0.03] dark:text-muted-foreground/50 ${className ?? ""}`}
    >
      <span className="relative mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <span className={`absolute inset-0 rounded-full opacity-20 ${DOT_STYLES[variant]}`} />
        <ExternalLink className={`h-3 w-3 ${ICON_STYLES[variant]}`} />
      </span>
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
