import type { ParsedRow } from "./parse-workbook";

/**
 * Identity resolution for customers and units.
 *
 * When importing messy spreadsheet data, we need to:
 * 1. Normalize names for matching (trim, lowercase, collapse spaces)
 * 2. Group rows by customer identity (fuzzy matching on name)
 * 3. Create provisional customer/unit records when no match exists
 * 4. Detect potential duplicate rows across sheets
 */

// ─── Text normalization ─────────────────────────────────────────────────────

/**
 * Normalize a customer name for matching purposes.
 * Collapses whitespace, lowercases, removes common prefixes/suffixes.
 */
export function normalizeCustomerName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(mr\.?|mrs\.?|ms\.?|dhr\.?|mevr\.?)\s+/i, "")
    .replace(/\s+(jr\.?|sr\.?)$/i, "")
    .trim();
}

/**
 * Normalize a registration plate for matching.
 * Removes dashes, spaces, lowercases.
 */
export function normalizeRegistration(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s\-\.]+/g, "");
}

/**
 * Parse a registration field that may contain "REG - BRAND MODEL".
 * Common format in the spreadsheet: "WR-SV-46 - LMC"
 */
export function parseRegistrationField(raw: string): {
  registration: string | null;
  brand: string | null;
  model: string | null;
} {
  if (!raw || raw.trim() === "") {
    return { registration: null, brand: null, model: null };
  }

  // Pattern: "XX-XX-XX - Brand Model" or "XX-XX-XX - Brand"
  const dashSplit = raw.split(/\s+-\s+/);
  if (dashSplit.length >= 2) {
    const regPart = dashSplit[0].trim();
    const brandModel = dashSplit.slice(1).join(" - ").trim();

    // Try to split brand and model
    const brandParts = brandModel.split(/\s+/);
    const brand = brandParts[0] || null;
    const model = brandParts.length > 1 ? brandParts.slice(1).join(" ") : null;

    return { registration: regPart, brand, model };
  }

  // Just a registration or just a brand/model
  // Dutch plates typically have pattern: XX-XX-XX or X-XXX-XX etc.
  if (/^[A-Z0-9]{1,3}[\-\s][A-Z0-9]{1,4}[\-\s][A-Z0-9]{1,3}$/i.test(raw.trim())) {
    return { registration: raw.trim(), brand: null, model: null };
  }

  // Might just be a brand/model without registration
  return { registration: raw.trim(), brand: null, model: null };
}

// ─── Customer resolution ────────────────────────────────────────────────────

export interface CustomerCandidate {
  name: string;
  normalizedName: string;
  /** All row indices that reference this customer */
  rowIndices: number[];
}

/**
 * Group rows by customer identity using normalized name matching.
 * Returns a map of normalizedName → CustomerCandidate.
 */
export function resolveCustomers(
  rows: ParsedRow[]
): Map<string, CustomerCandidate> {
  const candidates = new Map<string, CustomerCandidate>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowClass !== "record" || !row.mappedCustomer) continue;

    const rawName = row.mappedCustomer.trim();
    if (rawName === "") continue;

    const normalized = normalizeCustomerName(rawName);
    if (normalized === "") continue;

    const existing = candidates.get(normalized);
    if (existing) {
      existing.rowIndices.push(i);
    } else {
      candidates.set(normalized, {
        name: rawName, // Keep first occurrence's original casing
        normalizedName: normalized,
        rowIndices: [i],
      });
    }
  }

  return candidates;
}

// ─── Unit resolution ────────────────────────────────────────────────────────

export interface UnitCandidate {
  registrationRaw: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  internalNumber: string | null;
  normalizedKey: string;
  rowIndices: number[];
}

/**
 * Group rows by unit identity using registration + internal number.
 */
export function resolveUnits(
  rows: ParsedRow[]
): Map<string, UnitCandidate> {
  const candidates = new Map<string, UnitCandidate>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowClass !== "record") continue;

    const regRaw = row.mappedRegistration?.trim() || "";
    const intId = row.mappedInternalId?.trim() || "";

    // Skip if no identifying info
    if (!regRaw && !intId) continue;

    // Create a composite key for unit identity
    const regNorm = regRaw ? normalizeRegistration(regRaw) : "";
    const key = `${regNorm}|||${intId}`.toLowerCase();

    const existing = candidates.get(key);
    if (existing) {
      existing.rowIndices.push(i);
    } else {
      const parsed = regRaw ? parseRegistrationField(regRaw) : { registration: null, brand: null, model: null };
      candidates.set(key, {
        registrationRaw: regRaw,
        registration: parsed.registration,
        brand: parsed.brand,
        model: parsed.model,
        internalNumber: intId || null,
        normalizedKey: key,
        rowIndices: [i],
      });
    }
  }

  return candidates;
}

// ─── Duplicate detection ────────────────────────────────────────────────────

export interface DuplicateCandidate {
  rowIndexA: number;
  rowIndexB: number;
  confidence: number;
  reason: string;
}

/**
 * Detect potential duplicate rows across sheets.
 *
 * Strategy:
 * 1. Exact fingerprint match (identical text) → confidence 1.0
 * 2. Same customer + same bay_ref + different sheets → confidence 0.8
 * 3. Same customer + same internal_id + similar issue → confidence 0.7
 */
export function detectDuplicates(rows: ParsedRow[]): DuplicateCandidate[] {
  const duplicates: DuplicateCandidate[] = [];

  // Index by fingerprint for exact matches
  const fingerprintMap = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowClass !== "record") continue;
    const existing = fingerprintMap.get(row.fingerprint);
    if (existing) {
      existing.push(i);
    } else {
      fingerprintMap.set(row.fingerprint, [i]);
    }
  }

  // Exact fingerprint duplicates
  for (const [, indices] of fingerprintMap) {
    if (indices.length < 2) continue;
    for (let a = 0; a < indices.length - 1; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        // Only flag cross-sheet duplicates
        if (rows[indices[a]].sourceSheet !== rows[indices[b]].sourceSheet) {
          duplicates.push({
            rowIndexA: indices[a],
            rowIndexB: indices[b],
            confidence: 1.0,
            reason: `Exact text match across sheets: ${rows[indices[a]].sourceSheet} ↔ ${rows[indices[b]].sourceSheet}`,
          });
        }
      }
    }
  }

  // Fuzzy: same customer + bay_ref across sheets
  const customerBayMap = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.rowClass !== "record" || !row.mappedCustomer || !row.mappedBayRef)
      continue;
    const key = `${normalizeCustomerName(row.mappedCustomer)}|||${row.mappedBayRef.trim().toLowerCase()}`;
    const existing = customerBayMap.get(key);
    if (existing) {
      existing.push(i);
    } else {
      customerBayMap.set(key, [i]);
    }
  }

  for (const [, indices] of customerBayMap) {
    if (indices.length < 2) continue;
    for (let a = 0; a < indices.length - 1; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        if (rows[indices[a]].sourceSheet === rows[indices[b]].sourceSheet)
          continue;
        // Check if we already have an exact fingerprint match
        if (rows[indices[a]].fingerprint === rows[indices[b]].fingerprint)
          continue;

        duplicates.push({
          rowIndexA: indices[a],
          rowIndexB: indices[b],
          confidence: 0.8,
          reason: `Same customer + bay ref across sheets: ${rows[indices[a]].sourceSheet} ↔ ${rows[indices[b]].sourceSheet}`,
        });
      }
    }
  }

  return duplicates;
}
