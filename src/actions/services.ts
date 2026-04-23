"use server";

import { db } from "@/lib/db";
import { services, serviceRequests, estimateLineItems, repairJobs, repairJobEvents } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import { asc, eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncEstimateTotals } from "./estimates";

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export async function getServices({ activeOnly = false }: { activeOnly?: boolean } = {}) {
  await requireAuth();
  const rows = await db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.name));
  return activeOnly ? rows.filter((r) => r.active) : rows;
}

export async function getServiceById(id: string) {
  await requireAuth();
  const [row] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return row ?? null;
}

export async function createService(data: {
  name: string;
  description?: string | null;
  category?: string | null;
  defaultPrice: number;
  taxPercent?: number;
  holdedProductId?: string | null;
  active?: boolean;
  sortOrder?: number;
}) {
  await requireRole("manager");
  const [row] = await db
    .insert(services)
    .values({
      name: data.name.trim(),
      description: data.description ?? null,
      category: data.category ?? null,
      defaultPrice: String(data.defaultPrice),
      taxPercent: String(data.taxPercent ?? 21),
      holdedProductId: data.holdedProductId ?? null,
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? 100,
    })
    .returning();
  revalidatePath("/services");
  return row;
}

export async function updateService(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    category: string | null;
    defaultPrice: number;
    taxPercent: number;
    holdedProductId: string | null;
    active: boolean;
    sortOrder: number;
  }>,
) {
  await requireRole("manager");
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.description !== undefined) patch.description = data.description;
  if (data.category !== undefined) patch.category = data.category;
  if (data.defaultPrice !== undefined) patch.defaultPrice = String(data.defaultPrice);
  if (data.taxPercent !== undefined) patch.taxPercent = String(data.taxPercent);
  if (data.holdedProductId !== undefined) patch.holdedProductId = data.holdedProductId;
  if (data.active !== undefined) patch.active = data.active;
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;

  await db.update(services).set(patch).where(eq(services.id, id));
  revalidatePath("/services");
}

export async function deleteService(id: string) {
  await requireRole("manager");
  await db.delete(services).where(eq(services.id, id));
  revalidatePath("/services");
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-REPAIR SERVICE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getServiceRequestsForRepair(repairJobId: string) {
  await requireAuth();
  return db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.repairJobId, repairJobId))
    .orderBy(asc(serviceRequests.createdAt));
}

/**
 * Add a service to a repair. Creates both a `service_requests` row and a
 * mirrored `estimate_line_items` row so it flows into totals and Holded
 * without any special-casing downstream.
 */
export async function createServiceRequest(data: {
  repairJobId: string;
  serviceId?: string | null;
  /** Optional override; falls back to catalog name. */
  serviceName?: string;
  /** Optional override; falls back to catalog default_price. */
  unitPrice?: number;
  taxPercent?: number;
  quantity?: number;
  notes?: string | null;
}) {
  const ctx = await requireAnyAuth();

  // Resolve fields from catalog when serviceId is given.
  let serviceName = data.serviceName?.trim();
  let unitPrice = data.unitPrice;
  let taxPercent = data.taxPercent;
  if (data.serviceId) {
    const [cat] = await db.select().from(services).where(eq(services.id, data.serviceId)).limit(1);
    if (!cat) throw new Error("Service not found");
    if (!serviceName) serviceName = cat.name;
    if (unitPrice === undefined) unitPrice = Number(cat.defaultPrice);
    if (taxPercent === undefined) taxPercent = Number(cat.taxPercent);
  }
  if (!serviceName) throw new Error("Service name is required");
  if (unitPrice === undefined) throw new Error("Unit price is required");
  const qty = data.quantity ?? 1;

  const [row] = await db
    .insert(serviceRequests)
    .values({
      repairJobId: data.repairJobId,
      serviceId: data.serviceId ?? null,
      serviceName,
      quantity: String(qty),
      unitPrice: String(unitPrice),
      taxPercent: String(taxPercent ?? 21),
      notes: data.notes ?? null,
      createdByUserId: ctx.userId ?? null,
    })
    .returning();

  // Mirror into estimate as a "service" line so totals & Holded pick it up.
  await db.insert(estimateLineItems).values({
    repairJobId: data.repairJobId,
    type: "service",
    sourceType: "service_request",
    sourceId: row.id,
    description: serviceName,
    quantity: String(qty),
    unitPrice: String(unitPrice),
    internalCost: "0",
  });

  await syncEstimateTotals(data.repairJobId);
  revalidatePath(`/repairs/${data.repairJobId}`);
  return row;
}

