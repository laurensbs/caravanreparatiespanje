/**
 * cleanup-status-mismatches.ts
 * 
 * Fixes status mismatches and links repairs to Holded invoices:
 * 1. completed + invoice_status=sent/paid → advance to status=invoiced
 * 2. invoiced + invoice_status=not_invoiced → investigate and fix
 * 3. Try to link unlinked repairs to Holded invoices
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

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN MODE\n" : "🔧 LIVE MODE\n");

  // ─── Load Holded invoices ───
  console.log("Fetching all Holded invoices...");
  const allInvoices = await listAllInvoices();
  console.log(`  Found ${allInvoices.length} invoices in Holded\n`);

  // Load all customers with Holded contact IDs
  const allCustomers = await db
    .select({ id: schema.customers.id, name: schema.customers.name, holdedContactId: schema.customers.holdedContactId })
    .from(schema.customers);
  
  const customerById = new Map(allCustomers.map(c => [c.id, c]));
  const customerByHoldedContact = new Map<string, typeof allCustomers[0]>();
  for (const c of allCustomers) {
    if (c.holdedContactId) customerByHoldedContact.set(c.holdedContactId, c);
  }

  // Build invoice lookup by contact → invoices
  const invoicesByContact = new Map<string, HoldedInvoice[]>();
  for (const inv of allInvoices) {
    const list = invoicesByContact.get(inv.contact) || [];
    list.push(inv);
    invoicesByContact.set(inv.contact, list);
  }

  let fixed = 0;
  let linked = 0;

  // ─── Fix 1: completed + invoice_status=sent/paid → invoiced ───
  console.log("=== Fix 1: completed + sent/paid → invoiced ===");
  const completedWithInvoice = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
      completedAt: schema.repairJobs.completedAt,
      createdAt: schema.repairJobs.createdAt,
    })
    .from(schema.repairJobs)
    .where(
      and(
        isNull(schema.repairJobs.deletedAt),
        eq(schema.repairJobs.status, "completed"),
        inArray(schema.repairJobs.invoiceStatus, ["sent", "paid"]),
      )
    );

  for (const r of completedWithInvoice) {
    const cust = r.customerId ? customerById.get(r.customerId) : null;
    console.log(`  → ${cust?.name || "?"} | inv=${r.invoiceStatus} | #${r.holdedInvoiceNum || "-"} → status=invoiced`);

    // Try to link to Holded if not already linked
    if (!r.holdedInvoiceId && cust?.holdedContactId) {
      const match = findHoldedInvoice(invoicesByContact.get(cust.holdedContactId) || [], r);
      if (match) {
        console.log(`    🔗 Linked to Holded invoice #${match.docNumber} (€${match.total.toFixed(2)})`);
        if (!DRY_RUN) {
          await db.update(schema.repairJobs).set({
            status: "invoiced",
            holdedInvoiceId: match.id,
            holdedInvoiceNum: match.docNumber,
            holdedInvoiceDate: new Date(match.date * 1000),
            completedAt: r.completedAt || new Date(),
            updatedAt: new Date(),
          }).where(eq(schema.repairJobs.id, r.id));
        }
        linked++;
        fixed++;
        continue;
      }
    }

    if (!DRY_RUN) {
      await db.update(schema.repairJobs).set({
        status: "invoiced",
        completedAt: r.completedAt || new Date(),
        updatedAt: new Date(),
      }).where(eq(schema.repairJobs.id, r.id));
    }
    fixed++;
  }
  console.log(`  Fixed: ${completedWithInvoice.length}\n`);

  // ─── Fix 2: invoiced + invoice_status=not_invoiced → try to link or fix ───
  console.log("=== Fix 2: invoiced + not_invoiced → find Holded invoice ===");
  const invoicedNotInvoiced = await db
    .select({
      id: schema.repairJobs.id,
      status: schema.repairJobs.status,
      invoiceStatus: schema.repairJobs.invoiceStatus,
      holdedInvoiceId: schema.repairJobs.holdedInvoiceId,
      holdedInvoiceNum: schema.repairJobs.holdedInvoiceNum,
      customerId: schema.repairJobs.customerId,
      title: schema.repairJobs.title,
      publicCode: schema.repairJobs.publicCode,
      completedAt: schema.repairJobs.completedAt,
      createdAt: schema.repairJobs.createdAt,
    })
    .from(schema.repairJobs)
    .where(
      and(
        isNull(schema.repairJobs.deletedAt),
        eq(schema.repairJobs.status, "invoiced"),
        eq(schema.repairJobs.invoiceStatus, "not_invoiced"),
      )
    );

  for (const r of invoicedNotInvoiced) {
    const cust = r.customerId ? customerById.get(r.customerId) : null;
    
    // Try to find and link a Holded invoice
    if (cust?.holdedContactId) {
      const match = findHoldedInvoice(invoicesByContact.get(cust.holdedContactId) || [], r);
      if (match) {
        const invStatus = holdedStatus(match);
        console.log(`  → ${cust.name} | found Holded #${match.docNumber} (€${match.total.toFixed(2)}, ${invStatus})`);
        if (!DRY_RUN) {
          await db.update(schema.repairJobs).set({
            holdedInvoiceId: match.id,
            holdedInvoiceNum: match.docNumber,
            holdedInvoiceDate: new Date(match.date * 1000),
            invoiceStatus: invStatus,
            updatedAt: new Date(),
          }).where(eq(schema.repairJobs.id, r.id));
        }
        linked++;
        fixed++;
        continue;
      }
    }
    console.log(`  ⚠ ${cust?.name || "?"} | no Holded match found — keeping as invoiced/not_invoiced`);
  }
  console.log(`  Checked: ${invoicedNotInvoiced.length}\n`);

  // ─── Fix 3: Try to link completed+sent/paid that still have no Holded link ───
  // (already handled in Fix 1 above)

  console.log("─────────────────────────────────");
  console.log(`Total fixed: ${fixed}`);
  console.log(`Total Holded-linked: ${linked}`);
  if (DRY_RUN) console.log("\n⚠ DRY RUN — no changes made. Run without --dry-run to apply.");
}

function holdedStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.status === 2) return "paid"; // partial with small diff → paid (tolerance handled elsewhere)
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

/**
 * Try to match a repair to a Holded invoice for the same customer.
 * Strategies: publicCode match, title match, date proximity.
 */
