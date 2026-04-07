import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  users,
  locations,
  tags,
  imports,
  importRows,
  repairJobs,
  customers,
  units,
  repairJobRawRows,
  candidateDuplicates,
} from "./schema";
import { parseWorkbook } from "../import/parse-workbook";
import {
  inferStatus,
  inferFlags,
  inferCustomerResponse,
  inferBusinessProcessType,
  inferInvoiceStatus,
} from "../import/infer";
import {
  resolveCustomers,
  resolveUnits,
  detectDuplicates,
  normalizeCustomerName,
  normalizeRegistration,
} from "../import/resolve";
import { slugify } from "../utils";
import type { SheetCategory } from "../import/parse-workbook";
import { eq } from "drizzle-orm";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Seeding database...\n");

  // ── 1. Admin user ─────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@repair.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";
  const hashedPassword = await hash(adminPassword, 12);

  const [admin] = await db
    .insert(users)
    .values({
      name: "Admin",
      email: adminEmail,
      passwordHash: hashedPassword,
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  const adminId = admin?.id;
  console.log(admin ? `✓ Admin user created: ${adminEmail}` : `• Admin exists: ${adminEmail}`);

  // ── 2. Locations (from workbook sheet names) ──────────────────────────────
  const locationData: { name: string; slug: string; sourceSheetName: string; sourceCategory: string }[] = [
    { name: "Sheet1 (Legacy)", slug: "sheet1", sourceSheetName: "Sheet1", sourceCategory: "legacy" },
    { name: "Cruïllas", slug: "cruillas", sourceSheetName: "cruillas", sourceCategory: "workshop" },
    { name: "Peratallada", slug: "peratallada", sourceSheetName: "peratallada", sourceCategory: "workshop" },
    { name: "Sant Climent", slug: "sant-climent", sourceSheetName: "sant climent", sourceCategory: "workshop" },
    { name: "England Planning", slug: "plan-for-when-im-in-england", sourceSheetName: "Plan for when im in england", sourceCategory: "planning" },
    { name: "Contact Queue", slug: "sheet2", sourceSheetName: "Sheet2", sourceCategory: "contact_queue" },
    { name: "Trailer Sales", slug: "trailers-sale", sourceSheetName: "trailers sale", sourceCategory: "trailer_sales" },
  ];

  const locationMap = new Map<string, string>();
  for (const loc of locationData) {
    const [created] = await db
      .insert(locations)
      .values(loc)
      .onConflictDoNothing()
      .returning();
    if (created) {
      locationMap.set(loc.slug, created.id);
      console.log(`✓ Location: ${loc.name}`);
    } else {
      const [existing] = await db.select().from(locations).where(eq(locations.slug, loc.slug)).limit(1);
      if (existing) locationMap.set(loc.slug, existing.id);
      console.log(`• Location exists: ${loc.name}`);
    }
  }

  // ── 3. Tags (workshop repair taxonomy) ────────────────────────────────────
  const tagData = [
    { name: "Tyres", slug: "tyres", color: "#6366f1" },
    { name: "Lights", slug: "lights", color: "#eab308" },
    { name: "Rear Lights", slug: "rear-lights", color: "#f59e0b" },
    { name: "Brake Cable", slug: "brake-cable", color: "#ef4444" },
    { name: "Door Lock", slug: "door-lock", color: "#8b5cf6" },
    { name: "Water Damage Risk", slug: "water-damage-risk", color: "#06b6d4" },
    { name: "Window", slug: "window", color: "#3b82f6" },
    { name: "Seals / Rubber", slug: "seals-rubber", color: "#14b8a6" },
    { name: "Bodywork", slug: "bodywork", color: "#f97316" },
    { name: "Electrical", slug: "electrical", color: "#a855f7" },
    { name: "Gas System", slug: "gas-system", color: "#dc2626" },
    { name: "Warranty", slug: "warranty", color: "#22c55e" },
    { name: "Insurance Claim", slug: "insurance-claim", color: "#2563eb" },
    { name: "Annual Service", slug: "annual-service", color: "#ec4899" },
    { name: "Damp Check", slug: "damp-check", color: "#0ea5e9" },
    { name: "Pre-Sale Inspection", slug: "pre-sale", color: "#d946ef" },
    { name: "Our Costs / Internal", slug: "our-costs", color: "#84cc16" },
  ];

  for (const tag of tagData) {
    const [created] = await db
      .insert(tags)
      .values(tag)
      .onConflictDoNothing()
      .returning();
    if (created) console.log(`✓ Tag: ${tag.name}`);
  }

  // ── 4. Import workbook ────────────────────────────────────────────────────
  const workbookPath = resolve(process.cwd(), "data/source-workbook.xlsx");
  if (!existsSync(workbookPath)) {
    console.log("\n⚠ No workbook found at data/source-workbook.xlsx — skipping import");
    console.log("  Place the workbook there and re-run db:seed to import");
    console.log("\n✅ Seeding complete (without workbook import)!");
    return;
  }

  console.log("\n── Importing workbook ──────────────────────────────────────");
  const buffer = readFileSync(workbookPath);
  const filename = "source-workbook.xlsx";
  const parsed = parseWorkbook(buffer, filename);

  console.log(`  Parsed ${parsed.totalRows} rows from ${parsed.sheets.length} sheets`);
  console.log(`  Skipped sheets: ${parsed.skippedSheets.join(", ") || "none"}`);

  // Create import batch
  const [importRecord] = await db
    .insert(imports)
    .values({
      filename,
      userId: adminId ?? null,
      totalRows: parsed.totalRows,
      status: "processing",
      startedAt: new Date(),
      sheetsProcessed: parsed.sheets.map((s) => s.sheetName),
    })
    .returning();

  const importId = importRecord.id;

  // Collect all record rows
  const allRows = parsed.sheets.flatMap((s) => s.rows);
  const recordRows = allRows.filter((r) => r.rowClass === "record");

  // Detect duplicates
  const duplicateCandidates = detectDuplicates(allRows);
  console.log(`  Found ${duplicateCandidates.length} potential duplicate pairs`);

  // Resolve customers
  const customerCandidates = resolveCustomers(allRows);
  console.log(`  Resolved ${customerCandidates.size} unique customers`);
  const customerIdMap = new Map<string, string>();

  for (const [normName, candidate] of customerCandidates) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.name, candidate.name))
      .limit(1);

    if (existing) {
      customerIdMap.set(normName, existing.id);
    } else {
      const [newCust] = await db
        .insert(customers)
        .values({ name: candidate.name, provisional: true, confidenceScore: 0.7 })
        .returning();
      customerIdMap.set(normName, newCust.id);
    }
  }

  // Resolve units
  const unitCandidates = resolveUnits(allRows);
  console.log(`  Resolved ${unitCandidates.size} unique units`);
  const unitIdMap = new Map<string, string>();

  for (const [key, candidate] of unitCandidates) {
    const isTrailer =
      candidate.registrationRaw.toLowerCase().includes("trailer") ||
      candidate.registrationRaw.toLowerCase().includes("css");

    const [newUnit] = await db
      .insert(units)
      .values({
        unitType: isTrailer ? "trailer" : "unknown",
        registration: candidate.registration,
        brand: candidate.brand,
        model: candidate.model,
        internalNumber: candidate.internalNumber,
        registrationRaw: candidate.registrationRaw,
        provisional: true,
      })
      .returning();
    unitIdMap.set(key, newUnit.id);
  }

  // Process rows
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let lowConfidence = 0;

  for (const sheet of parsed.sheets) {
    const sheetSlug = slugify(sheet.sheetName);

    for (const row of sheet.rows) {
      try {
        if (row.rowClass !== "record") {
          await db.insert(importRows).values({
            importId,
            sourceWorkbook: filename,
            sourceSheet: row.sourceSheet,
            sourceRowNumber: row.sourceRowNumber,
            originalCellsJson: row.originalCells,
            originalJoinedText: row.originalJoinedText,
            fingerprint: row.fingerprint,
            rowClass: row.rowClass,
            status: "skipped",
            mappedLocation: row.mappedLocation,
            mappedBayRef: row.mappedBayRef,
            mappedCustomer: row.mappedCustomer,
            mappedInternalId: row.mappedInternalId,
            mappedRegistration: row.mappedRegistration,
            mappedIssue: row.mappedIssue,
            mappedNotes: row.mappedNotes,
            mappedStatus: row.mappedStatus,
            mappedExtra: row.mappedExtra,
          });
          skipped++;
          continue;
        }

        const allText = row.originalJoinedText;
        const statusResult = inferStatus(row.mappedStatus, allText);
        const flags = inferFlags(row.mappedIssue, row.mappedNotes, row.mappedExtra, row.mappedRegistration);
        const custResp = inferCustomerResponse(row.mappedStatus, row.mappedNotes, row.mappedExtra);
        const bizType = inferBusinessProcessType(sheet.category, row.mappedIssue, row.mappedNotes);
        const invoiceSt = inferInvoiceStatus(allText);

        if (statusResult.confidence === "low") lowConfidence++;

        // Resolve IDs
        let customerId: string | null = null;
        if (row.mappedCustomer) {
          const norm = normalizeCustomerName(row.mappedCustomer);
          customerId = customerIdMap.get(norm) ?? null;
        }

        let unitId: string | null = null;
        if (row.mappedRegistration || row.mappedInternalId) {
          const regNorm = row.mappedRegistration
            ? normalizeRegistration(row.mappedRegistration)
            : "";
          const intId = row.mappedInternalId?.trim() || "";
          unitId = unitIdMap.get(`${regNorm}|||${intId}`.toLowerCase()) ?? null;
        }

        // Location: prefer row's mapped location, fallback to sheet
        const locSlug = row.mappedLocation
          ? slugify(row.mappedLocation)
          : sheetSlug;

        // Ensure location exists
        if (!locationMap.has(locSlug) && row.mappedLocation) {
          const [newLoc] = await db
            .insert(locations)
            .values({
              name: row.mappedLocation,
              slug: locSlug,
              sourceSheetName: sheet.sheetName,
              sourceCategory: sheet.category,
            })
            .onConflictDoNothing()
            .returning();
          if (newLoc) locationMap.set(locSlug, newLoc.id);
        }
        const locationId = locationMap.get(locSlug) ?? null;

        const title =
          row.mappedIssue?.slice(0, 200) ||
          [row.mappedCustomer, row.mappedRegistration].filter(Boolean).join(" - ") ||
          `Import: ${sheet.sheetName} row ${row.sourceRowNumber + 1}`;

        const [job] = await db
          .insert(repairJobs)
          .values({
            sourceCategory: sheet.category,
            sourceSheet: sheet.sheetName,
            locationId,
            customerId,
            unitId,
            title,
            descriptionRaw: row.mappedIssue,
            notesRaw: row.mappedNotes,
            extraNotesRaw: row.mappedExtra,
            bayReference: row.mappedBayRef,
            spreadsheetInternalId: row.mappedInternalId,
            status: statusResult.status,
            statusReason: statusResult.reason,
            statusConfidence: statusResult.confidence,
            priority: flags.safetyFlag ? "urgent" : "normal",
            businessProcessType: bizType,
            customerResponseStatus: custResp.status,
            invoiceStatus: invoiceSt,
            ...flags,
          })
          .returning();

        const [importRow] = await db
          .insert(importRows)
          .values({
            importId,
            sourceWorkbook: filename,
            sourceSheet: row.sourceSheet,
            sourceRowNumber: row.sourceRowNumber,
            originalCellsJson: row.originalCells,
            originalJoinedText: row.originalJoinedText,
            fingerprint: row.fingerprint,
            rowClass: row.rowClass,
            status: "imported",
            mappedLocation: row.mappedLocation,
            mappedBayRef: row.mappedBayRef,
            mappedCustomer: row.mappedCustomer,
            mappedInternalId: row.mappedInternalId,
            mappedRegistration: row.mappedRegistration,
            mappedIssue: row.mappedIssue,
            mappedNotes: row.mappedNotes,
            mappedStatus: row.mappedStatus,
            mappedExtra: row.mappedExtra,
            inferredStatus: statusResult.status,
            inferredStatusReason: statusResult.reason,
            inferredStatusConfidence: statusResult.confidence,
            inferredFlags: flags,
            repairJobId: job.id,
            customerId,
            unitId,
          })
          .returning();

        await db.insert(repairJobRawRows).values({
          repairJobId: job.id,
          importRowId: importRow.id,
          linkType: "primary",
        });

        imported++;
      } catch (err) {
        await db.insert(importRows).values({
          importId,
          sourceWorkbook: filename,
          sourceSheet: row.sourceSheet,
          sourceRowNumber: row.sourceRowNumber,
          originalCellsJson: row.originalCells,
          originalJoinedText: row.originalJoinedText,
          fingerprint: row.fingerprint,
          rowClass: row.rowClass,
          status: "error",
          mappedLocation: row.mappedLocation,
          mappedBayRef: row.mappedBayRef,
          mappedCustomer: row.mappedCustomer,
          mappedInternalId: row.mappedInternalId,
          mappedRegistration: row.mappedRegistration,
          mappedIssue: row.mappedIssue,
          mappedNotes: row.mappedNotes,
          mappedStatus: row.mappedStatus,
          mappedExtra: row.mappedExtra,
          errors: [err instanceof Error ? err.message : "Unknown error"],
        });
        errors++;
      }
    }

    console.log(`  [${sheet.sheetName}] processed`);
  }

  // Store duplicate candidates
  if (duplicateCandidates.length > 0) {
    const importRowRecords = await db
      .select({ id: importRows.id, sourceSheet: importRows.sourceSheet, sourceRowNumber: importRows.sourceRowNumber })
      .from(importRows)
      .where(eq(importRows.importId, importId));

    const rowLookup = new Map<string, string>();
    for (const ir of importRowRecords) {
      rowLookup.set(`${ir.sourceSheet}|||${ir.sourceRowNumber}`, ir.id);
    }

    let dupCount = 0;
    for (const dup of duplicateCandidates) {
      const rowA = allRows[dup.rowIndexA];
      const rowB = allRows[dup.rowIndexB];
      const rowAId = rowLookup.get(`${rowA.sourceSheet}|||${rowA.sourceRowNumber}`);
      const rowBId = rowLookup.get(`${rowB.sourceSheet}|||${rowB.sourceRowNumber}`);

      if (rowAId && rowBId) {
        await db.insert(candidateDuplicates).values({
          importRowAId: rowAId,
          importRowBId: rowBId,
          confidence: dup.confidence,
          reason: dup.reason,
          status: "pending",
        });
        dupCount++;
      }
    }
    console.log(`  Stored ${dupCount} duplicate candidates for review`);
  }

  // Finalize import
  const finalStatus = errors > 0 && imported === 0
    ? "failed"
    : errors > 0
      ? "completed_with_errors"
      : "completed";

  await db
    .update(imports)
    .set({
      status: finalStatus as "failed" | "completed_with_errors" | "completed",
      importedRows: imported,
      skippedRows: skipped,
      errorRows: errors,
      duplicateRows: duplicateCandidates.length,
      lowConfidenceRows: lowConfidence,
      completedAt: new Date(),
    })
    .where(eq(imports.id, importId));

  console.log(`\n── Import Summary ─────────────────────────────────────────`);
  console.log(`  Total rows:     ${parsed.totalRows}`);
  console.log(`  Imported:       ${imported}`);
  console.log(`  Skipped:        ${skipped}`);
  console.log(`  Errors:         ${errors}`);
  console.log(`  Duplicates:     ${duplicateCandidates.length}`);
  console.log(`  Low confidence: ${lowConfidence}`);

  console.log("\n✅ Seeding complete!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
