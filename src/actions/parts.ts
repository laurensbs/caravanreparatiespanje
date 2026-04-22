"use server";

import { db } from "@/lib/db";
import { suppliers, parts, partRequests, repairJobs, repairTasks, partCategories, repairJobEvents } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import { eq, desc, sql, asc, and, ne, inArray, isNull } from "drizzle-orm";
import { customers, units } from "@/lib/db/schema";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "./audit";

// === Suppliers ===

export async function getSuppliers() {
  await requireAuth();
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function createSupplier(data: {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}) {
  const session = await requireRole("staff");
  const [supplier] = await db
    .insert(suppliers)
    .values({
      name: data.name,
      contactName: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      website: data.website ?? null,
      notes: data.notes ?? null,
    })
    .returning();

  await createAuditLog("create", "supplier", supplier.id, { name: data.name });
  revalidatePath("/parts");

  // Sync to Holded in background
  import("@/lib/holded/sync").then(({ pushSupplierToHolded }) =>
    pushSupplierToHolded(supplier.id).catch(() => {})
  );

  return supplier;
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
  }
) {
  await requireRole("staff");
  await db
    .update(suppliers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(suppliers.id, id));
  revalidatePath("/parts");

  // Sync to Holded in background
  import("@/lib/holded/sync").then(({ pushSupplierToHolded }) =>
    pushSupplierToHolded(id).catch(() => {})
  );
}

export async function deleteSupplier(id: string) {
  await requireRole("staff");
  await db.delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath("/parts");
}

// === Parts ===

export async function getParts() {
  await requireAuth();
  return db
    .select({
      id: parts.id,
      name: parts.name,
      partNumber: parts.partNumber,
      category: parts.category,
      supplierName: suppliers.name,
      supplierId: parts.supplierId,
      defaultCost: parts.defaultCost,
      markupPercent: parts.markupPercent,
      description: parts.description,
      orderUrl: parts.orderUrl,
      stockQuantity: parts.stockQuantity,
      minStockLevel: parts.minStockLevel,
      createdAt: parts.createdAt,
    })
    .from(parts)
    .leftJoin(suppliers, eq(parts.supplierId, suppliers.id))
    .orderBy(parts.name);
}

export async function createPart(data: {
  name: string;
  partNumber?: string;
  category?: string;
  supplierId?: string;
  defaultCost?: string;
  markupPercent?: string;
  description?: string;
  orderUrl?: string;
  stockQuantity?: number;
  minStockLevel?: number;
}) {
  await requireRole("staff");
  const [part] = await db
    .insert(parts)
    .values({
      name: data.name,
      partNumber: data.partNumber ?? null,
      category: data.category ?? null,
      supplierId: data.supplierId ?? null,
      defaultCost: data.defaultCost ?? null,
      markupPercent: data.markupPercent ?? null,
      description: data.description ?? null,
      orderUrl: data.orderUrl ?? null,
      stockQuantity: data.stockQuantity ?? 0,
      minStockLevel: data.minStockLevel ?? 0,
    })
    .returning();

  revalidatePath("/parts");

  // Sync to Holded in background
  import("@/lib/holded/sync").then(({ pushPartToHolded }) =>
    pushPartToHolded(part.id).catch(() => {})
  );

  return part;
}

export async function updatePart(
  id: string,
  data: {
    name?: string;
    partNumber?: string | null;
    category?: string | null;
    supplierId?: string | null;
    defaultCost?: string | null;
    markupPercent?: string | null;
    description?: string | null;
    orderUrl?: string | null;
    stockQuantity?: number;
    minStockLevel?: number;
  }
) {
  await requireRole("staff");
  await db
    .update(parts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(parts.id, id));
  revalidatePath("/parts");

  // Sync to Holded in background
  import("@/lib/holded/sync").then(({ pushPartToHolded }) =>
    pushPartToHolded(id).catch(() => {})
  );
}

