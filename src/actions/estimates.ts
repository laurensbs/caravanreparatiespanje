"use server";

import { db } from "@/lib/db";
import {
  estimateLineItems,
  repairTasks,
  partRequests,
  repairJobs,
  parts,
  dismissedWorkshopItems,
} from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// GET estimate line items for a repair
// ─────────────────────────────────────────────────────────────────────────────

export async function getEstimateLineItems(repairJobId: string) {
  return db
    .select()
    .from(estimateLineItems)
    .where(eq(estimateLineItems.repairJobId, repairJobId))
    .orderBy(asc(estimateLineItems.sortOrder), asc(estimateLineItems.createdAt));
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-generate estimate from tasks + parts
// Replaces task-sourced and part_request-sourced lines; keeps manual lines
// ─────────────────────────────────────────────────────────────────────────────

export async function generateEstimateFromWork(
  repairJobId: string,
  defaultHourlyRate: number = 42.5,
  defaultMarkup: number = 25,
) {
  await requireRole("staff");

  // Fetch dismissed items so we skip them
  const dismissed = await db
    .select({ sourceType: dismissedWorkshopItems.sourceType, sourceId: dismissedWorkshopItems.sourceId })
    .from(dismissedWorkshopItems)
    .where(eq(dismissedWorkshopItems.repairJobId, repairJobId));
  const dismissedSet = new Set(dismissed.map((d) => `${d.sourceType}:${d.sourceId}`));

  // Get all billable tasks that are included in estimate
  const taskRows = await db
    .select()
    .from(repairTasks)
    .where(
      and(
        eq(repairTasks.repairJobId, repairJobId),
        eq(repairTasks.billable, true),
        eq(repairTasks.includeInEstimate, true),
      ),
    )
    .orderBy(asc(repairTasks.sortOrder));

  // Get all part requests included in estimate (not cancelled)
  const partRequestRows = await db
    .select({
      id: partRequests.id,
      partName: partRequests.partName,
      quantity: partRequests.quantity,
      unitCost: partRequests.unitCost,
      sellPrice: partRequests.sellPrice,
      markupPercent: partRequests.markupPercent,
      includeInEstimate: partRequests.includeInEstimate,
      status: partRequests.status,
      partId: partRequests.partId,
    })
    .from(partRequests)
    .where(
      and(
        eq(partRequests.repairJobId, repairJobId),
        eq(partRequests.includeInEstimate, true),
      ),
    );

  // Filter out cancelled
  const activeParts = partRequestRows.filter((p) => p.status !== "cancelled");

  // Delete existing auto-generated lines (task + part_request sourced)
  await db
    .delete(estimateLineItems)
    .where(
      and(
        eq(estimateLineItems.repairJobId, repairJobId),
        eq(estimateLineItems.sourceType, "task"),
      ),
    );
  await db
    .delete(estimateLineItems)
    .where(
      and(
        eq(estimateLineItems.repairJobId, repairJobId),
        eq(estimateLineItems.sourceType, "part_request"),
      ),
    );

  // Generate labour lines from tasks (skip dismissed)
  const labourLines = taskRows
    .filter((t) => {
      if (dismissedSet.has(`task:${t.id}`)) return false;
      const hours = t.estimatedHours ? parseFloat(t.estimatedHours) : 0;
      return hours > 0;
    })
    .map((t, i) => {
      const hours = parseFloat(t.estimatedHours!);
      const rate = t.hourlyRate ? parseFloat(t.hourlyRate) : defaultHourlyRate;
      return {
        repairJobId,
        type: "labour" as const,
        sourceType: "task" as const,
        sourceId: t.id,
        description: t.title,
        quantity: String(hours),
        unitPrice: String(rate),
        internalCost: "0",
        sortOrder: i,
      };
    });

  // Generate part lines from part requests (skip dismissed)
  const partLines = activeParts
    .filter((p) => !dismissedSet.has(`part_request:${p.id}`))
    .map((p, i) => {
      const cost = p.unitCost ? parseFloat(p.unitCost) : 0;
      const markup = p.markupPercent ? parseFloat(p.markupPercent) : defaultMarkup;
      let sell = p.sellPrice ? parseFloat(p.sellPrice) : 0;
      if (!sell && cost > 0) {
        sell = cost * (1 + markup / 100);
      }
      return {
        repairJobId,
        type: "part" as const,
        sourceType: "part_request" as const,
        sourceId: p.id,
        description: p.partName,
        quantity: String(p.quantity),
        unitPrice: String(sell.toFixed(2)),
        internalCost: String(cost),
        sortOrder: labourLines.length + i,
      };
    });

  const allLines = [...labourLines, ...partLines];

  if (allLines.length > 0) {
    await db.insert(estimateLineItems).values(allLines);
  }

  // Recalculate totals on the repair job
  await syncEstimateTotals(repairJobId);

  revalidatePath(`/repairs/${repairJobId}`);
  revalidatePath(`/garage/repairs/${repairJobId}`);
  return { labourCount: labourLines.length, partCount: partLines.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync estimate totals from line items → repair_jobs fields
// ─────────────────────────────────────────────────────────────────────────────

export async function syncEstimateTotals(repairJobId: string) {
  const lines = await db
    .select()
    .from(estimateLineItems)
    .where(eq(estimateLineItems.repairJobId, repairJobId));

  const [job] = await db
    .select({ discountPercent: repairJobs.discountPercent })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId));

  const discount = job?.discountPercent ? parseFloat(job.discountPercent) : 0;

  const subtotal = lines.reduce((sum, l) => {
    return sum + parseFloat(l.quantity) * parseFloat(l.unitPrice);
  }, 0);
  const internalTotal = lines.reduce((sum, l) => {
    return sum + parseFloat(l.quantity) * parseFloat(l.internalCost);
  }, 0);
  const afterDiscount = subtotal * (1 - discount / 100);

  await db
    .update(repairJobs)
    .set({
      estimatedCost: String(afterDiscount.toFixed(2)),
      internalCost: String(internalTotal.toFixed(2)),
      updatedAt: new Date(),
    })
    .where(eq(repairJobs.id, repairJobId));
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD for individual estimate line items
// ─────────────────────────────────────────────────────────────────────────────

export async function addEstimateLineItem(
  repairJobId: string,
  data: {
    type: "labour" | "part" | "custom";
    description: string;
    quantity: number;
    unitPrice: number;
    internalCost?: number;
    sourceType?: "task" | "part_request" | "manual";
    sourceId?: string;
  },
) {
  await requireRole("staff");

  const [line] = await db
    .insert(estimateLineItems)
    .values({
      repairJobId,
      type: data.type,
      sourceType: data.sourceType ?? "manual",
      sourceId: data.sourceId ?? null,
      description: data.description,
      quantity: String(data.quantity),
      unitPrice: String(data.unitPrice),
      internalCost: String(data.internalCost ?? 0),
    })
    .returning();

  await syncEstimateTotals(repairJobId);
  revalidatePath(`/repairs/${repairJobId}`);
  return line;
}

export async function updateEstimateLineItem(
  lineId: string,
  data: {
    description?: string;
    quantity?: number;
    unitPrice?: number;
    internalCost?: number;
  },
) {
  await requireRole("staff");

  const [line] = await db
    .select({ repairJobId: estimateLineItems.repairJobId })
    .from(estimateLineItems)
    .where(eq(estimateLineItems.id, lineId));
  if (!line) throw new Error("Line item not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.description !== undefined) updates.description = data.description;
  if (data.quantity !== undefined) updates.quantity = String(data.quantity);
  if (data.unitPrice !== undefined) updates.unitPrice = String(data.unitPrice);
  if (data.internalCost !== undefined) updates.internalCost = String(data.internalCost);

  await db
    .update(estimateLineItems)
    .set(updates)
    .where(eq(estimateLineItems.id, lineId));

  await syncEstimateTotals(line.repairJobId);
  revalidatePath(`/repairs/${line.repairJobId}`);
}

export async function removeEstimateLineItem(lineId: string) {
  const session = await requireAuth();

  const [line] = await db
    .select({
      repairJobId: estimateLineItems.repairJobId,
      sourceType: estimateLineItems.sourceType,
      sourceId: estimateLineItems.sourceId,
    })
    .from(estimateLineItems)
    .where(eq(estimateLineItems.id, lineId));
  if (!line) throw new Error("Line item not found");

  // Auto-dismiss workshop-sourced items so they don't reappear on next sync
  if (line.sourceType !== "manual" && line.sourceId) {
    await db.insert(dismissedWorkshopItems).values({
      repairJobId: line.repairJobId,
      sourceType: line.sourceType,
      sourceId: line.sourceId,
      dismissedBy: session.user?.id ?? null,
    });
  }

  await db.delete(estimateLineItems).where(eq(estimateLineItems.id, lineId));

  await syncEstimateTotals(line.repairJobId);
  revalidatePath(`/repairs/${line.repairJobId}`);
}

export async function updateDiscountPercent(repairJobId: string, percent: number) {
  await requireRole("staff");
  await db
    .update(repairJobs)
    .set({ discountPercent: String(Math.max(0, Math.min(100, percent))), updatedAt: new Date() })
    .where(eq(repairJobs.id, repairJobId));
  await syncEstimateTotals(repairJobId);
  revalidatePath(`/repairs/${repairJobId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// DISMISSED WORKSHOP ITEMS
// ─────────────────────────────────────────────────────────────────────────────

export async function getDismissedWorkshopItems(repairJobId: string) {
  return db
    .select()
    .from(dismissedWorkshopItems)
    .where(eq(dismissedWorkshopItems.repairJobId, repairJobId));
}

export async function restoreWorkshopItem(dismissedId: string) {
  await requireRole("staff");
  await db
    .delete(dismissedWorkshopItems)
    .where(eq(dismissedWorkshopItems.id, dismissedId));
}

export async function restoreAllWorkshopItems(repairJobId: string) {
  await requireRole("staff");
  await db
    .delete(dismissedWorkshopItems)
    .where(eq(dismissedWorkshopItems.repairJobId, repairJobId));
  revalidatePath(`/repairs/${repairJobId}`);
}
