"use server";

import { db } from "@/lib/db";
import { suppliers, parts, partRequests, repairJobs, partCategories } from "@/lib/db/schema";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { eq, desc, sql, asc } from "drizzle-orm";
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
      partName: partRequests.partName,
      partNumber: parts.partNumber,
      supplierName: suppliers.name,
      quantity: partRequests.quantity,
      status: partRequests.status,
      expectedDelivery: partRequests.expectedDelivery,
      receivedDate: partRequests.receivedDate,
      notes: partRequests.notes,
      jobTitle: repairJobs.title,
      jobRef: repairJobs.publicCode,
    })
    .from(partRequests)
    .leftJoin(parts, eq(partRequests.partId, parts.id))
    .leftJoin(suppliers, eq(parts.supplierId, suppliers.id))
    .leftJoin(repairJobs, eq(partRequests.repairJobId, repairJobs.id))
    .where(repairJobId ? eq(partRequests.repairJobId, repairJobId) : undefined)
    .orderBy(desc(partRequests.createdAt));
}

export async function createPartRequest(data: {
  repairJobId: string;
  partId?: string;
  partName?: string;
  quantity?: number;
  notes?: string;
}) {
  await requireRole("staff");
  const [request] = await db
    .insert(partRequests)
    .values({
      repairJobId: data.repairJobId,
      partId: data.partId ?? null,
      partName: data.partName ?? "TBD",
      quantity: data.quantity ?? 1,
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
  const updateData: Record<string, unknown> = { status };
  if (status === "received") updateData.receivedDate = new Date();

  await db.update(partRequests).set(updateData).where(eq(partRequests.id, id));
  revalidatePath("/parts");
}

// === Part Categories ===

export async function getPartCategories() {
  await requireAuth();
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
