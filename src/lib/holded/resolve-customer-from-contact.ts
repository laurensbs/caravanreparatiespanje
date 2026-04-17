import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { and, ilike, sql } from "drizzle-orm";
import { getContact } from "@/lib/holded/invoices";

/** Normalize for loose name comparison (comma order, spacing). */
export function normalizeContactLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * When `customers.holded_contact_id` is missing, sync-payments/sync-quotes skip documents.
 * Resolve Holded contact → our customer by email (preferred) or by multi-token name match.
 * Results are cached per cron run to avoid repeated Holded API calls.
 */
export async function resolveCustomerIdFromHoldedContact(
  holdedContactId: string,
  cache: Map<string, string | false>,
): Promise<{ customerId: string; shouldBackfillHoldedContactId: boolean } | null> {
  if (cache.has(holdedContactId)) {
    const v = cache.get(holdedContactId)!;
    if (v === false) return null;
    return { customerId: v, shouldBackfillHoldedContactId: false };
  }

  try {
    const hc = await getContact(holdedContactId);
    const email = hc.email?.trim().toLowerCase();
    if (email && email.includes("@")) {
      const byEmail = await db
        .select({ id: customers.id, holdedContactId: customers.holdedContactId })
        .from(customers)
        .where(sql`lower(trim(${customers.email})) = ${email}`)
        .limit(3);
      if (byEmail.length === 1) {
        const row = byEmail[0]!;
        cache.set(holdedContactId, row.id);
        return {
          customerId: row.id,
          shouldBackfillHoldedContactId: !row.holdedContactId,
        };
      }
    }

    const holdedName = normalizeContactLabel(hc.name ?? "");
    const parts = holdedName
      .split(" ")
      .map((p) => p.replace(/[%_]/g, ""))
      .filter((p) => p.length > 2);
    if (parts.length >= 2) {
      const nameClause = and(...parts.map((p) => ilike(customers.name, `%${p}%`)));
      const nameRows = await db
        .select({ id: customers.id, holdedContactId: customers.holdedContactId })
        .from(customers)
        .where(nameClause)
        .limit(5);
      if (nameRows.length === 1) {
        const row = nameRows[0]!;
        cache.set(holdedContactId, row.id);
        return {
          customerId: row.id,
          shouldBackfillHoldedContactId: !row.holdedContactId,
        };
      }
    }
  } catch {
    // Holded contact missing or API error
  }

  cache.set(holdedContactId, false);
  return null;
}