export async function adjustPartStock(partId: string, delta: number, reason?: string) {
  await requireAuth();
  const [part] = await db.select({ stockQuantity: parts.stockQuantity }).from(parts).where(eq(parts.id, partId)).limit(1);
  if (!part) return;
  const newQty = Math.max(0, (part.stockQuantity ?? 0) + delta);
  await db.update(parts).set({ stockQuantity: newQty, updatedAt: new Date() }).where(eq(parts.id, partId));
  revalidatePath("/parts");
}

export async function deletePart(id: string) {
  await requireRole("staff");
  await db.delete(parts).where(eq(parts.id, id));
  revalidatePath("/parts");
}

// === Part Requests ===

export async function getPartRequests(repairJobId?: string) {
  await requireAuth();
  return db
    .select({
      id: partRequests.id,
      repairJobId: partRequests.repairJobId,
      partId: partRequests.partId,
      partName: partRequests.partName,
      partNumber: parts.partNumber,
      category: parts.category,
      supplierName: suppliers.name,
      supplierId: partRequests.supplierId,
      quantity: partRequests.quantity,
      unitCost: partRequests.unitCost,
      totalCost: partRequests.totalCost,
      sellPrice: partRequests.sellPrice,
      markupPercent: partRequests.markupPercent,
      status: partRequests.status,
      orderReference: partRequests.orderReference,
      expectedDelivery: partRequests.expectedDelivery,
      receivedDate: partRequests.receivedDate,
      notes: partRequests.notes,
      jobTitle: repairJobs.title,
      jobRef: repairJobs.publicCode,
      repairTaskId: partRequests.repairTaskId,
      taskTitle: repairTasks.title,
      stockQuantity: parts.stockQuantity,
      requestType: partRequests.requestType,
      createdAt: partRequests.createdAt,
      lastChasedAt: partRequests.lastChasedAt,
    })
    .from(partRequests)
    .leftJoin(parts, eq(partRequests.partId, parts.id))
    .leftJoin(suppliers, eq(partRequests.supplierId, suppliers.id))
    .leftJoin(repairJobs, eq(partRequests.repairJobId, repairJobs.id))
    .leftJoin(repairTasks, eq(partRequests.repairTaskId, repairTasks.id))
    .where(repairJobId ? eq(partRequests.repairJobId, repairJobId) : undefined)
    .orderBy(desc(partRequests.createdAt));
}

/**
 * Admin: I just chased the supplier (called/emailed). Hide this row
 * from the dashboard widget for 24h. Idempotent — safe to spam-click.
 */
export async function markPartRequestChased(id: string) {
  await requireRole("staff");
  await db
    .update(partRequests)
    .set({ lastChasedAt: new Date(), updatedAt: new Date() })
    .where(eq(partRequests.id, id));
  try {
    revalidatePath("/parts");
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }
}

/** Reset the chase cooldown — useful if you marked it by accident. */
export async function unmarkPartRequestChased(id: string) {
  await requireRole("staff");
  await db
    .update(partRequests)
    .set({ lastChasedAt: null, updatedAt: new Date() })
    .where(eq(partRequests.id, id));
  try {
    revalidatePath("/parts");
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }
}

/**
 * Lightweight list used by the dashboard "Parts to chase" widget.
 * Returns only rows that actually need attention right now: open
 * status, either stale (>=3d) or past their expected_delivery, AND
 * not chased in the last 24h. Sorted oldest first so the worst
 * offender sits at the top.
 */
export type PartsToChaseRow = {
  id: string;
  partName: string;
  status: string;
  quantity: number;
  createdAt: Date;
  expectedDelivery: Date | null;
  lastChasedAt: Date | null;
  supplierName: string | null;
  supplierId: string | null;
  repairJobId: string | null;
  jobRef: string | null;
  jobTitle: string | null;
  customerName: string | null;
  unitRegistration: string | null;
};

