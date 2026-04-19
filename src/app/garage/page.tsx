import { getGarageRepairsToday, getGarageQuickStats, getActiveUsers } from "@/actions/garage";
import { getAllActiveTimers } from "@/actions/time-entries";
import { auth } from "@/lib/auth";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { GarageTodayClient } from "./today-client";

/**
 * If a sub-fetch fails (DB hiccup, transient Neon timeout, schema
 * drift on a single column) we don't want the whole garage portal
 * to bounce to the error.tsx page on a shared workshop iPad. We log
 * the error to the server (so it surfaces in Vercel logs with a
 * useful message instead of just a digest) and return a safe
 * fallback so the worker can still see the page chrome and the
 * other widgets keep working.
 */
async function safeFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[garage page] ${label} failed:`, err);
    return fallback;
  }
}

export default async function GaragePage() {
  // Belt + braces: the layout already shows <GarageLoginForm/> when
  // the cookie is missing, but Next App Router still kicks off the
  // page render in parallel. Without this guard, the data fetches
  // below throw 'Unauthorized' and the error.tsx fallback renders on
  // top of the login screen for a flash. Returning null here is
  // harmless because the layout never renders this child if !authed.
  const [authed, session] = await Promise.all([
    safeFetch("isGarageAuthenticated", isGarageAuthenticated, false),
    safeFetch("auth", () => auth(), null),
  ]);
  if (!authed && !session?.user) return null;

  const [repairs, stats, activeTimers, allUsers] = await Promise.all([
    safeFetch("getGarageRepairsToday", getGarageRepairsToday, [] as Awaited<
      ReturnType<typeof getGarageRepairsToday>
    >),
    safeFetch("getGarageQuickStats", getGarageQuickStats, {
      tomorrowCount: 0,
      waitingPartsCount: 0,
      urgentCount: 0,
      unassignedCount: 0,
    }),
    safeFetch("getAllActiveTimers", getAllActiveTimers, [] as Awaited<
      ReturnType<typeof getAllActiveTimers>
    >),
    safeFetch("getActiveUsers", getActiveUsers, [] as Awaited<
      ReturnType<typeof getActiveUsers>
    >),
  ]);

  return (
    <GarageTodayClient
      repairs={repairs}
      stats={stats}
      userName={session?.user?.name ?? "Garage"}
      activeTimers={activeTimers}
      allUsers={allUsers}
    />
  );
}
