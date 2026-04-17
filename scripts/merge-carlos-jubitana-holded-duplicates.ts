/**
 * Voeg dubbele Holded-contacten samen: "C Jubitana" en "Carlos Jubitana" zijn dezelfde klant.
 *
 * **Leidend** zijn de panel-/screenshot-gegevens: jubitana.carlos@gmail.com, +32476841117,
 * Alsemstraat 5 · 2050 Antwerpen (BE). Het script kiest het contact dat daarbij hoort als
 * **canoniek**, verplaatst alle facturen/offertes van het duplicaat daarheen, verwijdert
 * het oude contact, en doet daarna `pushContactToHolded` zodat Holded dezelfde adresregel krijgt.
 *
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts --dry-run
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts --list-jubitana
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts --also-link-repairs   # alleen linken, geen merge
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts --no-link-repairs      # merge zonder repair-koppeling
 *
 * Handmatig (als auto-detect <2 treft): alle documenten van dup → canoniek
 *   npx tsx scripts/merge-carlos-jubitana-holded-duplicates.ts --merge=<dupId>,<canonicalId>
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers } from "../src/lib/db/schema";
import { eq, ilike } from "drizzle-orm";
import {
  listContacts,
  listInvoicesByContact,
  listQuotesByContact,
  updateInvoiceContact,
  updateEstimateContact,
  deleteContact,
  type HoldedContact,
} from "../src/lib/holded/invoices";
import { isHoldedConfigured } from "../src/lib/holded/client";

const CARLOS_EMAIL = "jubitana.carlos@gmail.com";

function isCarlosJubitanaVariant(c: HoldedContact): boolean {
  const n = (c.name ?? "").toLowerCase();
  if (!n.includes("jubitana")) return false;
  if (n.includes("naomi")) return false;
  if (n.includes("carlos")) return true;
  // "C Jubitana", "C. Jubitana", "Dhr/mevr. C. Jubitana" (zonder "Carlos" in de naam)
  if (/\bc\.?\s*jubitana\b/.test(n)) return true;
  if (/^c\s+jubitana\b/.test(n.trim())) return true;
  if (/^\s*c\.?\s+jubitana\s*$/i.test((c.name ?? "").trim())) return true;
  const collapsed = n.replace(/\s+/g, " ").trim();
  if (collapsed === "c jubitana" || collapsed === "c. jubitana") return true;
  return false;
}

/** Zelfde persoon als Carlos: naamvariant óf leidend e-mailadres (niet Naomi). */
function isCarlosLeadCandidate(c: HoldedContact): boolean {
  const n = (c.name ?? "").toLowerCase();
  if (n.includes("naomi")) return false;
  if (c.email?.toLowerCase().trim() === CARLOS_EMAIL) return true;
  return isCarlosJubitanaVariant(c);
}

function uniqueCandidates(contacts: HoldedContact[]): HoldedContact[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function pickCanonical(candidates: HoldedContact[], panelHoldedId: string | null): HoldedContact {
  // 1) Leidend: exact het e-mailadres van Carlos in het panel
  const emailMatch = candidates.find((c) => c.email?.toLowerCase().trim() === CARLOS_EMAIL);
  if (emailMatch) return emailMatch;

  // 2) Naam met "Carlos" wint t.o.v. alleen "C. Jubitana"
  const withCarlos = candidates.filter((c) => /\bcarlos\b/i.test(c.name ?? ""));
  if (withCarlos.length === 1) return withCarlos[0]!;

  // 3) Panel-klant in deze set
  if (panelHoldedId) {
    const panel = candidates.find((c) => c.id === panelHoldedId);
    if (panel) return panel;
  }

  // 4) Langste naam (meestal volledige aanhef)
  return [...candidates].sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))[0]!;
}

async function mergeDupIntoCanonical(
  dup: HoldedContact,
  canonical: HoldedContact,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const invs = await listInvoicesByContact(dup.id);
  for (const inv of invs) {
    console.log(`Invoice ${inv.docNumber ?? inv.id} → canonical`);
    await updateInvoiceContact(inv.id, canonical.id);
  }
  const quotes = await listQuotesByContact(dup.id);
  for (const q of quotes) {
    console.log(`Quote ${q.docNumber ?? q.id} → canonical`);
    await updateEstimateContact(q.id, canonical.id);
  }

  const updated = await db
    .update(customers)
    .set({ holdedContactId: canonical.id, updatedAt: new Date() })
    .where(eq(customers.holdedContactId, dup.id))
    .returning({ id: customers.id });
  if (updated.length > 0) {
    console.log("Updated customers rows pointing at duplicate:", updated.map((r) => r.id).join(", "));
  }

  console.log("Deleting duplicate Holded contact:", dup.id, dup.name);
  await deleteContact(dup.id);
}

