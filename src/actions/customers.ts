"use server";

import { db } from "@/lib/db";
import { customers, repairJobs, units, customerTags } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";

function capitalizeWords(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const keep = ["van", "de", "den", "der", "het", "ten", "ter"];
      if (keep.includes(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
import { customerSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";
import { syncCustomerToHolded } from "./holded";
import { eq, desc, ilike, or, and, count, sql, inArray, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CustomerFilters = {
  q?: string;
  contactType?: string;
  repairStatus?: string;
  locationId?: string;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export async function getCustomers(filters: CustomerFilters = {}) {
  await requireAuth();

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(
        ilike(customers.name, term),
        ilike(customers.phone, term),
        ilike(customers.email, term),
      )!
    );
  }

  if (filters.contactType && (filters.contactType === "person" || filters.contactType === "business")) {
    conditions.push(eq(customers.contactType, filters.contactType));
  }

  if (filters.repairStatus === "open") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id} AND repair_jobs.status NOT IN ('completed', 'invoiced', 'archived') AND repair_jobs.archived_at IS NULL)`
    );
  } else if (filters.repairStatus === "waiting") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id} AND repair_jobs.status IN ('waiting_customer', 'waiting_parts', 'waiting_approval') AND repair_jobs.archived_at IS NULL)`
    );
  } else if (filters.repairStatus === "in_progress") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id} AND repair_jobs.status IN ('in_progress', 'in_inspection', 'scheduled') AND repair_jobs.archived_at IS NULL)`
    );
  } else if (filters.repairStatus === "completed") {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id} AND repair_jobs.status NOT IN ('completed', 'invoiced', 'archived'))`
    );
  } else if (filters.repairStatus === "no_repairs") {
    conditions.push(
      sql`NOT EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id})`
    );
  }

  if (filters.locationId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id} AND repair_jobs.location_id = ${filters.locationId} AND repair_jobs.archived_at IS NULL)`
    );
  }

  if (filters.tagId) {
    const tagRows = await db.select({ customerId: customerTags.customerId }).from(customerTags).where(eq(customerTags.tagId, filters.tagId));
    const ids = tagRows.map((r) => r.customerId);
    if (ids.length === 0) return { customers: [], total: 0, page, limit };
    conditions.push(inArray(customers.id, ids));
  }

  if (filters.dateFrom) {
    conditions.push(gte(customers.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setDate(to.getDate() + 1);
    conditions.push(lte(customers.createdAt, to));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [result, countResult] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        contactType: customers.contactType,
        phone: customers.phone,
        email: customers.email,
        notes: customers.notes,
        provisional: customers.provisional,
        holdedContactId: customers.holdedContactId,
        updatedAt: customers.updatedAt,
        createdAt: customers.createdAt,
        repairCount: sql<number>`(SELECT COUNT(*) FROM repair_jobs WHERE repair_jobs.customer_id = ${customers.id})`.as("repair_count"),
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(customers).where(where),
  ]);

  return { customers: result, total: countResult[0]?.count ?? 0, page, limit };
}

export async function getCustomerById(id: string) {
  await requireAuth();
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;

  const [jobs, unitsList] = await Promise.all([
    db
      .select({
        id: repairJobs.id,
        publicCode: repairJobs.publicCode,
        title: repairJobs.title,
        status: repairJobs.status,
        invoiceStatus: repairJobs.invoiceStatus,
        holdedQuoteId: repairJobs.holdedQuoteId,
        holdedQuoteNum: repairJobs.holdedQuoteNum,
        holdedInvoiceId: repairJobs.holdedInvoiceId,
        holdedInvoiceNum: repairJobs.holdedInvoiceNum,
      })
      .from(repairJobs)
      .where(eq(repairJobs.customerId, id))
      .orderBy(desc(repairJobs.updatedAt)),
    db
      .select({ id: units.id, registration: units.registration, brand: units.brand, model: units.model })
      .from(units)
      .where(eq(units.customerId, id)),
  ]);

  return { ...customer, repairJobs: jobs, units: unitsList };
}

export async function createCustomer(data: unknown) {
  await requireRole("staff");
  const parsed = customerSchema.parse(data);

  const [customer] = await db
    .insert(customers)
    .values({ ...parsed, name: capitalizeWords(parsed.name), email: parsed.email || null })
    .returning();

  await createAuditLog("create", "customer", customer.id, { name: customer.name });
  revalidatePath("/customers");

  // Sync to Holded in background (don't block)
  syncCustomerToHolded(customer.id).catch(() => {});

  return customer;
}

export async function updateCustomer(id: string, data: unknown) {
  await requireRole("staff");
  const parsed = customerSchema.parse(data);

  const [updated] = await db
    .update(customers)
    .set({
      ...parsed,
      name: capitalizeWords(parsed.name),
      email: parsed.email || null,
      mobile: parsed.mobile || null,
      address: parsed.address || null,
      city: parsed.city || null,
      postalCode: parsed.postalCode || null,
      province: parsed.province || null,
      country: parsed.country || null,
      vatnumber: parsed.vatnumber || null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning();

  await createAuditLog("update", "customer", id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);

  // Sync to Holded in background (don't block)
  syncCustomerToHolded(id).catch(() => {});

  return updated;
}

export async function getAllCustomers() {
  await requireAuth();
  return db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(customers.name);
}

export async function deleteCustomer(id: string, deleteFromHolded?: boolean, password?: string) {
  await requireRole("admin");

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);

  if (!customer) throw new Error("Customer not found");

  // If deleting from Holded too, require password
  if (deleteFromHolded) {
    if (password !== "admin1234") throw new Error("Incorrect password");
    if (customer.holdedContactId) {
      try {
        const { deleteContact } = await import("@/lib/holded/invoices");
        await deleteContact(customer.holdedContactId);
      } catch {
        // Continue with local delete even if Holded delete fails
      }
    }
  }

  await db.delete(customers).where(eq(customers.id, id));
  await createAuditLog("delete", "customer", id, { name: customer.name, deletedFromHolded: deleteFromHolded ?? false });

  revalidatePath("/customers");
  return { deleted: true };
}
