/**
 * Backfill repair_jobs.spreadsheet_internal_id from import_rows.mapped_internal_id
 * (direct repair_job_id on row, or via repair_job_raw_rows junction).
 */
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { db } from "../src/lib/db";
import { importRows, repairJobRawRows, repairJobs } from "../src/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

const DRY_RUN = process.argv.includes("--dry-run");
const OVERWRITE_MISMATCH = process.argv.includes("--overwrite-mismatch");

type Best = { internalId: string; sourceRowNumber: number };

function consider(bestByJob: Map<string, Best>, jobId: string, mapped: string | null, rowNum: number) {
  const trimmed = mapped?.trim();
  if (!trimmed) return;
  const prev = bestByJob.get(jobId);
  if (!prev || rowNum < prev.sourceRowNumber) {
    bestByJob.set(jobId, { internalId: trimmed, sourceRowNumber: rowNum });
  }
}

export async function runBackfillSpreadsheetIds(opts?: { dryRun?: boolean }): Promise<{
  updated: number;
  skippedAlready: number;
  skippedConflict: number;
  skippedNoJob: number;
}> {
  const dryRun = opts?.dryRun ?? false;
  const bestByJob = new Map<string, Best>();

  const direct = await db
    .select({
      repairJobId: importRows.repairJobId,
      mappedInternalId: importRows.mappedInternalId,
      sourceRowNumber: importRows.sourceRowNumber,
    })
    .from(importRows)
    .where(and(isNotNull(importRows.repairJobId), isNotNull(importRows.mappedInternalId)));

  for (const row of direct) {
    if (!row.repairJobId) continue;
    consider(bestByJob, row.repairJobId, row.mappedInternalId, row.sourceRowNumber);
  }

  const viaJunction = await db
    .select({
      repairJobId: repairJobRawRows.repairJobId,
      mappedInternalId: importRows.mappedInternalId,
      sourceRowNumber: importRows.sourceRowNumber,
    })
    .from(repairJobRawRows)
    .innerJoin(importRows, eq(repairJobRawRows.importRowId, importRows.id))
    .where(isNotNull(importRows.mappedInternalId));

  for (const row of viaJunction) {
    consider(bestByJob, row.repairJobId, row.mappedInternalId, row.sourceRowNumber);
  }

  let updated = 0;
  let skippedAlready = 0;
  let skippedConflict = 0;
  let skippedNoJob = 0;

  for (const [jobId, best] of bestByJob) {
    const [job] = await db
      .select({
        id: repairJobs.id,
        spreadsheetInternalId: repairJobs.spreadsheetInternalId,
        deletedAt: repairJobs.deletedAt,
      })
      .from(repairJobs)
      .where(eq(repairJobs.id, jobId))
      .limit(1);

    if (!job || job.deletedAt) {
      skippedNoJob++;
      continue;
    }

    const current = job.spreadsheetInternalId?.trim() ?? "";
    if (current === best.internalId) {
      skippedAlready++;
      continue;
    }
    if (current && current !== best.internalId) {
      if (!OVERWRITE_MISMATCH) {
        console.warn(
          `  conflict ${jobId.slice(0, 8)}… DB="${current}" import="${best.internalId}" (use --overwrite-mismatch)`,
        );
        skippedConflict++;
        continue;
      }
    }

    if (!dryRun) {
      await db
        .update(repairJobs)
        .set({ spreadsheetInternalId: best.internalId, updatedAt: new Date() })
        .where(eq(repairJobs.id, jobId));
    }
    updated++;
    console.log(`  ${dryRun ? "[dry] " : ""}${jobId.slice(0, 8)}… → spreadsheet_internal_id = ${best.internalId}`);
  }

  return { updated, skippedAlready, skippedConflict, skippedNoJob };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL missing");
    process.exit(1);
  }
  console.log(DRY_RUN ? "DRY RUN\n" : "LIVE\n");
  const r = await runBackfillSpreadsheetIds({ dryRun: DRY_RUN });
  console.log("\n", r);
  if (DRY_RUN) console.log("\nRe-run without --dry-run to apply.");
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]!).href;

if (isDirectRun) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
