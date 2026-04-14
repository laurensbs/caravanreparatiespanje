import type { HoldedInvoice, HoldedQuote } from "@/lib/holded/invoices";

/**
 * Shared filter logic for non-repair Holded documents.
 * Used across sync-payments cron, cleanup scripts, and UI actions.
 */

// Keywords that indicate a non-repair invoice (transport, storage, deposits, etc.)
const NON_REPAIR_TAG_PREFIXES = ["transport", "stalling"];

const NON_REPAIR_KEYWORDS = [
  "stalling", "storage", "reservering", "aanbetaling",
  "transport", "tarieven", "tarief",
  "huur", "verhuur", "rental",
  "extra kosten transport",
  "transport naar",
  "naar de camping",
];

/** Check if a Holded invoice is non-repair (transport, storage, etc.) */
export function isNonRepairInvoice(inv: HoldedInvoice): boolean {
  // Check tags
  const tagMatch = (inv.tags ?? []).some(tag => {
    const t = tag.toLowerCase();
    return NON_REPAIR_TAG_PREFIXES.some(prefix => t.includes(prefix));
  });
  if (tagMatch) return true;

  // Check description and item names + product names for non-repair keywords
  const textToCheck = [
    inv.desc ?? "",
    ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
    ...(inv.products ?? []).map(p => `${p.name ?? ""} ${p.desc ?? ""}`),
  ].join(" ").toLowerCase();

  return NON_REPAIR_KEYWORDS.some(kw => textToCheck.includes(kw));
}

/** Check if a Holded quote is non-repair */
export function isNonRepairQuote(q: HoldedQuote): boolean {
  const textToCheck = [
    q.desc ?? "",
    ...(q.products ?? []).map(p => `${p.name ?? ""} ${p.desc ?? ""}`),
  ].join(" ").toLowerCase();

  return NON_REPAIR_KEYWORDS.some(kw => textToCheck.includes(kw));
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
