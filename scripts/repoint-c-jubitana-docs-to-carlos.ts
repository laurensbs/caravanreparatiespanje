/**
 * Verplaats facturen en offertes die nog op het oude Holded-contact "Dhr/mevr. C. Jubitana"
 * (of vergelijkbaar) staan naar het canonieke Carlos Jubitana-contact uit het panel.
 *
 * Gebruikt listAllInvoices / listAllQuotes en matcht op contactName + optioneel documentnummers.
 * Voer daarna linkHoldedDocumentsForCustomer uit (repairs zonder Holded-link).
 *
 *   npx tsx scripts/repoint-c-jubitana-docs-to-carlos.ts
 *   npx tsx scripts/repoint-c-jubitana-docs-to-carlos.ts --dry-run
 *   npx tsx scripts/repoint-c-jubitana-docs-to-carlos.ts --invoices=INV2425,INV1989,INV1208,INV0971
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers } from "../src/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import {
  listAllInvoices,
  listAllQuotes,
  updateInvoiceContact,
  updateEstimateContact,
  type HoldedInvoice,
  type HoldedQuote,
} from "../src/lib/holded/invoices";
import { isHoldedConfigured } from "../src/lib/holded/client";
import { linkHoldedDocumentsForCustomer } from "../src/lib/holded/link-holded-for-customer";

function normDoc(d: string | undefined): string {
  return (d ?? "").replace(/\s/g, "").toUpperCase();
}

/** Zet o.a. INV2425 en 2425 in dezelfde set. */
function expandDocAliases(raw: string): string[] {
  const n = normDoc(raw);
  const s = new Set<string>();
  if (!n) return [];
  s.add(n);
  if (n.startsWith("INV") && n.length > 3) s.add(n.slice(3));
  if (/^\d+$/.test(n)) s.add(`INV${n}`);
  return [...s];
}

function invoiceMatchesExplicit(inv: HoldedInvoice, explicit: Set<string>): boolean {
  const candidates = expandDocAliases(inv.docNumber ?? "");
  return candidates.some((c) => explicit.has(c));
}

function quoteMatchesExplicit(q: HoldedQuote, explicit: Set<string>): boolean {
  const candidates = expandDocAliases(q.docNumber ?? "");
  return candidates.some((c) => explicit.has(c));
}

/** Factuur staat onder "C." Jubitana, niet Carlos/Naomi (op basis van Holded contactName). */
function isOldCJubitanaContactName(contactName: string | undefined): boolean {
  const n = (contactName ?? "").toLowerCase();
  if (!n.includes("jubitana")) return false;
  if (n.includes("naomi")) return false;
  if (n.includes("carlos")) return false;
  return /\bc\.?\s*jubitana\b/.test(n) || /\bc\s+jubitana\b/.test(n.trim());
}

function shouldRepointInvoice(
  inv: HoldedInvoice,
  carlosHoldedId: string,
  explicitDocNums: Set<string>,
): boolean {
  if (inv.contact === carlosHoldedId) return false;
  if (explicitDocNums.size > 0) {
    return invoiceMatchesExplicit(inv, explicitDocNums);
  }
  return isOldCJubitanaContactName(inv.contactName);
}

function shouldRepointQuote(
  q: HoldedQuote,
  carlosHoldedId: string,
  explicitQuoteNums: Set<string>,
): boolean {
  if (q.contact === carlosHoldedId) return false;
  if (explicitQuoteNums.size > 0) {
    return quoteMatchesExplicit(q, explicitQuoteNums);
  }
  return isOldCJubitanaContactName(q.contactName);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const invArg = process.argv.find((a) => a.startsWith("--invoices="));
  const quoteArg = process.argv.find((a) => a.startsWith("--quotes="));

  const explicitDocNums = new Set<string>();
  if (invArg) {
    for (const p of invArg.replace("--invoices=", "").split(",")) {
      for (const a of expandDocAliases(p.trim())) {
        explicitDocNums.add(a);
      }
    }
  }

  const explicitQuoteNums = new Set<string>();
  if (quoteArg) {
    for (const p of quoteArg.replace("--quotes=", "").split(",")) {
      for (const a of expandDocAliases(p.trim())) {
        explicitQuoteNums.add(a);
      }
    }
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!isHoldedConfigured()) {
    console.error("HOLDED_API_KEY missing");
    process.exit(1);
  }

  const rows = await db.select().from(customers).where(ilike(customers.name, "%Carlos%Jubitana%"));
  if (rows.length !== 1) {
    console.error("Expected exactly one panel customer Carlos Jubitana");
    process.exit(1);
  }
  const carlos = rows[0]!;
  if (!carlos.holdedContactId) {
    console.error("Carlos has no holded_contact_id");
    process.exit(1);
  }
  const carlosHoldedId = carlos.holdedContactId;

  console.log("Carlos Holded contact:", carlosHoldedId, carlos.name);
  if (explicitDocNums.size) console.log("Filter factuurnummers:", [...explicitDocNums].join(", "));
  if (explicitQuoteNums.size) console.log("Filter offertes:", [...explicitQuoteNums].join(", "));
  if (!explicitDocNums.size && !explicitQuoteNums.size) {
    console.log("Modus: alle facturen/offertes waarvan contactName op C. Jubitana lijkt (niet Carlos/Naomi).");
  }

  const allInv = await listAllInvoices();
  const allQuotes = await listAllQuotes();

  let invMoved = 0;
  let qMoved = 0;

  for (const inv of allInv) {
    if (!shouldRepointInvoice(inv, carlosHoldedId, explicitDocNums)) continue;
    console.log(
      dryRun ? "[dry-run] Would move invoice" : "Moving invoice",
      inv.docNumber ?? inv.id,
      "from contact",
      inv.contact,
      `(${inv.contactName ?? "?"})`,
    );
    if (!dryRun) {
      await updateInvoiceContact(inv.id, carlosHoldedId);
    }
    invMoved++;
  }

  for (const q of allQuotes) {
    if (!shouldRepointQuote(q, carlosHoldedId, explicitQuoteNums)) continue;
    console.log(
      dryRun ? "[dry-run] Would move quote" : "Moving quote",
      q.docNumber ?? q.id,
      "from contact",
      q.contact,
      `(${q.contactName ?? "?"})`,
    );
    if (!dryRun) {
      await updateEstimateContact(q.id, carlosHoldedId);
    }
    qMoved++;
  }

  console.log(`\nFacturen verplaatst: ${invMoved}, offertes: ${qMoved}`);

  if (!dryRun && (invMoved > 0 || qMoved > 0)) {
    const link = await linkHoldedDocumentsForCustomer(carlos.id, {
      dryRun: false,
      sequentialDateFallback: true,
      detachDocumentsLinkedToOtherCustomers: true,
    });
    console.log(
      "Repairs gekoppeld — facturen:",
      link.invoicesLinked.length,
      "offertes:",
      link.quotesLinked.length,
    );
    if (link.invoicesSkipped.length) console.log("Facturen niet gematcht met repair:", link.invoicesSkipped.slice(0, 12).join("; "));
    if (link.quotesSkipped.length) console.log("Offertes niet gematcht:", link.quotesSkipped.slice(0, 8).join("; "));
  }

  if (dryRun) console.log("\n--dry-run: geen wijzigingen in Holded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
