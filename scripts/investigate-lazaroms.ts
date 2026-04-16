import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { listAllInvoices } from "../src/lib/holded/invoices";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

async function main() {
  // Get Lazaroms customer
  const lazCustomer = await db.select().from(schema.customers)
    .where(eq(schema.customers.id, "8c56bdd0-9e4f-4d24-aa8b-13a6d9d23f91"));
  console.log("Customer:", JSON.stringify(lazCustomer[0], null, 2));

  // Get ALL repairs for Lazaroms
  const lazRepairs = await db.select().from(schema.repairJobs)
    .where(eq(schema.repairJobs.customerId, "8c56bdd0-9e4f-4d24-aa8b-13a6d9d23f91"));
  
  console.log("\nAll repairs for Lazaroms:");
  for (const r of lazRepairs) {
    console.log(`  [${r.status}/${r.invoiceStatus}] ${r.deletedAt ? "DELETED " : ""}${r.title?.slice(0, 80)} | holded: ${r.holdedInvoiceNum || "NONE"} | id: ${r.id}`);
  }

  // Get all Holded invoices for this contact
  if (lazCustomer[0]?.holdedContactId) {
    const allInv = await listAllInvoices();
    const lazInv = allInv.filter(i => i.contact === lazCustomer[0].holdedContactId);
    console.log("\nHolded invoices for contact " + lazCustomer[0].holdedContactId + ":");
    for (const inv of lazInv) {
      const st = inv.status === 1 ? "PAID" : inv.status === 2 ? "PARTIAL" : inv.draft ? "DRAFT" : "SENT";
      // Check if linked to any repair
      const linked = lazRepairs.find(r => r.holdedInvoiceId === inv.id);
      console.log(`  #${inv.docNumber || "draft"} | €${inv.total.toFixed(2)} | ${st} | ${linked ? "→ repair " + linked.id.slice(0, 8) : "NOT LINKED TO ANY REPAIR"}`);
      // Show items
      for (const item of (inv.items || [])) {
        console.log(`    - ${item.name} | €${item.subtotal.toFixed(2)}`);
      }
    }
  }

  // Also show ALL unlinked paid repairs with their customer's total Holded invoices
  console.log("\n\n=== FULL PICTURE: All 35 unlinked repairs ===");
  const allInv = await listAllInvoices();
  const allRepairs = await db.select({
    id: schema.repairJobs.id,
    status: schema.repairJobs.status,
    invoiceStatus: schema.repairJobs.invoiceStatus,
    holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
    holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
    customerId: schema.repairJobs.customerId,
    title: schema.repairJobs.title,
    deletedAt: schema.repairJobs.deletedAt,
  }).from(schema.repairJobs);
  
  const allCustomers = await db.select().from(schema.customers);
  const custById = new Map(allCustomers.map(c => [c.id, c]));
  
  const unlinked = allRepairs.filter(r => !r.deletedAt && ["sent", "paid"].includes(r.invoiceStatus) && !r.holdedInvoiceId);
  
  for (const r of unlinked) {
    const cust = r.customerId ? custById.get(r.customerId) : null;
    const custInvCount = cust?.holdedContactId ? allInv.filter(i => i.contact === cust.holdedContactId).length : 0;
    const custRepairs = allRepairs.filter(rep => rep.customerId === r.customerId && !rep.deletedAt);
    const linkedRepairs = custRepairs.filter(rep => rep.holdedInvoiceId);
    console.log(`${cust?.name || "?"} | ${r.invoiceStatus} | repairs: ${custRepairs.length} (${linkedRepairs.length} linked) | holded inv: ${custInvCount} | ${r.title?.slice(0, 50)}`);
  }
}

main().catch(console.error);