export async function listPartsToChase(): Promise<PartsToChaseRow[]> {
  await requireAuth();

  // Pull all open requests; filter via the shared aging helper in JS.
  // The set is small (open requests at any time is double-digits), so
  // we trade one extra fetch for shared logic + zero schema-coupling.
  const rows = await db
    .select({
      id: partRequests.id,
      partName: partRequests.partName,
      status: partRequests.status,
      quantity: partRequests.quantity,
      createdAt: partRequests.createdAt,
      expectedDelivery: partRequests.expectedDelivery,
      lastChasedAt: partRequests.lastChasedAt,
      supplierName: suppliers.name,
      supplierId: partRequests.supplierId,
      repairJobId: partRequests.repairJobId,
      jobRef: repairJobs.publicCode,
      jobTitle: repairJobs.title,
    })
    .from(partRequests)
    .leftJoin(suppliers, eq(partRequests.supplierId, suppliers.id))
    .leftJoin(repairJobs, eq(partRequests.repairJobId, repairJobs.id))
    .where(
      and(
        ne(partRequests.requestType, "equipment"),
        sql`${partRequests.status} IN ('requested', 'ordered', 'shipped')`,
      ),
    )
    .orderBy(asc(partRequests.createdAt));

  // Pull customer + unit per repair in one go, mapping by repair id.
  const repairIds = Array.from(
    new Set(rows.map((r) => r.repairJobId).filter((x): x is string => !!x)),
  );

  let metaByRepair = new Map<
    string,
    { customerName: string | null; unitRegistration: string | null }
  >();
  if (repairIds.length > 0) {
    const meta = await db
      .select({
        id: repairJobs.id,
        customerName: customers.name,
        unitRegistration: units.registration,
      })
      .from(repairJobs)
      .leftJoin(customers, eq(customers.id, repairJobs.customerId))
      .leftJoin(units, eq(units.id, repairJobs.unitId))
      .where(inArray(repairJobs.id, repairIds));
    metaByRepair = new Map(
      meta.map((r) => [
        r.id,
        {
          customerName: r.customerName,
          unitRegistration: r.unitRegistration,
        },
      ]),
    );
  }

  const { getPartRequestAging } = await import("@/lib/part-request-aging");
  const now = new Date();

  return rows
    .map((r) => {
      const aging = getPartRequestAging(
        {
          status: r.status,
          createdAt: r.createdAt,
          expectedDelivery: r.expectedDelivery,
          lastChasedAt: r.lastChasedAt,
        },
        now,
      );
      return { row: r, aging };
    })
    .filter(({ aging }) => aging.needsChase)
    .map(({ row }) => {
      const meta = row.repairJobId ? metaByRepair.get(row.repairJobId) : null;
      return {
        id: row.id,
        partName: row.partName,
        status: row.status,
        quantity: row.quantity,
        createdAt: row.createdAt,
        expectedDelivery: row.expectedDelivery,
        lastChasedAt: row.lastChasedAt,
        supplierName: row.supplierName,
        supplierId: row.supplierId,
        repairJobId: row.repairJobId,
        jobRef: row.jobRef,
        jobTitle: row.jobTitle,
        customerName: meta?.customerName ?? null,
        unitRegistration: meta?.unitRegistration ?? null,
      };
    });
}

