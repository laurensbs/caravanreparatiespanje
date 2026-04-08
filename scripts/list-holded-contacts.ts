import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { holdedFetch } from "@/lib/holded/client";
import type { HoldedContact } from "@/lib/holded/invoices";

async function main() {
  console.log("Fetching all Holded contacts...");
  const contacts = await holdedFetch<HoldedContact[]>("/contacts");
  console.log(`Found ${contacts.length} contacts in Holded\n`);

  // Show first 30
  for (const c of contacts.slice(0, 30)) {
    console.log(` - [${c.id}] ${c.name} | ${c.email ?? "-"} | ${c.phone ?? "-"} | type: ${c.type ?? "-"}`);
  }

  if (contacts.length > 30) {
    console.log(`  ... and ${contacts.length - 30} more`);
  }

  process.exit(0);
}
main();
