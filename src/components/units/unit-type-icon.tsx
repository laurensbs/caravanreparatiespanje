"use client";

import { Caravan, Truck, Van, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnitType } from "@/types";
import { UNIT_TYPE_LABELS } from "@/types";

const pill: Record<UnitType, string> = {
  caravan: "border-border bg-muted/600/10 text-foreground",
  trailer: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  camper: "border-violet-500/25 bg-violet-500/10 text-violet-800 dark:text-violet-300",
  unknown: "border-border bg-muted text-muted-foreground",
};

function normalizeUnitType(raw: string | null | undefined): UnitType {
  if (raw === "caravan" || raw === "trailer" || raw === "camper" || raw === "unknown") return raw;
  return "unknown";
}

function TypeGlyph({ t, className }: { t: UnitType; className?: string }) {
  const stroke = 1.75;
  switch (t) {
    case "caravan":
      return <Caravan className={className} strokeWidth={stroke} />;
    case "trailer":
      return <Truck className={className} strokeWidth={stroke} />;
    case "camper":
      return <Van className={className} strokeWidth={stroke} />;
    default:
      return <CircleHelp className={className} strokeWidth={stroke} />;
  }
}

/** Square icon tile for list rows — title/aria give the type name */
export function UnitTypeIconBadge({
  unitType,
  size = "md",
  className,
}: {
  unitType: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = normalizeUnitType(unitType ?? undefined);
  const label = UNIT_TYPE_LABELS[t];
  const box =
    size === "sm"
      ? "h-9 w-9 rounded-lg [&_svg]:h-4 [&_svg]:w-4"
      : "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border touch-manipulation",
        box,
        pill[t],
        className,
      )}
      title={label}
      aria-label={label}
    >
      <TypeGlyph t={t} className="shrink-0" />
    </div>
  );
}