async function afterMergePushAndOptionalLink(carlosCustomerId: string, alsoLink: boolean) {
  const { pushContactToHolded } = await import("../src/lib/holded/sync");
  await pushContactToHolded(carlosCustomerId).catch((e) => console.warn("pushContactToHolded:", e));
  if (alsoLink) {
    const { linkHoldedDocumentsForCustomer } = await import("../src/lib/holded/link-holded-for-customer");
    const link = await linkHoldedDocumentsForCustomer(carlosCustomerId, { dryRun: false, sequentialDateFallback: true });
    console.log(
      "Repairs gekoppeld — facturen:",
      link.invoicesLinked.length,
      "offertes:",
      link.quotesLinked.length,
    );
    if (link.invoicesSkipped.length) console.log("Facturen overgeslagen:", link.invoicesSkipped.slice(0, 8).join("; "));
    if (link.quotesSkipped.length) console.log("Offertes overgeslagen:", link.quotesSkipped.slice(0, 8).join("; "));
    if (link.errors.length) console.warn("Link-fouten:", link.errors.join("; "));
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const alsoLink = process.argv.includes("--also-link-repairs");
  const noLink = process.argv.includes("--no-link-repairs");
  const mergeArg = process.argv.find((a) => a.startsWith("--merge="));

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  if (!isHoldedConfigured()) {
    console.error("HOLDED_API_KEY missing");
    process.exit(1);
  }

  const all = await listContacts();
  if (process.argv.includes("--list-jubitana")) {
    const jub = all.filter((c) => (c.name ?? "").toLowerCase().includes("jubitana"));
    for (const c of jub) {
      console.log(`${c.name} | ${c.id} | email=${c.email ?? ""} | phone=${c.phone ?? ""}`);
    }
    console.log("—", jub.length, "contacts");
    process.exit(0);
  }

  const carlosRows = await db.select().from(customers).where(ilike(customers.name, "%Carlos%Jubitana%"));
  if (carlosRows.length !== 1) {
    console.error("Expected exactly one panel customer 'Carlos Jubitana', got", carlosRows.length);
    process.exit(1);
  }
  const carlos = carlosRows[0]!;

  if (mergeArg) {
    const rest = mergeArg.replace("--merge=", "").trim();
    const [dupId, canonicalId] = rest.split(",").map((s) => s.trim());
    if (!dupId || !canonicalId || dupId === canonicalId) {
      console.error("Usage: --merge=<duplicateContactId>,<canonicalContactId>");
      process.exit(1);
    }
    const dup = all.find((c) => c.id === dupId);
    const canonical = all.find((c) => c.id === canonicalId);
    if (!dup || !canonical) {
      console.error("Could not find one of the contact ids in Holded.");
      process.exit(1);
    }
    console.log("Manual merge: dup", dup.name, dup.id, "→ canonical", canonical.name, canonical.id);
    if (dryRun) {
      console.log("--dry-run: no changes.");
      process.exit(0);
    }
    await mergeDupIntoCanonical(dup, canonical, false);
    await db
      .update(customers)
      .set({ holdedContactId: canonical.id, updatedAt: new Date() })
      .where(eq(customers.id, carlos.id));
    console.log("Panel Carlos → canonical holded_contact_id");
    await afterMergePushAndOptionalLink(carlos.id, !noLink);
    console.log("Done.");
    process.exit(0);
  }

  const candidates = uniqueCandidates(all.filter(isCarlosLeadCandidate));

  if (candidates.length < 2) {
    console.log(
      "Geen dubbele Carlos-contacten in Holded (nodig: ≥2). Gevonden:",
      candidates.map((c) => `${c.name} (${c.id})`).join(" | ") || "(none)",
    );
    console.log("Tip: --list-jubitana | handmatig: --merge=<dupId>,<canonicalId> (canoniek = meestal id met jubitana.carlos@gmail.com)");
    if (alsoLink) {
      console.log("--also-link-repairs: koppel documenten aan repairs (zonder merge).");
      await afterMergePushAndOptionalLink(carlos.id, true);
    }
    process.exit(0);
  }

  const canonical = pickCanonical(candidates, carlos.holdedContactId);
  const duplicates = candidates.filter((c) => c.id !== canonical.id);

  console.log("Canonical (leading details):", canonical.name, canonical.id, canonical.email ?? "");
  console.log(
    "Duplicates to merge:",
    duplicates.map((d) => `${d.name} (${d.id})`).join(", "),
  );
  if (dryRun) {
    console.log("--dry-run: no changes.");
    process.exit(0);
  }

  for (const dup of duplicates) {
    await mergeDupIntoCanonical(dup, canonical, false);
  }

  if (carlos.holdedContactId !== canonical.id) {
    await db
      .update(customers)
      .set({ holdedContactId: canonical.id, updatedAt: new Date() })
      .where(eq(customers.id, carlos.id));
    console.log("Panel Carlos customer → canonical holded_contact_id");
  }

  // Na automatische merge: standaard repairs koppelen, tenzij --no-link-repairs
  await afterMergePushAndOptionalLink(carlos.id, !noLink);

  console.log("Done. Invoices/quotes + adres staan op één Carlos Jubitana in Holded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