export async function createPartRequest(data: {
  repairJobId?: string;
  repairTaskId?: string | null;
  partId?: string;
  partName?: string;
  quantity?: number;
  unitCost?: string;
  sellPrice?: string;
  markupPercent?: string;
  supplierId?: string;
  notes?: string;
  requestType?: "part" | "equipment";
  /**
   * Initial status. Default "requested" (klassieke aanvraag-flow).
   * Als een admin een part direct vanuit de werkplaats koppelt gebruik
   * "received" — dan telt hij niet mee als "waiting" en flipt de repair
   * niet onnodig naar waiting_parts.
   */
  status?: "requested" | "ordered" | "shipped" | "received" | "cancelled";
  /** Optional label — if this call came from the "extra work needed"
   *  dialog on a service line, we note the service name in the job_type
   *  audit event so the timeline shows which service spawned the flip. */
  spawnedFromServiceName?: string | null;
}) {
  await requireRole("staff");

  const unitCost = data.unitCost ?? null;
  const qty = data.quantity ?? 1;
  const totalCost = unitCost ? String(parseFloat(unitCost) * qty) : null;

  // If same catalog part already exists for this job (and same task link), increase quantity
  if (data.partId && data.repairJobId) {
    const taskMatch = data.repairTaskId
      ? eq(partRequests.repairTaskId, data.repairTaskId)
      : isNull(partRequests.repairTaskId);
    const [existing] = await db
      .select({ id: partRequests.id, quantity: partRequests.quantity })
      .from(partRequests)
      .where(
        and(
          eq(partRequests.repairJobId, data.repairJobId),
          eq(partRequests.partId, data.partId),
          ne(partRequests.status, "cancelled"),
          taskMatch,
        ),
      )
      .limit(1);

    if (existing) {
      const newQty = existing.quantity + qty;
      const newTotal = unitCost ? String(parseFloat(unitCost) * newQty) : null;
      await db
        .update(partRequests)
        .set({ quantity: newQty, totalCost: newTotal, updatedAt: new Date() })
        .where(eq(partRequests.id, existing.id));
      if (data.repairJobId) revalidatePath(`/repairs/${data.repairJobId}`);
      revalidatePath("/parts");
      return existing;
    }
  }

  const [request] = await db
    .insert(partRequests)
    .values({
      repairJobId: data.repairJobId ?? null,
      repairTaskId: data.repairTaskId ?? null,
      partId: data.partId ?? null,
      partName: data.partName ?? "TBD",
      quantity: qty,
      unitCost,
      totalCost,
      sellPrice: data.sellPrice ?? null,
      markupPercent: data.markupPercent ?? null,
      supplierId: data.supplierId ?? null,
      status: data.status ?? "requested",
      receivedDate: data.status === "received" ? new Date() : null,
      notes: data.notes ?? null,
      requestType: data.requestType ?? "part",
    })
    .returning();

  if (data.repairJobId) {
    revalidatePath(`/repairs/${data.repairJobId}`);
  }
  revalidatePath("/parts");

  // Auto-set repair to waiting_parts if it's in a workable status (parts only).
  // Skip als admin de part direct aanmaakt als "received" — dan is er
  // niks om op te wachten.
  const waitingEligible =
    data.status == null || (data.status !== "received" && data.status !== "cancelled");
  if (data.repairJobId && data.requestType !== "equipment" && waitingEligible) {
    const [job] = await db
      .select({ status: repairJobs.status })
      .from(repairJobs)
      .where(eq(repairJobs.id, data.repairJobId));
    if (job && ["new", "todo", "scheduled", "in_progress"].includes(job.status)) {
      await db
        .update(repairJobs)
        .set({ status: "waiting_parts", updatedAt: new Date() })
        .where(eq(repairJobs.id, data.repairJobId));
      revalidatePath(`/repairs/${data.repairJobId}`);
    }
  }

  // Part = concreet bewijs dat er gerepareerd wordt. Als de work-order
  // nog een ander jobType had (maintenance/wax/inspection) flippen we
  // hem naar "repair" zodat lijst, filter en badges kloppen.
  if (data.repairJobId && data.requestType !== "equipment") {
    await autoFlipJobTypeToRepair(
      data.repairJobId,
      data.spawnedFromServiceName
        ? `Part "${data.partName ?? "TBD"}" added from service "${data.spawnedFromServiceName}"`
        : `Part "${data.partName ?? "TBD"}" added`,
    );
  }

  return request;
}

