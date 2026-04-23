"use server";

import { db } from "@/lib/db";
import { customers, units, parts, partCategories, services } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { asc } from "drizzle-orm";

/**
 * Single round-trip bootstrap for the "New repair" dialog. Replaces four
 * separate server actions that the dashboard page used to call eagerly,
 * only to have them sit idle until the user actually clicked "+ New".
 *
 * We keep the response shape aligned with the existing `NewRepairDialog`
 * props so the caller is a drop-in upgrade: supply the result as props
 * when the dialog opens.
 */
export async function getNewRepairDialogData() {
  await requireAuth();

  const [customerRows, unitRows, partRows, categoryRows, serviceRows] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .orderBy(customers.name),
    db
      .select({
        id: units.id,
        registration: units.registration,
        brand: units.brand,
        model: units.model,
        year: units.year,
        customerId: units.customerId,
      })
      .from(units)
      .orderBy(asc(units.registration)),
    db
      .select({
        id: parts.id,
        name: parts.name,
        partNumber: parts.partNumber,
        defaultCost: parts.defaultCost,
        orderUrl: parts.orderUrl,
        category: parts.category,
      })
      .from(parts)
      .orderBy(asc(parts.name)),
    db
      .select()
      .from(partCategories)
      .orderBy(asc(partCategories.sortOrder), asc(partCategories.label)),
    db
      .select({
        id: services.id,
        name: services.name,
        category: services.category,
        defaultPrice: services.defaultPrice,
        active: services.active,
      })
      .from(services)
      .orderBy(asc(services.sortOrder), asc(services.name)),
  ]);

  return {
    customers: customerRows,
    units: unitRows,
    partsCatalog: partRows,
    partCategories: categoryRows,
    servicesCatalog: serviceRows.filter((s) => s.active),
  };
}
