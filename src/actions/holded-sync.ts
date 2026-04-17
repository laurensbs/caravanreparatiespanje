"use server";

import { requireRole } from "@/lib/auth-utils";
import { createAuditLog } from "./audit";
import { revalidatePath } from "next/cache";
import {
  pullContacts,
  pullProducts,
  getSyncStatus,
  pushContactToHolded,
  pushSupplierToHolded,
} from "@/lib/holded/sync";
import { isHoldedConfigured } from "@/lib/holded/client";
import { executeHoldedPaymentSync } from "@/lib/holded/execute-payment-sync";

// ─── Sync contacts from Holded → DB ───

export async function syncContactsFromHolded() {
  await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded API not configured");

  const result = await pullContacts();

  await createAuditLog("holded_contacts_synced", "system", null, {
    holdedTotal: result.holdedTotal,
    matched: result.matched,
    created: result.created,
    skipped: result.skipped,
    errors: result.errors.length,
  });

  revalidatePath("/customers");
  revalidatePath("/settings/holded");
  return result;
}

// ─── Sync products from Holded → DB parts ───

export async function syncProductsFromHolded() {
  await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded API not configured");

  const result = await pullProducts();

  await createAuditLog("holded_products_synced", "system", null, {
    holdedTotal: result.holdedTotal,
    matched: result.matched,
    created: result.created,
    skipped: result.skipped,
    errors: result.errors.length,
  });

  revalidatePath("/parts");
  revalidatePath("/settings/holded");
  return result;
}

// ─── Get sync status ───

export async function getHoldedSyncStatus() {
  await requireRole("admin");
  return getSyncStatus();
}

/** Runs the same invoice discovery + status sync as the Vercel cron (one full pass). Admin-only. */
export async function runHoldedInvoiceDiscoveryNow() {
  await requireRole("admin");
  if (!isHoldedConfigured()) throw new Error("Holded not configured");

  const stats = await executeHoldedPaymentSync();

  await createAuditLog("holded_invoice_discovery", "system", null, {
    discovered: stats.discovered,
    statusUpdated: stats.statusUpdated,
    errors: stats.errors,
    invoicesTotal: stats.invoicesTotal,
  });

  revalidatePath("/repairs");
  revalidatePath("/settings/audit");
  return stats;
}

// ─── Push single contact to Holded ───

export async function pushContact(customerId: string) {
  await requireRole("admin");
  await pushContactToHolded(customerId);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

// ─── Push single supplier to Holded ───

export async function pushSupplier(supplierId: string) {
  await requireRole("admin");
  await pushSupplierToHolded(supplierId);
  revalidatePath("/parts");
}
