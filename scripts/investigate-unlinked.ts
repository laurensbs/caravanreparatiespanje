/**
 * investigate-unlinked.ts
 * Deep investigation: for each unlinked paid repair, show all Holded invoices
 * for that customer AND which repairs they're linked to.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, and, inArray } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { listAllInvoices, type HoldedInvoice } from "../src/lib/holded/invoices";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

async function main() {
  // Load everything
  const allInvoices = await listAllInvoices();
  console.log(`Holded invoices: ${allInvoices.length}`);

  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name, holdedContactId: schema.customers.holdedContactId })
    .from(schema.customers);
  const customerById = new Map(allCustomers.map(c => [c.id, c]));

  const allRepairs = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
      deletedAt: schema.repairJobs.deletedAt,
    })
    .from(schema.repairJobs);

  // Group invoices by Holded contact
  const invoicesByContact = new Map<string, HoldedInvoice[]>();
  for (const inv of allInvoices) {
    const list = invoicesByContact.get(inv.contact) || [];
    list.push(inv);
    invoicesByContact.set(inv.contact, list);
  }

  // Group repairs by holdedInvoiceId
  const repairByInvoiceId = new Map<string, typeof allRepairs[0]>();
  for (const r of allRepairs) {
    if (r.holdedInvoiceId) repairByInvoiceId.set(r.holdedInvoiceId, r);
  }

  // Find unlinked paid repairs
  const unlinked = allRepairs.filter(r => 
    !r.deletedAt && 
    ["sent", "paid"].includes(r.invoiceStatus) && 
    !r.holdedInvoiceId
  );

  // Deduplicate by customer for cleaner output
  const seenCustomers = new Set<string>();

  for (const r of unlinked) {
    const cust = r.customerId ? customerById.get(r.customerId) : null;
    if (!cust?.holdedContactId) continue;
    if (seenCustomers.has(cust.id)) continue;
    seenCustomers.add(cust.id);

    // Get all Holded invoices for this customer
    const custInvoices = invoicesByContact.get(cust.holdedContactId) || [];
    if (custInvoices.length === 0) continue;

    // Get all repairs for this customer
    const custRepairs = allRepairs.filter(rep => rep.customerId === cust.id && !rep.deletedAt);
    const unlinkedRepairs = custRepairs.filter(rep => ["sent", "paid"].includes(rep.invoiceStatus) && !rep.holdedInvoiceId);

    console.log(`\n═══ ${cust.name} ═══`);
    console.log(`  Repairs (${custRepairs.length}):`);
    for (const rep of custRepairs) {
      const link = rep.holdedInvoiceId ? `→ Holded #${rep.holdedInvoiceNum}` : "⚠ NO HOLDED LINK";
      console.log(`    [${rep.status}/${rep.invoiceStatus}] ${rep.title?.slice(0, 60) || "-"} ${link}`);
    }
    console.log(`  Holded invoices (${custInvoices.length}):`);
    for (const inv of custInvoices) {
      const status = inv.status === 1 ? "paid" : inv.status === 2 ? "partial" : inv.draft ? "draft" : "sent";
      const linkedTo = repairByInvoiceId.get(inv.id);
      const linkInfo = linkedTo ? `← linked to repair [${linkedTo.status}/${linkedTo.invoiceStatus}]` : "NOT LINKED";
      console.log(`    #${inv.docNumber || "draft"} | €${inv.total.toFixed(2)} | ${status} | ${linkInfo}`);
    }
  }
}

main().catch(console.error);