/**
 * Flip a work-order's jobType to "repair" when extra repair-style work
 * (a part request or an admin-added task) appears on it. No-op if the
 * job is already "repair". Writes a repair_job_events audit row so the
 * timeline explains why.
 */
async function autoFlipJobTypeToRepair(repairJobId: string, reason: string) {
  const [job] = await db
    .select({ jobType: repairJobs.jobType })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId))
    .limit(1);
  if (!job || job.jobType === "repair") return;

  await db
    .update(repairJobs)
    .set({ jobType: "repair", updatedAt: new Date() })
    .where(eq(repairJobs.id, repairJobId));

  await db.insert(repairJobEvents).values({
    repairJobId,
    eventType: "job_type_changed",
    fieldChanged: "jobType",
    oldValue: job.jobType,
    newValue: "repair",
    comment: `Auto-flipped to repair — ${reason}`,
  });
}

/**
 * Garage iPad → "I need this part for repair X". Mirrors
 * createPartRequest but goes through garage-auth (the iPad has no
 * NextAuth session, only the shared garage_auth cookie). A repair link
 * is required because a stray part with no job is useless to the
 * office. Returns the new row id so the caller can attach a voice note.
 */
export async function createPartRequestFromGarage(input: {
  partName: string;
  repairJobId: string;
  quantity?: number;
  notes?: string | null;
}): Promise<{ id: string }> {
  await requireAnyAuth();
  const partName = input.partName.trim();
  if (!partName) throw new Error("Part name is required");
  if (!input.repairJobId) throw new Error("Repair job is required for parts");

  const qty = input.quantity ?? 1;

  const [row] = await db
    .insert(partRequests)
    .values({
      repairJobId: input.repairJobId,
      partName,
      quantity: qty,
      status: "requested",
      notes: input.notes ?? null,
      requestType: "part",
    })
    .returning({ id: partRequests.id });

  // Mirror admin createPartRequest: bump the repair to waiting_parts
  // when it's in a workable status, so the dashboard correctly shows
  // it as blocked on parts.
  try {
    const [job] = await db
      .select({ status: repairJobs.status })
      .from(repairJobs)
      .where(eq(repairJobs.id, input.repairJobId));
    if (job && ["new", "todo", "scheduled", "in_progress"].includes(job.status)) {
      await db
        .update(repairJobs)
        .set({ status: "waiting_parts", updatedAt: new Date() })
        .where(eq(repairJobs.id, input.repairJobId));
    }
  } catch {
    // best-effort
  }

  // Mirror admin flow: a part needed = repair job, flip the type.
  try {
    await autoFlipJobTypeToRepair(input.repairJobId, `Part "${partName}" requested from garage`);
  } catch {
    // best-effort
  }

  try {
    revalidatePath(`/repairs/${input.repairJobId}`);
    revalidatePath("/parts");
    revalidatePath("/dashboard");
  } catch {
    // best-effort
  }

  return { id: row.id };
}

export async function updatePartRequestStatus(
  id: string,
  status: "requested" | "ordered" | "shipped" | "received" | "cancelled"
) {
  await requireRole("staff");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "received") updateData.receivedDate = new Date();

  const [pr] = await db
    .update(partRequests)
    .set(updateData)
    .where(eq(partRequests.id, id))
    .returning({ repairJobId: partRequests.repairJobId });

  revalidatePath("/parts");
  if (pr) {
    if (pr.repairJobId) {
      revalidatePath(`/repairs/${pr.repairJobId}`);
    }

    // When marking as received, check if ALL pending parts for this repair are now received
    if (status === "received" && pr.repairJobId) {
      const [pendingParts] = await db
        .select({ count: sql<number>`count(*)` })
        .from(partRequests)
        .where(
          and(
            eq(partRequests.repairJobId, pr.repairJobId),
            sql`${partRequests.status} in ('requested', 'ordered', 'shipped')`,
            ne(partRequests.requestType, "equipment")
          )
        );
      if (Number(pendingParts?.count ?? 0) === 0) {
        // All parts received — revert to todo if currently waiting_parts
        const [job] = await db
          .select({ status: repairJobs.status })
          .from(repairJobs)
          .where(eq(repairJobs.id, pr.repairJobId));
        if (job?.status === "waiting_parts") {
          await db
            .update(repairJobs)
            .set({ status: "todo", updatedAt: new Date() })
            .where(eq(repairJobs.id, pr.repairJobId));
          revalidatePath(`/repairs/${pr.repairJobId}`);
        }
      }
    }
  }
}

