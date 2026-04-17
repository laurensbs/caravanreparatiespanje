/**
 * One-shot: fetch every Holded invoice once (full body), then link unlinked repairs
 * when kenteken / spreadsheet id / public code appears in the invoice text.
 *
 *   npx tsx scripts/one-shot-global-invoice-body-link.ts [--dry-run]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { repairJobs, repairJobEvents, units } from "../src/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { isHoldedConfigured } from "../src/lib/holded/client";
import { listAllInvoices, getInvoice, type HoldedInvoice } from "../src/lib/holded/invoices";
import { isNonRepairInvoice } from "../src/lib/holded/filter";
import {
  buildHoldedInvoiceHaystackLower,
  compactAlnum,
  matchesSpreadsheetRefInText,
  pickRepairForHoldedDocument,
  repairPublicCodeAppearsInText,
  type RepairHoldedMatchFields,
} from "../src/lib/holded/repair-ref-match";

const DRY_RUN = process.argv.includes("--dry-run");
const PAYMENT_TOLERANCE_EUR = 0.05;

const earlyStatuses = [
  "new",
  "todo",
  "in_inspection",
  "quote_needed",
  "waiting_approval",
  "waiting_customer",
  "waiting_parts",
  "scheduled",
  "in_progress",
  "blocked",
  "completed",
];

function getPartiallyPaidRemaining(invoice: HoldedInvoice): number | null {
  if (typeof invoice.due === "number") return Math.abs(invoice.due);
  if (invoice.payments && invoice.payments.length > 0) {
    const totalPaid = invoice.payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    return Math.max(0, invoice.total - totalPaid);
  }
  return null;
}

function holdedInvoiceStatus(invoice: HoldedInvoice): "draft" | "sent" | "paid" {
  if (invoice.status === 1) return "paid";
  if (invoice.status === 2) {
    const remaining = getPartiallyPaidRemaining(invoice);
    if (remaining !== null && remaining <= PAYMENT_TOLERANCE_EUR) return "paid";
    if (remaining === null && invoice.total > 0 && invoice.total <= PAYMENT_TOLERANCE_EUR * 2) {
      return "paid";
    }
  }
  if (invoice.draft || !invoice.docNumber || invoice.docNumber === "---") return "draft";
  return "sent";
}

async function main() {
  if (!isHoldedConfigured()) {
    console.error("Holded not configured");
    process.exit(1);
  }

  console.log(DRY_RUN ? "DRY RUN\n" : "LIVE\n");

  const allInvoices = await listAllInvoices();
  for (const inv of allInvoices) {
    if (inv.status === 2 && getPartiallyPaidRemaining(inv) === null) {
      try {
        const detail = await getInvoice(inv.id);
        if (detail.payments) inv.payments = detail.payments;
        if (typeof detail.due === "number") inv.due = detail.due;
      } catch {
        /* keep list */
      }
    }
  }

  const fullById = new Map<string, HoldedInvoice>();
  console.log(`Prefetch ${allInvoices.length} invoice bodies…`);
  for (const inv of allInvoices) {
    try {
      fullById.set(inv.id, await getInvoice(inv.id));
    } catch {
      /* skip */
    }
  }
  console.log(`Loaded ${fullById.size} full invoices\n`);

  const allRepairs = await db
    .select({
      id: repairJobs.id,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      invoiceStatus: repairJobs.invoiceStatus,
      publicCode: repairJobs.publicCode,
      spreadsheetInternalId: repairJobs.spreadsheetInternalId,
      title: repairJobs.title,
      status: repairJobs.status,
      completedAt: repairJobs.completedAt,
      createdAt: repairJobs.createdAt,
      registration: units.registration,
    })
    .from(repairJobs)
    .leftJoin(units, eq(repairJobs.unitId, units.id))
    .where(isNull(repairJobs.deletedAt));

  const repairByInvoiceId = new Map<string, (typeof allRepairs)[0]>();
  for (const r of allRepairs) {
    if (r.holdedInvoiceId) repairByInvoiceId.set(r.holdedInvoiceId, r);
  }

  const manualOverrideStatuses = ["warranty", "our_costs", "no_damage", "rejected"];
  let globalUnlinked = allRepairs.filter(
    (r) => !r.holdedInvoiceId && !manualOverrideStatuses.includes(r.invoiceStatus),
  );

  let linked = 0;
  for (const inv of allInvoices) {
    try {
      if (repairByInvoiceId.has(inv.id)) continue;
      const full = fullById.get(inv.id);
      if (!full) continue;
      if (isNonRepairInvoice(full)) continue;
      if (full.total === 0 && !full.desc) continue;

      const newStatus = holdedInvoiceStatus(full);
      const invText = buildHoldedInvoiceHaystackLower(full);
      const hayCompact = compactAlnum(invText);

      const eligible = globalUnlinked.filter((r) => {
        const spr = r.spreadsheetInternalId?.trim();
        if (spr && matchesSpreadsheetRefInText(spr, invText)) return true;
        if (repairPublicCodeAppearsInText(r.publicCode, invText)) return true;
        const reg = r.registration?.trim();
        if (reg && reg.length >= 5) {
          const rc = compactAlnum(reg);
          if (rc.length >= 5 && hayCompact.includes(rc)) return true;
        }
        return false;
      });
      if (eligible.length === 0) continue;

      const matchFields: RepairHoldedMatchFields[] = eligible.map((r) => ({
        id: r.id,
        publicCode: r.publicCode,
        spreadsheetInternalId: r.spreadsheetInternalId,
        title: r.title,
        registration: r.registration,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      }));

      const chosen = pickRepairForHoldedDocument(invText, matchFields, full.date * 1000);
      const matched = chosen ? eligible.find((r) => r.id === chosen.id) ?? null : null;
      if (!matched) continue;

      const advanceStatus =
        (newStatus === "paid" || newStatus === "sent") && earlyStatuses.includes(matched.status);

      console.log(
        `  ${DRY_RUN ? "[dry] " : ""}#${full.docNumber} → repair ${matched.id.slice(0, 8)}… (${matched.spreadsheetInternalId ?? matched.publicCode ?? "?"})`,
      );

      if (!DRY_RUN) {
        await db
          .update(repairJobs)
          .set({
            holdedInvoiceId: full.id,
            holdedInvoiceNum: full.docNumber,
            holdedInvoiceDate: new Date(full.date * 1000),
            invoiceStatus: newStatus,
            ...(advanceStatus ? { status: "invoiced" as const, completedAt: matched.completedAt ?? new Date() } : {}),
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, matched.id));

        await db.insert(repairJobEvents).values({
          repairJobId: matched.id,
          eventType: "invoice_discovered",
          fieldChanged: "holdedInvoiceId",
          oldValue: "",
          newValue: full.docNumber,
          comment: `Invoice ${full.docNumber} linked — one-shot body match (${newStatus})`,
        });

        matched.holdedInvoiceId = full.id;
        matched.invoiceStatus = newStatus;
        repairByInvoiceId.set(full.id, matched);
      }
      globalUnlinked = globalUnlinked.filter((r) => r.id !== matched.id);
      linked++;
    } catch (e) {
      console.warn("skip", inv.id, e);
    }
  }

  console.log(`\nLinked (or would link): ${linked}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
