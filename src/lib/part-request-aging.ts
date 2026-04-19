/**
 * Shared aging logic for part_requests. Centralised so the dashboard
 * widget, the Part requests tab and the server-side filter all use the
 * exact same thresholds — otherwise "stale" means three different
 * things in three different places.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A request is "stale" once it's been waiting at least this long. */
export const STALE_AFTER_DAYS = 3;
/** Loud alarm: well past chasing-once-was-enough. */
export const URGENT_AFTER_DAYS = 7;
/** Marking "Chased" hides the row from the widget for this long. */
export const CHASE_COOLDOWN_HOURS = 24;

export type PartRequestAgingInput = {
  status: string;
  createdAt: Date | string;
  expectedDelivery?: Date | string | null;
  lastChasedAt?: Date | string | null;
};

export type PartRequestAging = {
  daysOld: number;
  isOpen: boolean;
  isOverdue: boolean;
  isStale: boolean;
  isUrgent: boolean;
  needsChase: boolean;
  chaseCooldownActive: boolean;
  /** "neutral" | "warn" | "danger" — drives chip colour. */
  severity: "neutral" | "warn" | "danger";
};

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getPartRequestAging(
  input: PartRequestAgingInput,
  now: Date = new Date(),
): PartRequestAging {
  const created = toDate(input.createdAt) ?? now;
  const expected = toDate(input.expectedDelivery);
  const chased = toDate(input.lastChasedAt);

  const daysOld = Math.max(0, Math.floor((now.getTime() - created.getTime()) / DAY));
  const isOpen =
    input.status === "requested" ||
    input.status === "ordered" ||
    input.status === "shipped";

  const isOverdue = isOpen && expected !== null && expected.getTime() < now.getTime();
  const isStale = isOpen && daysOld >= STALE_AFTER_DAYS;
  const isUrgent = isOpen && daysOld >= URGENT_AFTER_DAYS;

  const chaseCooldownActive =
    chased !== null &&
    now.getTime() - chased.getTime() < CHASE_COOLDOWN_HOURS * 60 * 60 * 1000;

  // "Needs chase" = something we'd want to nag about, AND we haven't
  // already done a chase in the last 24h.
  const needsChase = isOpen && (isStale || isOverdue) && !chaseCooldownActive;

  const severity: PartRequestAging["severity"] = !isOpen
    ? "neutral"
    : isUrgent || isOverdue
    ? "danger"
    : isStale
    ? "warn"
    : "neutral";

  return {
    daysOld,
    isOpen,
    isOverdue,
    isStale,
    isUrgent,
    needsChase,
    chaseCooldownActive,
    severity,
  };
}

/** Short label for the aging chip ("3d", "1w+"). Empty when not open. */
export function formatAgeShort(daysOld: number, isOpen: boolean): string {
  if (!isOpen) return "";
  if (daysOld < 1) return "today";
  if (daysOld < 7) return `${daysOld}d`;
  const weeks = Math.floor(daysOld / 7);
  return weeks >= 4 ? "1m+" : `${weeks}w+`;
}
