"use server";

import { db } from "@/lib/db";
import { suppliers, parts, partRequests, repairJobs, partCategories } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { requireAnyAuth } from "@/lib/garage-auth";
import { eq, desc, sql, asc, and } from "drizzle-orm";
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
      stockQuantity: parts.stockQuantity,
    })
    .from(partRequests)
    .leftJoin(parts, eq(partRequests.partId, parts.id))
    .leftJoin(suppliers, eq(partRequests.supplierId, suppliers.id))
    .leftJoin(repairJobs, eq(partRequests.repairJobId, repairJobs.id))
    .where(repairJobId ? eq(partRequests.repairJobId, repairJobId) : undefined)
    .orderBy(desc(partRequests.createdAt));
}

export async function createPartRequest(data: {
  repairJobId: string;
  partId?: string;
  partName?: string;
  quantity?: number;
  unitCost?: string;
  sellPrice?: string;
  markupPercent?: string;
  supplierId?: string;
  notes?: string;
}) {
  await requireRole("staff");

  const unitCost = data.unitCost ?? null;
  const qty = data.quantity ?? 1;
  const totalCost = unitCost ? String(parseFloat(unitCost) * qty) : null;

  // If same catalog part already exists for this job, increase quantity
  if (data.partId) {
    const [existing] = await db
      .select({ id: partRequests.id, quantity: partRequests.quantity })
      .from(partRequests)
      .where(
        sql`${partRequests.repairJobId} = ${data.repairJobId} AND ${partRequests.partId} = ${data.partId} AND ${partRequests.status} != 'cancelled'`
      )
      .limit(1);

    if (existing) {
      const newQty = existing.quantity + qty;
      const newTotal = unitCost ? String(parseFloat(unitCost) * newQty) : null;
      await db
        .update(partRequests)
        .set({ quantity: newQty, totalCost: newTotal, updatedAt: new Date() })
        .where(eq(partRequests.id, existing.id));
      revalidatePath(`/repairs/${data.repairJobId}`);
      revalidatePath("/parts");
      return existing;
    }
  }

  const [request] = await db
    .insert(partRequests)
    .values({
      repairJobId: data.repairJobId,
      partId: data.partId ?? null,
      partName: data.partName ?? "TBD",
      quantity: qty,
      unitCost,
      totalCost,
      sellPrice: data.sellPrice ?? null,
      markupPercent: data.markupPercent ?? null,
      supplierId: data.supplierId ?? null,
      status: "requested",
      notes: data.notes ?? null,
    })
    .returning();

  revalidatePath(`/repairs/${data.repairJobId}`);
  revalidatePath("/parts");
  return request;
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
  if (pr) revalidatePath(`/repairs/${pr.repairJobId}`);
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
      color: data.color || "bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
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
