"use server";

import { db } from "@/lib/db";
import { customers, repairJobs } from "@/lib/db/schema";
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
import { eq, desc, ilike, or, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCustomers(filters: { q?: string; page?: number; limit?: number } = {}) {
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

  const where = conditions.length > 0 ? conditions[0] : undefined;

  const [result, countResult] = await Promise.all([
    db.select().from(customers).where(where).orderBy(desc(customers.updatedAt)).limit(limit).offset(offset),
    db.select({ count: count() }).from(customers).where(where),
  ]);

  return { customers: result, total: countResult[0]?.count ?? 0, page, limit };
}

export async function getCustomerById(id: string) {
  await requireAuth();
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!customer) return null;

  const jobs = await db
    .select({ id: repairJobs.id, publicCode: repairJobs.publicCode, title: repairJobs.title, status: repairJobs.status })
    .from(repairJobs)
    .where(eq(repairJobs.customerId, id))
    .orderBy(desc(repairJobs.updatedAt));

  return { ...customer, repairJobs: jobs };
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
  return customer;
}

export async function updateCustomer(id: string, data: unknown) {
  await requireRole("staff");
  const parsed = customerSchema.parse(data);

  const [updated] = await db
    .update(customers)
    .set({ ...parsed, name: capitalizeWords(parsed.name), email: parsed.email || null, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();

  await createAuditLog("update", "customer", id);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return updated;
}

export async function getAllCustomers() {
  await requireAuth();
  return db.select({ id: customers.id, name: customers.name }).from(customers).orderBy(customers.name);
}