export async function updateServiceRequest(
  id: string,
  data: Partial<{
    serviceName: string;
    unitPrice: number;
    quantity: number;
    taxPercent: number;
    notes: string | null;
  }>,
) {
  await requireAuth();
  const [existing] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id))
    .limit(1);
  if (!existing) throw new Error("Service request not found");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.serviceName !== undefined) patch.serviceName = data.serviceName.trim();
  if (data.unitPrice !== undefined) patch.unitPrice = String(data.unitPrice);
  if (data.quantity !== undefined) patch.quantity = String(data.quantity);
  if (data.taxPercent !== undefined) patch.taxPercent = String(data.taxPercent);
  if (data.notes !== undefined) patch.notes = data.notes;

  await db.update(serviceRequests).set(patch).where(eq(serviceRequests.id, id));

  // Keep the mirrored estimate line in sync.
  const linePatch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.serviceName !== undefined) linePatch.description = data.serviceName.trim();
  if (data.unitPrice !== undefined) linePatch.unitPrice = String(data.unitPrice);
  if (data.quantity !== undefined) linePatch.quantity = String(data.quantity);
  if (Object.keys(linePatch).length > 1) {
    await db
      .update(estimateLineItems)
      .set(linePatch)
      .where(
        and(
          eq(estimateLineItems.sourceType, "service_request"),
          eq(estimateLineItems.sourceId, id),
        ),
      );
  }

  await syncEstimateTotals(existing.repairJobId);
  revalidatePath(`/repairs/${existing.repairJobId}`);
}

export async function removeServiceRequest(id: string) {
  await requireAuth();
  const [existing] = await db
    .select()
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id))
    .limit(1);
  if (!existing) return;

  await db
    .delete(estimateLineItems)
    .where(
      and(
        eq(estimateLineItems.sourceType, "service_request"),
        eq(estimateLineItems.sourceId, id),
      ),
    );
  await db.delete(serviceRequests).where(eq(serviceRequests.id, id));

  await syncEstimateTotals(existing.repairJobId);
  revalidatePath(`/repairs/${existing.repairJobId}`);
}

export async function toggleServiceRequestCompleted(id: string) {
  const ctx = await requireAnyAuth();
  const [existing] = await db
    .select({ completedAt: serviceRequests.completedAt, repairJobId: serviceRequests.repairJobId })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, id))
    .limit(1);
  if (!existing) return;

  const willBeCompleted = !existing.completedAt;
  await db
    .update(serviceRequests)
    .set({
      completedAt: willBeCompleted ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(serviceRequests.id, id));

  // Als hier iets net is afgevinkt én alle andere services voor deze
  // job inmiddels ook af zijn, flippen we de job naar ready_for_check
  // zodat admin 'm in de "Check"-tab terugziet — zelfde mechanisme
  // als wanneer een werker "Klaar voor controle" tapt op een repair.
  if (willBeCompleted) {
    const stillOpen = await db
      .select({ id: serviceRequests.id })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.repairJobId, existing.repairJobId),
          isNull(serviceRequests.completedAt),
        ),
      )
      .limit(1);

    if (stillOpen.length === 0) {
      const [job] = await db
        .select({ status: repairJobs.status })
        .from(repairJobs)
        .where(eq(repairJobs.id, existing.repairJobId))
        .limit(1);
      if (job && !["completed", "invoiced", "ready_for_check"].includes(job.status)) {
        await db
          .update(repairJobs)
          .set({
            status: "ready_for_check",
            finalCheckStatus: "pending",
            updatedAt: new Date(),
          })
          .where(eq(repairJobs.id, existing.repairJobId));

        await db.insert(repairJobEvents).values({
          repairJobId: existing.repairJobId,
          userId: ctx.userId ?? null,
          eventType: "status_changed",
          fieldChanged: "status",
          oldValue: job.status,
          newValue: "ready_for_check",
          comment: "All services completed — awaiting admin check",
        });
      }
    }
  }

  revalidatePath(`/repairs/${existing.repairJobId}`);
  revalidatePath(`/garage/repairs/${existing.repairJobId}`);
  revalidatePath("/garage");
}
