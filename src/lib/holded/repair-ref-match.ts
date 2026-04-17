/**
 * Match workshop / import references (public code, spreadsheet row id) against
 * Holded document text. Used by invoice + quote sync so documents that mention
 * "236" or "WB-PF-50" still link when publicCode was never copied into the DB.
 */

import type { HoldedInvoice, HoldedQuote } from "@/lib/holded/invoices";

export type RepairHoldedMatchFields = {
  id: string;
  publicCode: string | null;
  spreadsheetInternalId: string | null;
  title: string | null;
  registration: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

export function compactAlnum(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Panel public code, including compact form (WB-PF-50 vs wb pf 50 in Holded). */
export function repairPublicCodeAppearsInText(publicCode: string | null, haystackLower: string): boolean {
  if (!publicCode?.trim()) return false;
  const p = publicCode.trim().toLowerCase();
  if (haystackLower.includes(p)) return true;
  const compact = compactAlnum(p);
  if (compact.length >= 5 && compactAlnum(haystackLower).includes(compact)) return true;
  return false;
}

/**
 * Workshop / Master sheet row id in invoice lines or description.
 * Purely numeric ids use digit boundaries so "236" does not match inside "12364".
 */
export function matchesSpreadsheetRefInText(rawRef: string, haystackLower: string): boolean {
  const ref = rawRef.trim().toLowerCase();
  if (ref.length < 2) return false;
  const hay = haystackLower;
  if (ref.length >= 5) {
    return hay.includes(ref);
  }
  if (/^\d+$/.test(ref)) {
    return new RegExp(`(?:^|[^0-9])${ref}(?:[^0-9]|$)`).test(hay);
  }
  const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped).test(hay);
}

/** Lowercased blob used to match repairs to Holded invoices (detail payload). */
export function buildHoldedInvoiceHaystackLower(inv: HoldedInvoice): string {
  return [
    inv.desc ?? "",
    inv.docNumber ?? "",
    inv.contactName ?? "",
    ...(inv.items ?? []).map((i) => `${i.name ?? ""} ${i.desc ?? ""}`),
    ...(inv.products ?? []).map((p) => `${p.name ?? ""} ${p.desc ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

/** Lowercased blob for Holded quotes / estimates. */
export function buildHoldedQuoteHaystackLower(q: HoldedQuote): string {
  return [
    q.desc ?? "",
    q.docNumber ?? "",
    q.contactName ?? "",
    ...(q.products ?? []).map((p) => `${p.name ?? ""} ${p.desc ?? ""}`),
  ]
    .join(" ")
    .toLowerCase();
}

/** Score one repair against one Holded document body (scripts + inverse pick). */
export function scoreRepairMatchToHoldedHaystack(
  c: RepairHoldedMatchFields,
  haystackLower: string,
  documentDateMs: number | null,
): number {
  let s = 0;
  if (repairPublicCodeAppearsInText(c.publicCode, haystackLower)) s += 10_000;
  if (c.spreadsheetInternalId?.trim() && matchesSpreadsheetRefInText(c.spreadsheetInternalId, haystackLower)) {
    s += 9000;
  }
  const reg = c.registration?.trim().toLowerCase();
  if (reg && reg.length >= 3 && haystackLower.includes(reg)) s += 5000;

  const t = c.title?.trim().toLowerCase();
  if (t && t.length > 3 && haystackLower.includes(t)) s += 3000;
  else if (t && t.length > 8) {
    const words = t.split(/\s+/).filter((w) => w.length > 4);
    let hits = 0;
    for (const w of words) {
      if (haystackLower.includes(w)) hits++;
    }
    if (hits >= 2) s += 2000;
    else if (hits === 1) s += 800;
  }

  if (documentDateMs != null) {
    const repairMs = (c.completedAt ?? c.createdAt).getTime();
    const distDays = Math.abs(documentDateMs - repairMs) / (24 * 60 * 60 * 1000);
    s += Math.max(0, Math.round(450 - distDays * 12));
  }
  return s;
}

/**
 * When several Holded invoices could belong to one repair, pick the invoice whose
 * text best matches (same scoring as sync). Returns null if nothing clears the bar.
 */
export function pickHoldedInvoiceForRepairFromCandidates(
  repair: RepairHoldedMatchFields,
  invoicesWithDetail: HoldedInvoice[],
): HoldedInvoice | null {
  if (invoicesWithDetail.length === 0) return null;
  const scored = invoicesWithDetail.map((inv) => ({
    inv,
    score: scoreRepairMatchToHoldedHaystack(repair, buildHoldedInvoiceHaystackLower(inv), inv.date * 1000),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const second = scored[1];
  if (best.score >= 5000) {
    if (second && second.score >= 5000 && best.score - second.score < 80) return null;
    return best.inv;
  }
  if (invoicesWithDetail.length === 1 && best.score >= 400) return best.inv;
  if (best.score >= 2000 && (!second || best.score - second.score >= 400)) return best.inv;
  if (best.score >= 800 && (!second || best.score - second.score >= 500)) return best.inv;
  return null;
}

/**
 * Pick the best repair for a Holded document body, or null if ambiguous / too weak.
 * When several open jobs exist for one customer, weak date-only matches are rejected.
 */
export function pickRepairForHoldedDocument(
  haystackLower: string,
  candidates: RepairHoldedMatchFields[],
  documentDateMs: number | null,
): RepairHoldedMatchFields | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => ({
    c,
    score: scoreRepairMatchToHoldedHaystack(c, haystackLower, documentDateMs),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const second = scored[1];

  const strong = best.score >= 5000;
  if (strong) {
    if (second && second.score >= 5000 && best.score - second.score < 80) {
      return null;
    }
    return best.c;
  }

  if (candidates.length === 1 && best.score >= 400) {
    return best.c;
  }

  if (best.score >= 2000 && (!second || best.score - second.score >= 400)) {
    return best.c;
  }

  if (best.score >= 800 && (!second || best.score - second.score >= 500)) {
    return best.c;
  }

  return null;
}

/** First repair that matches public code or spreadsheet ref (legacy linear scan). */
export function findRepairByRefInHoldedText(
  haystackLower: string,
  candidates: RepairHoldedMatchFields[],
): RepairHoldedMatchFields | undefined {
  return candidates.find(
    (r) =>
      repairPublicCodeAppearsInText(r.publicCode, haystackLower) ||
      (!!r.spreadsheetInternalId?.trim() && matchesSpreadsheetRefInText(r.spreadsheetInternalId, haystackLower)),
  );
}
