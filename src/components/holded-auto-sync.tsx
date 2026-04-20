"use client";

/**
 * Triggers `quickSyncHoldedQuotes` once per admin visit, silently.
 *
 * Why this exists:
 *   The Vercel cron runs every 15 minutes. In practice an admin often
 *   refreshes the panel seconds after a customer clicks "Approve" in
 *   their Holded email — and is frustrated that the repair still shows
 *   "waiting response". This component fires one client-side call that
 *   piggybacks on the same sync logic, so the panel reflects reality as
 *   soon as the page loads, regardless of the cron cadence.
 *
 * The server action is throttled to once per 5 minutes across the whole
 * instance, so there's no harm in mounting this broadly — it's cheap
 * in the common case and only hits Holded when something might actually
 * have changed.
 */

import { useEffect, useRef } from "react";
import { quickSyncHoldedQuotes } from "@/actions/holded-sync";
import { useRouter } from "next/navigation";

const SESSION_KEY = "holded-sync-last";
const CLIENT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes per tab

export function HoldedAutoSync() {
  const firedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // Respect a short per-tab cooldown too so in-app navigations don't
    // pile up repeated sync kicks every few seconds. The server-side
    // throttle is the real safety net; this just avoids noisy requests.
    try {
      const last = Number(window.sessionStorage.getItem(SESSION_KEY) ?? "0");
      if (Number.isFinite(last) && Date.now() - last < CLIENT_COOLDOWN_MS) {
        return;
      }
      window.sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    } catch {
      // sessionStorage can throw in privacy mode; fall through and try anyway
    }

    void (async () => {
      try {
        const res = await quickSyncHoldedQuotes();
        if (res.ran && res.stats) {
          const changed =
            (res.stats.quoteApprovalsSynced ?? 0) +
            (res.stats.quoteDeclinesSynced ?? 0) +
            (res.stats.discovered ?? 0) +
            (res.stats.repairsAutoCreated ?? 0);
          if (changed > 0) router.refresh();
        }
      } catch {
        // Silent — a failed auto-sync shouldn't surface to the user.
      }
    })();
  }, [router]);

  return null;
}
