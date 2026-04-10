import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";

const WORKERS = [
  { name: "Josue", email: "josue@garage.local", role: "technician" as const },
  { name: "Michael", email: "michael@garage.local", role: "technician" as const },
  { name: "Felipe", email: "felipe@garage.local", role: "technician" as const },
  { name: "Mark", email: "mark@garage.local", role: "technician" as const },
  { name: "Rolf", email: "rolf@garage.local", role: "technician" as const },
];

async function main() {
  const passwordHash = await hash("worker2024", 12);

  for (const w of WORKERS) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, w.email));
    if (existing.length > 0) {
      console.log(`⏭ ${w.name} already exists`);
      continue;
    }
    await db.insert(users).values({
      name: w.name,
      email: w.email,
      passwordHash,
      role: w.role,
      active: true,
    });
    console.log(`✅ Added ${w.name}`);
  }

  console.log("\nDone!");
  process.exit(0);
}

main();
