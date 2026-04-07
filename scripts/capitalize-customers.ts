import "dotenv/config";
import { db } from "../src/lib/db";
import { customers } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

function capitalizeWords(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      // Handle common prefixes like "van", "de", "den", "der" - keep lowercase
      const lowercasePrefixes = ["van", "de", "den", "der", "het", "ten", "ter"];
      if (lowercasePrefixes.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

async function main() {
  const allCustomers = await db.select({ id: customers.id, name: customers.name }).from(customers);

  let updated = 0;
  for (const c of allCustomers) {
    const capitalized = capitalizeWords(c.name.trim());
    if (capitalized !== c.name) {
      await db.update(customers).set({ name: capitalized, updatedAt: new Date() }).where(eq(customers.id, c.id));
      console.log(`  "${c.name}" → "${capitalized}"`);
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated} of ${allCustomers.length} customers.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
