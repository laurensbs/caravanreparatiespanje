import { db } from "@/lib/db";
import { imports, importRows, candidateDuplicates } from "@/lib/db/schema";
import { eq, count, and, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import { ImportReviewClient } from "./import-review-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ImportReviewPage({ params }: Props) {
  await requireRole("admin");
  const { id } = await params;

  const [importBatch] = await db
    .select()
    .from(imports)
    .where(eq(imports.id, id))
    .limit(1);

  if (!importBatch) notFound();

  // Get status breakdown
  const statusBreakdown = await db
    .select({
      status: importRows.status,
      count: count(),
    })
    .from(importRows)
    .where(eq(importRows.importId, id))
    .groupBy(importRows.status);

  // Get confidence breakdown
  const confidenceBreakdown = await db
    .select({
      confidence: importRows.inferredStatusConfidence,
      count: count(),
    })
    .from(importRows)
    .where(
      and(
        eq(importRows.importId, id),
        eq(importRows.rowClass, "record")
      )
    )
    .groupBy(importRows.inferredStatusConfidence);

  // Get low-confidence rows
  const lowConfidenceRows = await db
    .select()
    .from(importRows)
    .where(
      and(
        eq(importRows.importId, id),
        eq(importRows.inferredStatusConfidence, "low")
      )
    )
    .limit(100);

  // Get sheet breakdown
  const sheetBreakdown = await db
    .select({
      sheet: importRows.sourceSheet,
      count: count(),
    })
    .from(importRows)
    .where(eq(importRows.importId, id))
    .groupBy(importRows.sourceSheet);

  // Get duplicate candidates
  const duplicates = await db
    .select()
    .from(candidateDuplicates)
    .where(eq(candidateDuplicates.status, "pending"))
    .limit(50);

  return (
    <ImportReviewClient
      importBatch={importBatch}
      statusBreakdown={statusBreakdown}
      confidenceBreakdown={confidenceBreakdown}
      lowConfidenceRows={lowConfidenceRows}
      sheetBreakdown={sheetBreakdown}
      duplicateCount={duplicates.length}
    />
  );
}
