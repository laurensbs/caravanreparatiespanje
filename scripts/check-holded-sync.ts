import "dotenv/config";
import { db } from "@/lib/db";
import { customers, repairJobs } from "@/lib/db/schema";
import { count, isNull, isNotNull } from "drizzle-orm";

async function check() {
  const [total] = await db.select({ c: count() }).from(customers);
  const [linked] = await db.select({ c: count() }).from(customers).where(isNotNull(customers.holdedContactId));
  const [unlinked] = await db.select({ c: count() }).from(customers).where(isNull(customers.holdedContactId));
  const [totalRepairs] = await db.select({ c: count() }).from(repairJobs);
  const [repairsWithCustomer] = await db.select({ c: count() }).from(repairJobs).where(isNotNull(repairJobs.customerId));
  const [repairsWithoutCustomer] = await db.select({ c: count() }).from(repairJobs).where(isNull(repairJobs.customerId));

  console.log("=== Database Status ===");
  console.log("Total contacts:", total.c);
  console.log("Linked to Holded:", linked.c);
  console.log("NOT linked to Holded:", unlinked.c);
  console.log("");
  console.log("Total repairs:", totalRepairs.c);
  console.log("Repairs with contact:", repairsWithCustomer.c);
  console.log("Repairs without contact:", repairsWithoutCustomer.c);

  const unlinkedList = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
    .from(customers)
    .where(isNull(customers.holdedContactId))
    .limit(30);

  if (unlinkedList.length > 0) {
    console.log("");
    console.log("=== Contacts NOT linked to Holded (first 30) ===");
    for (const c of unlinkedList) {
      console.log(` - ${c.name} | ${c.phone ?? "-"} | ${c.email ?? "-"}`);
    }
  }

  process.exit(0);
}
check();
