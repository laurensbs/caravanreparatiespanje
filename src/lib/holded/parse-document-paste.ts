/**
 * Accepts a Holded app URL (invoice or estimate) or a raw document id string.
 * @see https://app.holded.com/invoicing/invoice/{id}
 * @see https://app.holded.com/invoicing/estimate/{id}
 */
export function parseHoldedDocumentPaste(input: string): {
  documentId: string;
  detectedKind: "quote" | "invoice" | null;
} {
  const raw = input.trim();
  if (!raw) return { documentId: "", detectedKind: null };

  function fromUrl(href: string): { documentId: string; detectedKind: "quote" | "invoice" } | null {
    try {
      const u = new URL(href);
      const path = u.pathname;
      const inv = path.match(/\/invoicing\/invoice\/([^/?#]+)/i);
      if (inv?.[1]) {
        return { documentId: decodeURIComponent(inv[1].trim()), detectedKind: "invoice" };
      }
      const est = path.match(/\/invoicing\/estimate\/([^/?#]+)/i);
      if (est?.[1]) {
        return { documentId: decodeURIComponent(est[1].trim()), detectedKind: "quote" };
      }
    } catch {
      return null;
    }
    return null;
  }

  let parsed = fromUrl(raw);
  if (parsed) return parsed;

  if (!/^https?:\/\//i.test(raw)) {
    parsed = fromUrl(`https://${raw}`);
    if (parsed) return parsed;
  }

  return { documentId: raw, detectedKind: null };
}
