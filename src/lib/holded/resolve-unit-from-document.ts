/**
 * When linking a Holded quote/invoice to a repair, decide which caravan (unit) the
 * document refers to. Conservative rules when a customer has multiple units.
 */

export type UnitRowMin = {
  id: string;
  registration: string | null;
  internalNumber: string | null;
};

/** Strip separators so "AB-12-CD" and "AB 12 CD" both become AB12CD */
export function normalizeForPlateSearch(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function identifiersForUnit(u: UnitRowMin): string[] {
  const out: string[] = [];
  if (u.registration?.trim()) {
    const n = normalizeForPlateSearch(u.registration.trim());
    if (n.length >= 5) out.push(n);
  }
  if (u.internalNumber?.trim()) {
    const n = normalizeForPlateSearch(u.internalNumber.trim());
    if (n.length >= 4 && out.length === 0) out.push(n);
  }
  return out;
}

export function buildHoldedDocumentSearchText(doc: {
  desc?: string;
  notes?: string;
  products?: Array<{ name: string; desc?: string }>;
  items?: Array<{ name: string; desc?: string }>;
}): string {
  const parts: string[] = [];
  if (doc.desc?.trim()) parts.push(doc.desc);
  if (doc.notes?.trim()) parts.push(doc.notes);
  for (const p of doc.products ?? []) {
    parts.push(p.name);
    if (p.desc?.trim()) parts.push(p.desc);
  }
  for (const i of doc.items ?? []) {
    parts.push(i.name);
    if (i.desc?.trim()) parts.push(i.desc);
  }
  return parts.join("\n");
}

export type UnitManualLinkResolution =
  | { ok: true; updateUnitId: string }
  | { ok: true; keepUnit: true };

/**
 * - Single unit per customer: always attach that unit (safe).
 * - Multiple units: require a recognizable plate/internal number in the document
 *   that matches exactly one of their units, OR the work order already has a unit
 *   and the document does not point at a different plate.
 */
export function resolveUnitForHoldedManualLink(args: {
  jobUnitId: string | null;
  units: UnitRowMin[];
  documentText: string;
}): UnitManualLinkResolution | { ok: false; message: string } {
  const { jobUnitId, units, documentText } = args;
  const haystack = normalizeForPlateSearch(documentText);

  if (units.length === 0) {
    return { ok: true, keepUnit: true };
  }

  if (units.length === 1) {
    return { ok: true, updateUnitId: units[0].id };
  }

  function unitMatchesDoc(u: UnitRowMin): boolean {
    for (const idStr of identifiersForUnit(u)) {
      if (haystack.includes(idStr)) return true;
    }
    return false;
  }

  const matched = units.filter(unitMatchesDoc);
  const distinctIds = [...new Set(matched.map((m) => m.id))];

  if (distinctIds.length > 1) {
    return {
      ok: false,
      message:
        "The Holded document seems to mention more than one license plate that matches this customer’s caravans. Use a document that refers to only one vehicle, or split the work.",
    };
  }

  if (distinctIds.length === 1) {
    const uid = distinctIds[0];
    if (jobUnitId && jobUnitId !== uid) {
      return {
        ok: false,
        message:
          "The document text refers to a different license plate than the unit on this work order. Set the correct caravan on the work order first, or link a document for this vehicle.",
      };
    }
    return { ok: true, updateUnitId: uid };
  }

  if (jobUnitId && units.some((u) => u.id === jobUnitId)) {
    return { ok: true, keepUnit: true };
  }

  return {
    ok: false,
    message:
      "This customer has multiple caravans and the Holded text does not contain a recognizable license plate. Select the correct unit on the work order first, or add the plate to the quote/invoice lines.",
  };
}
