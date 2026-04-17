/**
 * One-off: for given spreadsheet_internal_id values, report Holded invoice link (PDF).
 * Usage: npx tsx scripts/audit-spreadsheet-invoice-links.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { repairJobs, customers } from "../src/lib/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

/** Normalized spreadsheet ids from your list (name hints are for human cross-check only). */
const CASES: { id: string; note?: string }[] = [
  { id: "1307", note: "Zuilen" },
  { id: "236", note: "Lizanne Fransen" },
  { id: "64", note: "Steltenpool" },
  { id: "906", note: "Lossie" },
  { id: "540", note: "de Leeuw" },
  { id: "59", note: "Trinh" },
  { id: "1256", note: "Fred Colijn" },
  { id: "679", note: "John van Dalen" },
  { id: "254", note: "Pronk" },
  { id: "988", note: "Wouter Kramps" },
  { id: "918", note: "Chantal Wouters" },
  { id: "357", note: "Davy Suijkerbuijk" },
  { id: "190", note: "J. Bezembinder" },
  { id: "106", note: "van Deijl – Choufour (0,01 payment?)" },
  { id: "1275", note: "ramos" },
  { id: "583", note: "Ivonne Karssen" },
  { id: "165", note: "Van Dijk, Niels" },
  { id: "749", note: "Heeren, Remco" },
  { id: "208", note: "Horst" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }

  const ids = CASES.map((c) => c.id);
  const rows = await db
    .select({
      id: repairJobs.id,
      spreadsheetInternalId: repairJobs.spreadsheetInternalId,
      title: repairJobs.title,
      holdedInvoiceId: repairJobs.holdedInvoiceId,
      holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      invoiceStatus: repairJobs.invoiceStatus,
      customerName: customers.name,
    })
    .from(repairJobs)
    .leftJoin(customers, eq(repairJobs.customerId, customers.id))
    .where(
      and(
        isNull(repairJobs.deletedAt),
        sql`trim(${repairJobs.spreadsheetInternalId}) in (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )})`,
      ),
    );

  const bySpreadsheet = new Map(rows.map((r) => [(r.spreadsheetInternalId ?? "").trim(), r] as const));

  console.log("spreadsheet_id | PDF OK (holded_invoice_id) | invoice # | status | customer | note");
  console.log("-".repeat(100));

  for (const c of CASES) {
    const row = bySpreadsheet.get(c.id);
    if (!row) {
      console.log(`${c.id.padEnd(14)} | GEEN REPARATIE (id niet gevonden of soft-deleted) | | | | ${c.note ?? ""}`);
      continue;
    }
    const pdfOk = Boolean(row.holdedInvoiceId);
    const inv = row.holdedInvoiceNum ?? "—";
    const st = row.invoiceStatus ?? "—";
    const name = (row.customerName ?? "?").slice(0, 28);
    console.log(
      `${c.id.padEnd(14)} | ${pdfOk ? "ja" : "NEE"}`.padEnd(28) +
        ` | ${String(inv).padEnd(9)} | ${String(st).padEnd(6)} | ${name.padEnd(30)} | ${c.note ?? ""}`,
    );
  }

  const missing = CASES.filter((c) => {
    const row = bySpreadsheet.get(c.id);
    return !row || !row.holdedInvoiceId;
  });
  console.log("\nSamenvatting: zonder gekoppelde factuur (dus geen juiste invoice-PDF via panel):", missing.length);
  if (missing.length) {
    for (const m of missing) {
      const row = bySpreadsheet.get(m.id);
      console.log(`  - ${m.id} (${m.note})${row ? "" : " — geen job"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
