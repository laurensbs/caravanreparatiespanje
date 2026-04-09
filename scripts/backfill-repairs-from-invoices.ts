/**
 * Backfill Repairs from Holded Invoices
 *
 * Finds all Holded invoices that have NO linked repair job in the DB,
 * matches them to existing customers (via holdedContactId), and creates
 * repair jobs with the correct status, invoice status, dates, and amounts.
 *
 * Usage:
 *   npx tsx scripts/backfill-repairs-from-invoices.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-repairs-from-invoices.ts              # actually create repairs
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "@/lib/db";
import { repairJobs, repairJobEvents, customers, units } from "@/lib/db/schema";
import { eq, isNotNull, isNull, inArray } from "drizzle-orm";
import { listAllInvoices, type HoldedInvoice } from "@/lib/holded/invoices";
import { isHoldedConfigured } from "@/lib/holded/client";

const DRY_RUN = process.argv.includes("--dry-run");

// Generate publicCode like existing repairs
function generatePublicCode(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REP-${year}${month}-${random}`;
}

// Determine invoice payment status from Holded
function holdedInvoiceStatus(inv: HoldedInvoice): "draft" | "sent" | "paid" {
  if (inv.status === 1) return "paid";
  if (inv.draft || !inv.docNumber || inv.docNumber === "---") return "draft";
  return "sent";
}

// Map Holded invoice status → repair workflow status
function repairStatusFromInvoice(invStatus: "draft" | "sent" | "paid"): string {
  switch (invStatus) {
    case "paid":
      return "invoiced"; // fully paid → invoiced (final state)
    case "sent":
      return "completed"; // invoice sent but not paid → completed
    case "draft":
      return "completed"; // draft invoice → completed (work done)
  }
}

// Keywords that indicate a non-repair invoice (transport, storage, deposits, etc.)
const NON_REPAIR_TAG_PREFIXES = ["transport", "stalling"];

// Description/item keywords that indicate a non-repair invoice
const NON_REPAIR_KEYWORDS = [
  "stalling", "storage", "reservering", "aanbetaling",
  "transport", "tarieven", "tarief",
  "huur", "verhuur", "rental",
];

function isNonRepairInvoice(inv: HoldedInvoice): boolean {
  // Check tags
  const tagMatch = (inv.tags ?? []).some(tag => {
    const t = tag.toLowerCase();
    return NON_REPAIR_TAG_PREFIXES.some(prefix => t.includes(prefix));
  });
  if (tagMatch) return true;

  // Check description and item names for non-repair keywords
  const textToCheck = [
    inv.desc ?? "",
    ...(inv.items ?? []).map(i => `${i.name ?? ""} ${i.desc ?? ""}`),
  ].join(" ").toLowerCase();

  return NON_REPAIR_KEYWORDS.some(kw => textToCheck.includes(kw));
}

// Build a title from invoice items/description
function buildTitle(inv: HoldedInvoice): string {
  // Try invoice description first
  if (inv.desc && inv.desc.trim() && inv.desc.toLowerCase() !== "no description") {
    return inv.desc.trim();
  }
  // Try first item name
  if (inv.items && inv.items.length > 0 && inv.items[0].name) {
    return inv.items[0].name;
  }
  // Fallback
  return `Repair (invoice ${inv.docNumber || "draft"})`;
}

// Build description from all invoice items
function buildDescription(inv: HoldedInvoice): string {
  const lines: string[] = [];
  if (inv.desc && inv.desc.trim()) {
    lines.push(inv.desc.trim());
  }
  if (inv.items && inv.items.length > 0) {
    lines.push("");
    lines.push("Invoice items:");
    for (const item of inv.items) {
      const desc = item.desc ? ` — ${item.desc}` : "";
      lines.push(`• ${item.name}${desc} (${item.units}x, €${item.subtotal.toFixed(2)})`);
    }
  }
  return lines.join("\n");
}

async function main() {
  const mode = DRY_RUN ? "DRY RUN" : "LIVE";
  console.log(`\n🔧 Backfill Repairs from Holded Invoices (${mode})\n`);

  if (!isHoldedConfigured()) {
    console.error("❌ HOLDED_API_KEY not configured");
    process.exit(1);
  }

  // 1. Fetch all invoices from Holded
  console.log("📥 Fetching all invoices from Holded...");
  const allInvoices = await listAllInvoices();
  console.log(`   Found ${allInvoices.length} total invoices\n`);

  // 2. Load all existing repairs (to find which invoices are already linked)
  const existingRepairs = await db
    .select({
      id: repairJobs.id,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      customerId: repairJobs.customerId,
    })
    .from(repairJobs)
    .where(isNull(repairJobs.deletedAt));

  const linkedInvoiceIds = new Set(
    existingRepairs.filter((r) => r.holdedInvoiceId).map((r) => r.holdedInvoiceId!)
  );
  console.log(`   ${linkedInvoiceIds.size} invoices already linked to repairs`);

  // 3. Load all customers with Holded contact IDs
  const allCustomers = await db
    .select({
      id: customers.id,
      name: customers.name,
      holdedContactId: customers.holdedContactId,
    })
    .from(customers)
    .where(isNotNull(customers.holdedContactId));

  // holdedContactId → customer
  const customerByHoldedId = new Map<string, { id: string; name: string }>();
  for (const c of allCustomers) {
    if (c.holdedContactId) {
      customerByHoldedId.set(c.holdedContactId, { id: c.id, name: c.name });
    }
  }
  console.log(`   ${customerByHoldedId.size} customers linked to Holded\n`);

  // 4. Load all units grouped by customer for auto-linking
  const allUnits = await db
    .select({
      id: units.id,
      customerId: units.customerId,
      registration: units.registration,
      brand: units.brand,
      model: units.model,
    })
    .from(units);

  const unitsByCustomer = new Map<string, typeof allUnits>();
  for (const u of allUnits) {
    if (!u.customerId) continue;
    const list = unitsByCustomer.get(u.customerId) ?? [];
    list.push(u);
    unitsByCustomer.set(u.customerId, list);
  }

  // 5. Count existing repairs per customer (to detect "has repairs already")
  const repairsByCustomer = new Map<string, number>();
  for (const r of existingRepairs) {
    if (r.customerId) {
      repairsByCustomer.set(r.customerId, (repairsByCustomer.get(r.customerId) ?? 0) + 1);
    }
  }

  // 6. Find unlinked invoices and create repairs
  const unlinkedInvoices = allInvoices.filter((inv) => !linkedInvoiceIds.has(inv.id));
  console.log(`📋 ${unlinkedInvoices.length} invoices have NO linked repair\n`);

  // Group by customer for clearer output
  const invoicesByContact = new Map<string, HoldedInvoice[]>();
  for (const inv of unlinkedInvoices) {
    const list = invoicesByContact.get(inv.contact) ?? [];
    list.push(inv);
    invoicesByContact.set(inv.contact, list);
  }

  let created = 0;
  let skipped = 0;
  let skippedNonRepair = 0;
  let noCustomer = 0;

  for (const [holdedContactId, invoices] of invoicesByContact) {
    const customer = customerByHoldedId.get(holdedContactId);

    if (!customer) {
      // Invoice belongs to a Holded contact not in our DB
      noCustomer += invoices.length;
      if (invoices.length > 0) {
        console.log(`⏭️  SKIP (no DB customer): "${invoices[0].contactName}" — ${invoices.length} invoice(s)`);
      }
      continue;
    }

    const customerUnits = unitsByCustomer.get(customer.id) ?? [];
    const existingCount = repairsByCustomer.get(customer.id) ?? 0;

    console.log(`\n👤 ${customer.name} (${existingCount} existing repairs, ${customerUnits.length} unit(s))`);

    // Sort invoices by date ascending
    const sorted = [...invoices].sort((a, b) => (a.date ?? 0) - (b.date ?? 0));

    for (const inv of sorted) {
      const invStatus = holdedInvoiceStatus(inv);
      const repairStatus = repairStatusFromInvoice(invStatus);
      const invDate = inv.date ? new Date(inv.date * 1000) : new Date();
      const invDueDate = inv.dueDate ? new Date(inv.dueDate * 1000) : null;
      const title = buildTitle(inv);
      const description = buildDescription(inv);

      // Skip draft invoices with €0 total — likely test/template
      if (invStatus === "draft" && inv.total === 0) {
        console.log(`   ⏭️  SKIP draft €0.00: ${inv.docNumber || "(no number)"}`);
        skipped++;
        continue;
      }

      // Skip non-repair invoices (transport, storage, etc.)
      if (isNonRepairInvoice(inv)) {
        console.log(`   ⏭️  SKIP non-repair: ${inv.docNumber || "(no number)"} — "${title}"`);
        skippedNonRepair++;
        continue;
      }

      // Skip invoices with no description and no items — can't determine purpose
      const hasContent = (inv.desc && inv.desc.trim().length > 3)
        || (inv.items ?? []).some(i => i.name && i.name.trim().length > 3);
      if (!hasContent) {
        console.log(`   ⏭️  SKIP blank: ${inv.docNumber || "(no number)"} — no description or items`);
        skipped++;
        continue;
      }

      // Auto-link unit: if customer has exactly 1 unit, use it
      const unitId = customerUnits.length === 1 ? customerUnits[0].id : null;
      const unitInfo = unitId ? ` → unit ${customerUnits[0].brand} ${customerUnits[0].model} (${customerUnits[0].registration})` : "";

      const publicCode = generatePublicCode();

      console.log(
        `   ${DRY_RUN ? "📝" : "✅"} ${inv.docNumber || "DRAFT"} — €${inv.total.toFixed(2)} — ${invStatus} — "${title}"` +
        ` — ${invDate.toLocaleDateString("nl-NL")}${unitInfo}`
      );

      if (!DRY_RUN) {
        const [job] = await db
          .insert(repairJobs)
          .values({
            publicCode,
            customerId: customer.id,
            unitId: unitId,
            title,
            descriptionRaw: description,
            status: repairStatus as any,
            priority: "normal",
            businessProcessType: "repair",
            invoiceStatus: invStatus === "paid" ? "paid" : invStatus === "sent" ? "sent" : "draft",
            holdedInvoiceId: inv.id,
            holdedInvoiceNum: inv.docNumber || null,
            holdedInvoiceDate: invDate,
            actualCost: inv.total > 0 ? String(inv.total) : null,
            dueDate: invDueDate,
            completedAt: ["completed", "invoiced"].includes(repairStatus) ? invDate : null,
            createdAt: invDate, // use invoice date as creation date
            updatedAt: new Date(),
          })
          .returning({ id: repairJobs.id });

        await db.insert(repairJobEvents).values({
          repairJobId: job.id,
          eventType: "created",
          comment: `Auto-created from Holded invoice ${inv.docNumber || "(draft)"} — €${inv.total.toFixed(2)} — ${invStatus}`,
        });
      }

      created++;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`RESULTS (${mode}):`);
  console.log(`  Invoices total:         ${allInvoices.length}`);
  console.log(`  Already linked:         ${linkedInvoiceIds.size}`);
  console.log(`  Unlinked invoices:      ${unlinkedInvoices.length}`);
  console.log(`  No DB customer (skip):  ${noCustomer}`);
  console.log(`  Skipped (draft €0):     ${skipped}`);
  console.log(`  Skipped (non-repair):   ${skippedNonRepair}`);
  console.log(`  Repairs created:        ${created}`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
