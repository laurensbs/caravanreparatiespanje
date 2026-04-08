import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { holdedFetch } from "@/lib/holded/client";
import { isNull, eq } from "drizzle-orm";

interface HoldedContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type?: string;
}

// ─── Normalize a name for fuzzy matching ───
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/dhr\/mevr\.\s*/gi, "")
    .replace(/dhr\.\s*/gi, "")
    .replace(/mevr\.\s*/gi, "")
    .replace(/mr\.?\s*/gi, "")
    .replace(/mrs\.?\s*/gi, "")
    .replace(/ms\.?\s*/gi, "")
    .replace(/[,.\-\/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split into words and sort for order-independent matching
function nameKey(name: string): string {
  return normalize(name).split(" ").sort().join(" ");
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const mode = DRY_RUN ? "DRY RUN" : "LIVE";
  console.log(`\n🔄 Bulk Holded Sync (${mode})\n`);

  // 1. Fetch all Holded contacts
  console.log("Fetching Holded contacts...");
  const holdedContacts = await holdedFetch<HoldedContact[]>("/contacts");
  // Only match against clients, not suppliers
  const holdedClients = holdedContacts.filter(c => c.type !== "supplier");
  console.log(`  Found ${holdedContacts.length} total (${holdedClients.length} clients, ${holdedContacts.length - holdedClients.length} suppliers)\n`);

  // 2. Build lookup maps
  const holdedByNormalized = new Map<string, HoldedContact>();
  const holdedByKey = new Map<string, HoldedContact>();
  const holdedByEmail = new Map<string, HoldedContact>();

  for (const hc of holdedClients) {
    const norm = normalize(hc.name);
    const key = nameKey(hc.name);
    if (!holdedByNormalized.has(norm)) holdedByNormalized.set(norm, hc);
    if (!holdedByKey.has(key)) holdedByKey.set(key, hc);
    if (hc.email) {
      const email = hc.email.toLowerCase().trim();
      if (!holdedByEmail.has(email)) holdedByEmail.set(email, hc);
    }
  }

  // 3. Get all unlinked DB contacts
  const unlinked = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
    .from(customers)
    .where(isNull(customers.holdedContactId));

  console.log(`Found ${unlinked.length} unlinked contacts in database\n`);

  let matchedByName = 0;
  let matchedByKey = 0;
  let matchedByEmail = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of unlinked) {
    const norm = normalize(contact.name);
    const key = nameKey(contact.name);
    const email = contact.email?.toLowerCase().trim();

    let holdedMatch: HoldedContact | undefined;
    let matchType = "";

    // Try exact normalized match first
    if (holdedByNormalized.has(norm)) {
      holdedMatch = holdedByNormalized.get(norm)!;
      matchType = "name";
    }
    // Try word-order-independent match
    else if (holdedByKey.has(key)) {
      holdedMatch = holdedByKey.get(key)!;
      matchType = "key";
    }
    // Try email match
    else if (email && holdedByEmail.has(email)) {
      holdedMatch = holdedByEmail.get(email)!;
      matchType = "email";
    }

    if (holdedMatch) {
      // Link existing Holded contact
      if (matchType === "name") matchedByName++;
      else if (matchType === "key") matchedByKey++;
      else matchedByEmail++;

      console.log(`✅ MATCH (${matchType}): "${contact.name}" ↔ "${holdedMatch.name}" [${holdedMatch.id}]`);

      if (!DRY_RUN) {
        await db
          .update(customers)
          .set({ holdedContactId: holdedMatch.id, updatedAt: new Date() })
          .where(eq(customers.id, contact.id));
      }
    } else {
      // Skip contacts with no useful data (no name, generic placeholders)
      const skipNames = ["name", "unknown", "test", "cruillas", "pul 2"];
      if (skipNames.includes(norm) || norm.length < 3) {
        skipped++;
        console.log(`⏭️  SKIP: "${contact.name}" (placeholder name)`);
        continue;
      }

      // Create in Holded
      console.log(`🆕 CREATE: "${contact.name}" → Holded`);
      if (!DRY_RUN) {
        try {
          const result = await holdedFetch<{ id: string }>("/contacts", {
            method: "POST",
            body: JSON.stringify({
              name: contact.name,
              email: contact.email ?? undefined,
              phone: contact.phone ?? undefined,
              type: "client",
            }),
          });
          await db
            .update(customers)
            .set({ holdedContactId: result.id, updatedAt: new Date() })
            .where(eq(customers.id, contact.id));
          created++;
        } catch (err: any) {
          errors++;
          console.error(`   ❌ Error creating "${contact.name}": ${err.message}`);
        }
      } else {
        created++;
      }
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`RESULTS (${mode}):`);
  console.log(`  Matched by name:     ${matchedByName}`);
  console.log(`  Matched by key:      ${matchedByKey}`);
  console.log(`  Matched by email:    ${matchedByEmail}`);
  console.log(`  Total matched:       ${matchedByName + matchedByKey + matchedByEmail}`);
  console.log(`  Created in Holded:   ${created}`);
  console.log(`  Skipped:             ${skipped}`);
  console.log(`  Errors:              ${errors}`);
  console.log(`${"═".repeat(50)}\n`);

  process.exit(0);
}

main();
