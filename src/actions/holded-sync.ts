"use server";

import { requireRole, requireAuth } from "@/lib/auth-utils";
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
import { executeHoldedQuoteSync } from "@/lib/holded/execute-quote-sync";

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

// ─── Quick (throttled) quote + payment sync for client-triggered refreshes ───
//
// The Vercel crons (`/api/sync-quotes` every 15 min, `/api/sync-payments`
// every minute) already process approvals, declines and linked invoice
// payments. The problem in practice is that an admin may open the
// panel and see a repair still marked "waiting response" because the
// next cron tick hasn't happened yet. This action lets the UI pull the
// same sync on demand — both as an implicit safety net when the panel
// loads, and as an explicit "Sync with Holded" button on the
// Quotes / Invoices page.

const QUICK_SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
let lastQuickSyncAt = 0;
let quickSyncPromise: Promise<unknown> | null = null;

export type HoldedQuickSyncResult = {
  ran: boolean;
  throttled: boolean;
  stats?: {
    quoteApprovalsSynced: number;
    quoteDeclinesSynced: number;
    discovered: number;
    repairsAutoCreated: number;
    invoiceDiscovered: number;
    invoiceStatusUpdated: number;
  };
  message: string;
};

/**
 * Runs the quote + invoice Holded sync at most once per
 * QUICK_SYNC_THROTTLE_MS. Available to any authenticated panel user
 * (not only admins) because it's the same work the crons do anyway,
 * and we want any open tab to be able to self-heal.
 */
export async function quickSyncHoldedQuotes(
  options?: { force?: boolean },
): Promise<HoldedQuickSyncResult> {
  await requireAuth();
  if (!isHoldedConfigured()) {
    return { ran: false, throttled: false, message: "Holded not configured" };
  }

  const now = Date.now();
  const shouldSkip = !options?.force && now - lastQuickSyncAt < QUICK_SYNC_THROTTLE_MS;
  if (shouldSkip) {
    return {
      ran: false,
      throttled: true,
      message: "Synced recently — skipping",
    };
  }

  // De-duplicate concurrent callers so simultaneous tab loads don't
  // fan out to multiple Holded API roundtrips.
  if (quickSyncPromise) {
    try {
      await quickSyncPromise;
    } catch {
      // ignore — we already returned from the in-flight run
    }
    return {
      ran: false,
      throttled: true,
      message: "Another sync is already running",
    };
  }

  lastQuickSyncAt = now;
  const run = (async () => {
    const [quoteStats, paymentStats] = await Promise.all([
      executeHoldedQuoteSync().catch((e) => {
        // Swallow so one side failing doesn't abort the other. The
        // individual crons already log errors on their own.
        console.warn("[holded] quick quote sync failed", e);
        return null;
      }),
      executeHoldedPaymentSync().catch((e) => {
        console.warn("[holded] quick payment sync failed", e);
        return null;
      }),
    ]);

    // Revalidate surfaces where approved/declined/paid changes are
    // visible so the next navigation (or a refresh) picks up the new
    // state without any extra user interaction.
    revalidatePath("/", "layout");
    revalidatePath("/repairs");
    revalidatePath("/invoices");

    return { quoteStats, paymentStats };
  })();

  quickSyncPromise = run;
  try {
    const { quoteStats, paymentStats } = await run;

    const stats = {
      quoteApprovalsSynced: quoteStats?.quoteApprovalsSynced ?? 0,
      quoteDeclinesSynced: quoteStats?.quoteDeclinesSynced ?? 0,
      discovered: quoteStats?.discovered ?? 0,
      repairsAutoCreated: quoteStats?.repairsAutoCreated ?? 0,
      invoiceDiscovered: paymentStats?.discovered ?? 0,
      invoiceStatusUpdated: paymentStats?.statusUpdated ?? 0,
    };

    const totalChanges =
      stats.quoteApprovalsSynced +
      stats.quoteDeclinesSynced +
      stats.discovered +
      stats.repairsAutoCreated +
      stats.invoiceDiscovered +
      stats.invoiceStatusUpdated;

    return {
      ran: true,
      throttled: false,
      stats,
      message:
        totalChanges > 0
          ? `Synced ${stats.quoteApprovalsSynced} approvals, ${stats.quoteDeclinesSynced} declines, ${stats.invoiceStatusUpdated} invoice updates`
          : "Everything already in sync",
    };
  } finally {
    quickSyncPromise = null;
  }
}
