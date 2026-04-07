"use server";

import { db } from "@/lib/db";
import {
  imports,
  importRows,
  repairJobs,
  customers,
  units,
  locations,
  repairJobRawRows,
  candidateDuplicates,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-utils";
import { createAuditLog } from "./audit";
import { slugify } from "@/lib/utils";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  parseWorkbook,
  type ParsedRow,
  type ParsedSheet,
  type SheetCategory,
} from "@/lib/import/parse-workbook";
import {
  inferStatus,
  inferFlags,
  inferCustomerResponse,
  inferBusinessProcessType,
  inferInvoiceStatus,
} from "@/lib/import/infer";
import {
  resolveCustomers,
  resolveUnits,
  detectDuplicates,
  parseRegistrationField,
} from "@/lib/import/resolve";

// ─── Main import pipeline ───────────────────────────────────────────────────

export interface ImportResult {
  importId: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  duplicateRows: number;
  lowConfidenceRows: number;
  sheetsProcessed: string[];
  warnings: string[];
}

/**
 * Full import pipeline: parse → preserve raw → classify → infer → resolve → create
 */
export async function runImportPipeline(
  buffer: Buffer,
  filename: string,
  userId: string
): Promise<ImportResult> {
  // 1. Parse workbook
  const parsed = parseWorkbook(buffer, filename);

  // 2. Create import batch record
  const [importRecord] = await db
    .insert(imports)
    .values({
      filename,
      userId,
      totalRows: parsed.totalRows,
      status: "processing",
      startedAt: new Date(),
      sheetsProcessed: parsed.sheets.map((s) => s.sheetName),
    })
    .returning();

  const importId = importRecord.id;
  const warnings: string[] = [];

  if (parsed.skippedSheets.length > 0) {
    warnings.push(`Skipped sheets: ${parsed.skippedSheets.join(", ")}`);
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalDuplicates = 0;
  let totalLowConfidence = 0;

  // 3. Ensure locations exist for all sheets
  const locationMap = await ensureLocations(parsed.sheets);

  // 4. Collect ALL record rows across all sheets for global dedup
  const allRecordRows: { row: ParsedRow; sheet: ParsedSheet }[] = [];
  for (const sheet of parsed.sheets) {
    for (const row of sheet.rows) {
      allRecordRows.push({ row, sheet });
    }
  }

  // 5. Detect duplicates across sheets
  const allRows = allRecordRows.map((r) => r.row);
  const duplicateCandidates = detectDuplicates(allRows);

  // 6. Resolve customers and units globally
  const customerCandidates = resolveCustomers(allRows);
  const unitCandidates = resolveUnits(allRows);

  // Build customer name → id map
  const customerIdMap = new Map<string, string>();
  for (const [normalizedName, candidate] of customerCandidates) {
    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.name, candidate.name))
      .limit(1);

    if (existing) {
      customerIdMap.set(normalizedName, existing.id);
    } else {
      const [newCust] = await db
        .insert(customers)
        .values({
          name: candidate.name,
          provisional: true,
          confidenceScore: 0.7,
        })
        .returning();
      customerIdMap.set(normalizedName, newCust.id);
    }
  }

  // Build unit key → id map
  const unitIdMap = new Map<string, string>();
  for (const [key, candidate] of unitCandidates) {
    const [existing] = candidate.registration
      ? await db
          .select()
          .from(units)
          .where(eq(units.registration, candidate.registration))
          .limit(1)
      : [null];

    if (existing) {
      unitIdMap.set(key, existing.id);
    } else {
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
  }

  // 7. Process each sheet
  for (const sheet of parsed.sheets) {
    for (const row of sheet.rows) {
      try {
        if (row.rowClass === "empty") {
          await insertImportRow(importId, filename, row, "skipped", null);
          totalSkipped++;
          continue;
        }

        if (row.rowClass === "header" || row.rowClass === "divider") {
          await insertImportRow(importId, filename, row, "skipped", null);
          totalSkipped++;
          continue;
        }

        // Infer status
        const allText = row.originalJoinedText;
        const statusResult = inferStatus(row.mappedStatus, allText);
        const flags = inferFlags(
          row.mappedIssue,
          row.mappedNotes,
          row.mappedExtra,
          row.mappedRegistration
        );
        const customerResp = inferCustomerResponse(
          row.mappedStatus,
          row.mappedNotes,
          row.mappedExtra
        );
        const businessType = inferBusinessProcessType(
          sheet.category,
          row.mappedIssue,
          row.mappedNotes
        );
        const invoiceStatus = inferInvoiceStatus(allText);

        if (statusResult.confidence === "low") totalLowConfidence++;

        // Resolve customer & unit IDs
        let customerId: string | null = null;
        if (row.mappedCustomer) {
          const normName = row.mappedCustomer
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
          customerId = customerIdMap.get(normName) ?? null;
        }

        let unitId: string | null = null;
        if (row.mappedRegistration || row.mappedInternalId) {
          const regNorm = row.mappedRegistration
            ? row.mappedRegistration
                .trim()
                .toUpperCase()
                .replace(/[\s\-\.]+/g, "")
            : "";
          const intId = row.mappedInternalId?.trim() || "";
          const key = `${regNorm}|||${intId}`.toLowerCase();
          unitId = unitIdMap.get(key) ?? null;
        }

        // Find location
        const locationSlug = row.mappedLocation
          ? slugify(row.mappedLocation)
          : slugify(sheet.sheetName);
        const locationId = locationMap.get(locationSlug) ?? null;

        // Create repair job
        const title =
          row.mappedIssue?.slice(0, 200) ||
          [row.mappedCustomer, row.mappedRegistration]
            .filter(Boolean)
            .join(" - ") ||
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
            businessProcessType: businessType,
            customerResponseStatus: customerResp.status,
            invoiceStatus,
            ...flags,
          })
          .returning();

        // Insert import row with links
        const [importRow] = await insertImportRow(
          importId,
          filename,
          row,
          "imported",
          job.id,
          customerId,
          unitId,
          statusResult,
          flags
        );

        // Create raw row link
        await db.insert(repairJobRawRows).values({
          repairJobId: job.id,
          importRowId: importRow.id,
          linkType: "primary",
        });

        totalImported++;
      } catch (err) {
        await insertImportRow(
          importId,
          filename,
          row,
          "error",
          null,
          null,
          null,
          null,
          null,
          [err instanceof Error ? err.message : "Unknown error"]
        );
        totalErrors++;
      }
    }
  }

  // 8. Store duplicate candidates
  if (duplicateCandidates.length > 0) {
    // Get all import row IDs for this batch, indexed by sourceSheet+sourceRowNumber
    const importRowRecords = await db
      .select({ id: importRows.id, sourceSheet: importRows.sourceSheet, sourceRowNumber: importRows.sourceRowNumber })
      .from(importRows)
      .where(eq(importRows.importId, importId));

    const rowLookup = new Map<string, string>();
    for (const ir of importRowRecords) {
      rowLookup.set(`${ir.sourceSheet}|||${ir.sourceRowNumber}`, ir.id);
    }

    for (const dup of duplicateCandidates) {
      const rowA = allRows[dup.rowIndexA];
      const rowB = allRows[dup.rowIndexB];
      const rowAId = rowLookup.get(
        `${rowA.sourceSheet}|||${rowA.sourceRowNumber}`
      );
      const rowBId = rowLookup.get(
        `${rowB.sourceSheet}|||${rowB.sourceRowNumber}`
      );

      if (rowAId && rowBId) {
        await db.insert(candidateDuplicates).values({
          importRowAId: rowAId,
          importRowBId: rowBId,
          confidence: dup.confidence,
          reason: dup.reason,
          status: "pending",
        });
        totalDuplicates++;
      }
    }
  }

  // 9. Finalize import
  const finalStatus =
    totalErrors > 0 && totalImported === 0
      ? "failed"
      : totalErrors > 0
        ? "completed_with_errors"
        : "completed";

  await db
    .update(imports)
    .set({
      status: finalStatus as "failed" | "completed_with_errors" | "completed",
      importedRows: totalImported,
      skippedRows: totalSkipped,
      errorRows: totalErrors,
      duplicateRows: totalDuplicates,
      lowConfidenceRows: totalLowConfidence,
      warnings: warnings.length > 0 ? warnings : null,
      completedAt: new Date(),
    })
    .where(eq(imports.id, importId));

  await createAuditLog("import", "import", importId, {
    imported: totalImported,
    skipped: totalSkipped,
    errors: totalErrors,
    duplicates: totalDuplicates,
  });
  revalidatePath("/");
  revalidatePath("/repairs");
  revalidatePath("/import");

  return {
    importId,
    totalRows: parsed.totalRows,
    importedRows: totalImported,
    skippedRows: totalSkipped,
    errorRows: totalErrors,
    duplicateRows: totalDuplicates,
    lowConfidenceRows: totalLowConfidence,
    sheetsProcessed: parsed.sheets.map((s) => s.sheetName),
    warnings,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ensureLocations(
  sheets: ParsedSheet[]
): Promise<Map<string, string>> {
  const existing = await db.select().from(locations);
  const locationMap = new Map(existing.map((l) => [l.slug, l.id]));

  const sheetLocationMap: Record<
    string,
    { name: string; category: SheetCategory }
  > = {};

  for (const sheet of sheets) {
    const slug = slugify(sheet.sheetName);
    sheetLocationMap[slug] = {
      name: sheet.sheetName,
      category: sheet.category,
    };

    // Also extract location names from rows (Col A may differ from sheet name)
    for (const row of sheet.rows) {
      if (row.mappedLocation && row.rowClass === "record") {
        const locSlug = slugify(row.mappedLocation);
        if (!sheetLocationMap[locSlug]) {
          sheetLocationMap[locSlug] = {
            name: row.mappedLocation,
            category: sheet.category,
          };
        }
      }
    }
  }

  for (const [slug, info] of Object.entries(sheetLocationMap)) {
    if (!locationMap.has(slug)) {
      const [newLoc] = await db
        .insert(locations)
        .values({
          name: info.name,
          slug,
          sourceSheetName: info.name,
          sourceCategory: info.category,
        })
        .onConflictDoNothing()
        .returning();
      if (newLoc) locationMap.set(slug, newLoc.id);
    }
  }

  return locationMap;
}

async function insertImportRow(
  importId: string,
  filename: string,
  row: ParsedRow,
  status: "pending" | "imported" | "skipped" | "error" | "duplicate" | "merged",
  repairJobId: string | null,
  customerId?: string | null,
  unitId?: string | null,
  statusResult?: { status: string; confidence: string; reason: string } | null,
  flags?: Record<string, boolean> | null,
  errors?: string[]
) {
  return db
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
      status,
      mappedLocation: row.mappedLocation,
      mappedBayRef: row.mappedBayRef,
      mappedCustomer: row.mappedCustomer,
      mappedInternalId: row.mappedInternalId,
      mappedRegistration: row.mappedRegistration,
      mappedIssue: row.mappedIssue,
      mappedNotes: row.mappedNotes,
      mappedStatus: row.mappedStatus,
      mappedExtra: row.mappedExtra,
      inferredStatus: statusResult?.status as typeof repairJobs.$inferSelect.status | undefined,
      inferredStatusReason: statusResult?.reason,
      inferredStatusConfidence: statusResult?.confidence as "high" | "medium" | "low" | "manual" | undefined,
      inferredFlags: flags ?? null,
      repairJobId,
      customerId: customerId ?? null,
      unitId: unitId ?? null,
      errors: errors ?? null,
    })
    .returning();
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getImports() {
  await requireRole("viewer");
  return db.select().from(imports).orderBy(desc(imports.createdAt));
}