export async function updatePartRequest(
  id: string,
  data: {
    quantity?: number;
    unitCost?: string;
    sellPrice?: string;
    markupPercent?: string;
    notes?: string;
    orderReference?: string;
  }
) {
  await requireRole("staff");
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.unitCost !== undefined) updates.unitCost = data.unitCost || null;
  if (data.sellPrice !== undefined) updates.sellPrice = data.sellPrice || null;
  if (data.markupPercent !== undefined) updates.markupPercent = data.markupPercent || null;
  if (data.notes !== undefined) updates.notes = data.notes || null;
  if (data.orderReference !== undefined) updates.orderReference = data.orderReference || null;

  // Recalc totals
  if (data.quantity !== undefined || data.unitCost !== undefined) {
    const [existing] = await db
      .select({ quantity: partRequests.quantity, unitCost: partRequests.unitCost })
      .from(partRequests)
      .where(eq(partRequests.id, id));
    if (existing) {
      const qty = data.quantity ?? existing.quantity;
      const cost = data.unitCost ?? existing.unitCost;
      updates.totalCost = cost ? String(parseFloat(cost) * qty) : null;
    }
  }

  const [pr] = await db
    .update(partRequests)
    .set(updates)
    .where(eq(partRequests.id, id))
    .returning({ repairJobId: partRequests.repairJobId });

  if (pr) revalidatePath(`/repairs/${pr.repairJobId}`);
  revalidatePath("/parts");
}

/**
 * Link (or unlink) an existing part request to a task, without
 * creating a duplicate request. Used by the inline task picker so
 * admins can pull an already-requested part onto a specific task.
 */
export async function linkPartRequestToTask(id: string, repairTaskId: string | null) {
  await requireRole("staff");
  const [pr] = await db
    .update(partRequests)
    .set({ repairTaskId: repairTaskId, updatedAt: new Date() })
    .where(eq(partRequests.id, id))
    .returning({ repairJobId: partRequests.repairJobId });

  if (pr) revalidatePath(`/repairs/${pr.repairJobId}`);
  revalidatePath("/parts");
}

export async function removePartRequest(id: string) {
  await requireRole("staff");
  const [pr] = await db
    .delete(partRequests)
    .where(eq(partRequests.id, id))
    .returning({ repairJobId: partRequests.repairJobId });

  if (pr) revalidatePath(`/repairs/${pr.repairJobId}`);
  revalidatePath("/parts");
}

// === Part Categories ===

export async function getPartCategories() {
  await requireAnyAuth();
  return db.select().from(partCategories).orderBy(asc(partCategories.sortOrder), asc(partCategories.label));
}

export async function createPartCategory(data: { key: string; label: string; icon?: string; color?: string }) {
  await requireRole("admin");
  const [cat] = await db
    .insert(partCategories)
    .values({
      key: data.key.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
      label: data.label,
      icon: data.icon || "Package",
      color: data.color || "bg-muted/40 text-muted-foreground dark:bg-foreground/[0.06] dark:text-muted-foreground/70",
      sortOrder: 99,
    })
    .returning();
  revalidatePath("/parts");
  return cat;
}

export async function updatePartCategory(id: string, data: { label?: string; icon?: string; color?: string; active?: boolean; sortOrder?: number }) {
  await requireRole("admin");
  await db.update(partCategories).set({ ...data, updatedAt: new Date() }).where(eq(partCategories.id, id));
  revalidatePath("/parts");
}

