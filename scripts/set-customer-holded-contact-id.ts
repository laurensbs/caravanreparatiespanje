/**
 * Point a panel customer at the correct Holded contact (fixes "View in Holded", invoice sync, etc.).
 *
 *   npx tsx scripts/set-customer-holded-contact-id.ts --email=jubitana.carlos@gmail.com --contact-id=692e82d6914e56f36f0e5d43
 *
 * Uses DATABASE_URL from .env / .env.local. Optionally validates against Holded when HOLDED_API_KEY is set.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { customers } from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getContact } from "../src/lib/holded/invoices";
import { isHoldedConfigured } from "../src/lib/holded/client";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const email = arg("email")?.trim();
  const contactId = arg("contact-id")?.trim();
  if (!email || !contactId) {
    console.error("Usage: --email=... --contact-id=...");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const em = email.toLowerCase();
  const rows = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.email}) = ${em}`)
    .limit(2);

  if (rows.length === 0) {
    console.error("No customer with that email:", email);
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error("Multiple customers with that email — resolve duplicates first.");
    process.exit(1);
  }

  const c = rows[0]!;
  console.log("Customer:", c.name, c.id);
  console.log("Previous holded_contact_id:", c.holdedContactId ?? "(null)");

  if (isHoldedConfigured()) {
    try {
      const hc = await getContact(contactId);
      console.log("Holded contact name:", hc.name ?? "(no name)");
    } catch (e) {
      console.warn("Could not fetch Holded contact (check API key / id):", e instanceof Error ? e.message : e);
    }
  }

  await db
    .update(customers)
    .set({ holdedContactId: contactId, updatedAt: new Date() })
    .where(eq(customers.id, c.id));

  console.log("Updated holded_contact_id →", contactId);
  console.log("View in app:", `https://app.holded.com/contacts/${contactId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
