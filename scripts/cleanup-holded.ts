/**
 * Cleanup script: Delete contacts that were wrongly created in Holded
 * by the previous bulk-sync script (713 contacts with just names, no real data).
 *
 * Strategy: Identify contacts created after April 6, 2026 using MongoDB ObjectId
 * timestamps, then verify they have minimal data (just name + type).
 *
 * Usage:
 *   npx tsx scripts/cleanup-holded.ts --dry-run   # Preview only
 *   npx tsx scripts/cleanup-holded.ts              # Actually delete
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { holdedFetch } from "@/lib/holded/client";
import { eq, isNotNull } from "drizzle-orm";

interface HoldedContactFull {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  type?: string;
  code?: string;
  vatnumber?: string;
  tradeName?: string;
  billAddress?: {
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
  };
  customFields?: Array<{ field: string; value: string }>;
  tags?: string[];
  note?: string;
}

// Extract creation timestamp from MongoDB-style ObjectId
function getObjectIdTimestamp(id: string): Date {
  const hex = id.substring(0, 8);
  const seconds = parseInt(hex, 16);
  return new Date(seconds * 1000);
}

// Check if a Holded contact has meaningful data beyond just name+type
// Holded auto-sets billAddress.country to "España" and countryCode to "ES" for new contacts
function hasRealData(contact: HoldedContactFull): boolean {
  if (contact.email && contact.email.trim()) return true;
  if (contact.phone && contact.phone.trim()) return true;
  if (contact.mobile && contact.mobile.trim()) return true;
  if (contact.vatnumber && contact.vatnumber.trim()) return true;
  if (contact.tradeName && contact.tradeName.trim()) return true;
  if (contact.code && contact.code.trim()) return true;
  if (contact.note && contact.note.trim()) return true;
  if (contact.billAddress) {
    const addr = contact.billAddress;
    // Ignore default "España"/"ES" country — Holded sets this automatically
    const hasAddress = addr.address && addr.address.trim();
    const hasCity = addr.city && addr.city.trim();
    const hasPostal = addr.postalCode && addr.postalCode.trim();
    const hasProvince = addr.province && addr.province.trim();
    const isNonDefaultCountry = addr.country && addr.country.trim() && 
      addr.country !== "España" && addr.country !== "Spain";
    if (hasAddress || hasCity || hasPostal || hasProvince || isNonDefaultCountry) return true;
  }
  if (contact.customFields && contact.customFields.length > 0) return true;
  if (contact.tags && contact.tags.length > 0) return true;
  // Contacts with "Dhr/mevr" in name are original Holded contacts
  if (/dhr|mevr/i.test(contact.name)) return true;
  return false;
}

async function fetchAllHoldedContacts(): Promise<HoldedContactFull[]> {
  const all: HoldedContactFull[] = [];
  let page = 1;
  while (true) {
    const batch = await holdedFetch<HoldedContactFull[]>(`/contacts?page=${page}`);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    console.log(`  Fetched page ${page}: ${batch.length} contacts`);
    page++;
    if (batch.length < 50) break; // Holded typically returns 50 per page
  }
  return all;
}

async function main() {
  const DRY_RUN = process.argv.includes("--dry-run");
  const mode = DRY_RUN ? "DRY RUN" : "LIVE";
  console.log(`\n🧹 Holded Cleanup (${mode})\n`);

  // Cutoff: April 6, 2026 — contacts created after this are suspect
  const CUTOFF = new Date("2026-04-06T00:00:00Z");
  console.log(`Cutoff date: ${CUTOFF.toISOString()}\n`);

  // 1. Fetch all Holded contacts (with pagination)
  console.log("Fetching ALL Holded contacts...");
  const allHolded = await fetchAllHoldedContacts();
  console.log(`Total Holded contacts: ${allHolded.length}\n`);

  // 2. Identify contacts created after cutoff with minimal data
  const toDelete: HoldedContactFull[] = [];
  const toKeep: HoldedContactFull[] = [];

  for (const contact of allHolded) {
    const createdAt = getObjectIdTimestamp(contact.id);
    const isRecent = createdAt > CUTOFF;
    const hasData = hasRealData(contact);

    if (isRecent && !hasData) {
      toDelete.push(contact);
    } else {
      toKeep.push(contact);
    }
  }

  console.log(`Contacts to DELETE (recent + no data): ${toDelete.length}`);
  console.log(`Contacts to KEEP: ${toKeep.length}\n`);

  // Show some examples of what will be deleted
  console.log("Sample contacts to delete:");
  for (const c of toDelete.slice(0, 10)) {
    const created = getObjectIdTimestamp(c.id);
    console.log(`  ❌ "${c.name}" (created: ${created.toISOString()}, type: ${c.type || "none"})`);
  }
  if (toDelete.length > 10) {
    console.log(`  ... and ${toDelete.length - 10} more\n`);
  }

  // 3. Delete from Holded
  let deleted = 0;
  let deleteErrors = 0;

  if (!DRY_RUN && toDelete.length > 0) {
    console.log("\nDeleting contacts from Holded...");
    for (const contact of toDelete) {
      try {
        await holdedFetch(`/contacts/${contact.id}`, { method: "DELETE" });
        deleted++;
        if (deleted % 50 === 0) {
          console.log(`  Deleted ${deleted}/${toDelete.length}...`);
        }
      } catch (err: any) {
        deleteErrors++;
        console.error(`  ❌ Failed to delete "${contact.name}" [${contact.id}]: ${err.message}`);
      }
    }
    console.log(`  Deleted ${deleted} contacts from Holded (${deleteErrors} errors)\n`);
  }

  // 4. Reset ALL holdedContactId in our database (clean slate for re-linking)
  console.log("Resetting holdedContactId in database...");
  const linkedContacts = await db
    .select({ id: customers.id, holdedContactId: customers.holdedContactId })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));

  console.log(`  Found ${linkedContacts.length} contacts with holdedContactId to reset`);

  if (!DRY_RUN) {
    const result = await db
      .update(customers)
      .set({ holdedContactId: null, updatedAt: new Date() })
      .where(isNotNull(customers.holdedContactId));
    console.log(`  Reset complete\n`);
  }

  // 5. Summary
  console.log(`${"═".repeat(50)}`);
  console.log(`CLEANUP RESULTS (${mode}):`);
  console.log(`  Total Holded contacts:       ${allHolded.length}`);
  console.log(`  Deleted from Holded:         ${DRY_RUN ? `${toDelete.length} (would delete)` : deleted}`);
  console.log(`  Kept in Holded:              ${toKeep.length}`);
  console.log(`  DB holdedContactId reset:    ${linkedContacts.length}`);
  if (deleteErrors > 0) console.log(`  Delete errors:               ${deleteErrors}`);
  console.log(`${"═".repeat(50)}\n`);

  if (DRY_RUN) {
    console.log("Run without --dry-run to actually perform cleanup.\n");
  }

  process.exit(0);
}

main();