function findHoldedInvoice(
  customerInvoices: HoldedInvoice[],
  repair: { publicCode: string | null; title: string | null; completedAt: Date | null; createdAt: Date },
): HoldedInvoice | null {
  if (customerInvoices.length === 0) return null;

  // Filter out drafts without numbers  
  const candidates = customerInvoices.filter(i => i.docNumber && i.docNumber !== "---");
  if (candidates.length === 0) return null;

  // Build searchable text for each invoice
  const invTexts = candidates.map(inv => ({
    inv,
    text: [
      inv.desc ?? "",
      inv.docNumber ?? "",
      ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
    ].join(" ").toLowerCase(),
  }));

  // Strategy 1: Match by publicCode
  if (repair.publicCode) {
    const code = repair.publicCode.toLowerCase();
    const match = invTexts.find(t => t.text.includes(code));
    if (match) return match.inv;
  }

  // Strategy 2: Match by title keywords
  if (repair.title && repair.title.length > 5) {
    const title = repair.title.toLowerCase();
    const match = invTexts.find(t => t.text.includes(title));
    if (match) return match.inv;
  }

  // Strategy 3: Date proximity (closest invoice within 60 days of completion/creation)
  const repairDate = (repair.completedAt ?? repair.createdAt).getTime();
  let best: HoldedInvoice | null = null;
  let bestDist = Infinity;
  for (const inv of candidates) {
    const invDate = inv.date * 1000;
    const dist = Math.abs(invDate - repairDate);
    if (dist < bestDist) {
      bestDist = dist;
      best = inv;
    }
  }
  // Only match if within 60 days
  if (best && bestDist < 60 * 24 * 60 * 60 * 1000) {
    return best;
  }

  return null;
}

main().catch(console.error);
