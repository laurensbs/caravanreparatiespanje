import type { HoldedInvoice, HoldedQuote } from "@/lib/holded/invoices";

/**
 * Shared filter logic for non-repair Holded documents.
 * Used across sync-payments cron, cleanup scripts, and UI actions.
 *
 * Philosophy:
 *   - Be conservative. We'd rather link a borderline doc than silently drop a
 *     repair invoice. Anything that mentions "reparatie/onderhoud/inspection"
 *     is always treated as a repair, regardless of other lines.
 *   - Tag matches are EXACT (whole-word). "transport" tag != "transportkosten"
 *     description.
 */

// Holded tags that, when matched exactly, indicate a non-repair document.
const NON_REPAIR_EXACT_TAGS = new Set([
  "transport",
  "stalling",
  "storage",
  "huur",
  "verhuur",
  "rental",
  "reservering",
  "aanbetaling",
]);

// Generic non-repair keywords (used in description / line bodies).
const NON_REPAIR_KEYWORDS = [
  "stalling", "storage", "reservering", "aanbetaling",
  "tarieven", "tarief",
  "huur", "verhuur", "rental",
  "extra kosten transport",
  "transport naar",
  "naar de camping",
];

/** If ANY of these appear, doc is workshop billing (do not exclude). */
const REPAIR_BILLING_HINTS = [
  "reparatie",
  "repareren",
  "werkorder",
  "werkplaats",
  "caravan repair",
  "repair job",
  "onderhoud",
  "service",
  "inspection",
  "inspectie",
  "keuring",
  "wax",
  "uur arbeid",
  "labour",
  "labor",
  "manuur",
  "monteur",
];

function tagMatchesNonRepair(tag: string): boolean {
  const t = tag.toLowerCase().trim();
  if (NON_REPAIR_EXACT_TAGS.has(t)) return true;
  // Common compounds like "stalling-2026" / "transport_buiten"
  for (const exact of NON_REPAIR_EXACT_TAGS) {
    if (t === exact || t.startsWith(exact + "-") || t.startsWith(exact + "_") || t.startsWith(exact + " ")) {
      return true;
    }
  }
  return false;
}

function lineMentionsRepair(text: string): boolean {
  return REPAIR_BILLING_HINTS.some((h) => text.includes(h));
}

/** Check if a Holded invoice is non-repair (transport, storage, etc.) */
export function isNonRepairInvoice(inv: HoldedInvoice): boolean {
  const desc = (inv.desc ?? "").toLowerCase();
  const lines = [
    ...(inv.items ?? []).map((i) => `${i.name ?? ""} ${i.desc ?? ""}`.toLowerCase()),
    ...(inv.products ?? []).map((p) => `${p.name ?? ""} ${p.desc ?? ""}`.toLowerCase()),
  ];
  const all = [desc, ...lines].join(" ");

  // Repair hint anywhere ⇒ keep it.
  if (lineMentionsRepair(all)) return false;
  if (all.includes("fridge")) return false;

  // Exact non-repair tag ⇒ exclude.
  const tagMatch = (inv.tags ?? []).some(tagMatchesNonRepair);
  if (tagMatch) return true;

  // Line-level: count lines that look ONLY like transport/stalling.
  const nonRepairLineCount = lines.filter((line) =>
    NON_REPAIR_KEYWORDS.some((kw) => line.includes(kw)) && !lineMentionsRepair(line),
  ).length;
  const totalLines = lines.length;

  // If every line is non-repair, it's non-repair.
  if (totalLines > 0 && nonRepairLineCount === totalLines) return true;

  const keywordHits = NON_REPAIR_KEYWORDS.filter((kw) => all.includes(kw));

  // Single keyword hit on a multi-line invoice = repair (we already verified no
  // repair hints exist; still err on the side of keeping it).
  if (totalLines >= 2 && keywordHits.length <= 1) return false;

  // No lines at all: rely on description keywords.
  if (totalLines === 0) return keywordHits.length > 0;

  return keywordHits.length >= 2 && nonRepairLineCount > 0;
}

/** Check if a Holded quote is non-repair */
export function isNonRepairQuote(q: HoldedQuote): boolean {
  const desc = (q.desc ?? "").toLowerCase();
  const lines = (q.products ?? []).map((p) => `${p.name ?? ""} ${p.desc ?? ""}`.toLowerCase());
  const all = [desc, ...lines].join(" ");

  if (lineMentionsRepair(all)) return false;
  if (all.includes("fridge")) return false;

  const tagged = false; // quotes don't expose tags via API; description-only.
  if (tagged) return true;

  const nonRepairLineCount = lines.filter((line) =>
    NON_REPAIR_KEYWORDS.some((kw) => line.includes(kw)) && !lineMentionsRepair(line),
  ).length;
  const totalLines = lines.length;

  if (totalLines > 0 && nonRepairLineCount === totalLines) return true;

  const keywordHits = NON_REPAIR_KEYWORDS.filter((kw) => all.includes(kw));
  if (totalLines >= 2 && keywordHits.length <= 1) return false;
  if (totalLines === 0) return keywordHits.length > 0;

  return keywordHits.length >= 2 && nonRepairLineCount > 0;
}

/** Check if a Holded invoice has no meaningful content (blank API response) */
export function isBlankInvoice(inv: HoldedInvoice): boolean {
  const hasDesc = inv.desc && inv.desc.trim().length > 3;
  const hasItems = (inv.items ?? []).some(i => i.name && i.name.trim().length > 3);
  const hasProducts = (inv.products ?? []).some(p => p.name && p.name.trim().length > 3);
  return !hasDesc && !hasItems && !hasProducts;
}

/** Filter an array of invoices to only repair-related ones */
export function filterRepairInvoices(invoices: HoldedInvoice[]): HoldedInvoice[] {
  return invoices.filter(inv => !isNonRepairInvoice(inv));
}

/** Filter an array of quotes to only repair-related ones */
export function filterRepairQuotes(quotes: HoldedQuote[]): HoldedQuote[] {
  return quotes.filter(q => !isNonRepairQuote(q));
}