export async function deletePartCategory(id: string) {
  await requireRole("admin");
  await db.delete(partCategories).where(eq(partCategories.id, id));
  revalidatePath("/parts");
}

// === Search & Suggestions ===

export async function searchParts(query: string, category?: string) {
  await requireAuth();

  const conditions = [];
  if (query.trim()) {
    const q = `%${query.toLowerCase()}%`;
    conditions.push(
      sql`(lower(${parts.name}) like ${q} or lower(${parts.partNumber}) like ${q} or lower(${suppliers.name}) like ${q} or lower(${parts.category}) like ${q})`
    );
  }
  if (category) {
    conditions.push(eq(parts.category, category));
  }
  if (conditions.length === 0) return [];

  return db
    .select({
      id: parts.id,
      name: parts.name,
      partNumber: parts.partNumber,
      category: parts.category,
      defaultCost: parts.defaultCost,
      markupPercent: parts.markupPercent,
      stockQuantity: parts.stockQuantity,
      minStockLevel: parts.minStockLevel,
      supplierName: suppliers.name,
      supplierId: parts.supplierId,
    })
    .from(parts)
    .leftJoin(suppliers, eq(parts.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(
      query.trim()
        ? sql`CASE
            WHEN lower(${parts.name}) = ${query.toLowerCase()} THEN 0
            WHEN lower(${parts.partNumber}) = ${query.toLowerCase()} THEN 0
            WHEN lower(${parts.name}) like ${query.toLowerCase() + "%"} THEN 1
            ELSE 2
          END`
        : parts.name,
      parts.name
    )
    .limit(15);
}

export async function suggestPartsForJob(repairJobId: string) {
  await requireAuth();

  const [job] = await db
    .select({ title: repairJobs.title, description: repairJobs.descriptionNormalized })
    .from(repairJobs)
    .where(eq(repairJobs.id, repairJobId));

  if (!job) return [];

  const text = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();

  // Extract keywords to match against part categories and names
  const keywordMap: Record<string, string[]> = {
    tyre: ["tyre", "tire", "band", "neumático", "valve", "ventiel"],
    window: ["window", "raam", "ventana", "rooflight", "claraboya", "dakraam"],
    seal: ["seal", "afdichting", "junta", "rubber", "rail"],
    light: ["light", "lamp", "licht", "luz", "bulb", "led"],
    brake: ["brake", "rem", "freno"],
    door: ["door", "deur", "puerta", "lock", "slot", "cerradura"],
    water: ["water", "agua", "leak", "lek", "fuga", "damp", "vocht"],
    electric: ["electric", "elektrisch", "eléctrico", "cable", "kabel", "fuse", "zekering"],
    hinge: ["hinge", "scharnier", "bisagra"],
  };

  const matchedCategories = new Set<string>();
  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => text.includes(kw))) {
      matchedCategories.add(category);
    }
  }

  if (matchedCategories.size === 0) return [];

  // Build OR conditions for matching categories/names
  const patterns = [...matchedCategories].map((cat) => `%${cat}%`);
  const conditions = patterns
    .map((p) => sql`(lower(${parts.name}) like ${p} or lower(${parts.category}) like ${p})`)
    .reduce((a, b) => sql`${a} or ${b}`);

  return db
    .select({
      id: parts.id,
      name: parts.name,
      partNumber: parts.partNumber,
      category: parts.category,
      defaultCost: parts.defaultCost,
      markupPercent: parts.markupPercent,
      stockQuantity: parts.stockQuantity,
      minStockLevel: parts.minStockLevel,
      supplierName: suppliers.name,
      supplierId: parts.supplierId,
    })
    .from(parts)
    .leftJoin(suppliers, eq(parts.supplierId, suppliers.id))
    .where(conditions)
    .orderBy(parts.name)
    .limit(6);
}