export async function getImportById(importId: string) {
  await requireRole("viewer");
  const [importRecord] = await db
    .select()
    .from(imports)
    .where(eq(imports.id, importId))
    .limit(1);
  return importRecord ?? null;
}

export async function getImportRows(
  importId: string,
  options?: {
    status?: string;
    sheet?: string;
    limit?: number;
    offset?: number;
  }
) {
  await requireRole("viewer");

  const conditions = [eq(importRows.importId, importId)];
  if (options?.status) {
    conditions.push(
      eq(importRows.status, options.status as "pending" | "imported" | "skipped" | "error" | "duplicate" | "merged")
    );
  }
  if (options?.sheet) {
    conditions.push(eq(importRows.sourceSheet, options.sheet));
  }

  const rows = await db
    .select()
    .from(importRows)
    .where(and(...conditions))
    .orderBy(importRows.sourceSheet, importRows.sourceRowNumber)
    .limit(options?.limit ?? 100)
    .offset(options?.offset ?? 0);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(importRows)
    .where(and(...conditions));

  return { rows, total: Number(countResult.count) };
}

export async function getImportDuplicates(importId: string) {
  await requireRole("viewer");

  const rows = await db
    .select()
    .from(candidateDuplicates)
    .innerJoin(importRows, eq(candidateDuplicates.importRowAId, importRows.id))
    .where(eq(importRows.importId, importId))
    .orderBy(desc(candidateDuplicates.confidence));

  return rows;
}

export async function getImportSheetSummary(importId: string) {
  await requireRole("viewer");

  const summary = await db
    .select({
      sourceSheet: importRows.sourceSheet,
      total: sql<number>`count(*)`,
      imported: sql<number>`count(*) filter (where ${importRows.status} = 'imported')`,
      skipped: sql<number>`count(*) filter (where ${importRows.status} = 'skipped')`,
      errors: sql<number>`count(*) filter (where ${importRows.status} = 'error')`,
    })
    .from(importRows)
    .where(eq(importRows.importId, importId))
    .groupBy(importRows.sourceSheet);

  return summary;
}
