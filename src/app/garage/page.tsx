import { getGarageRepairsToday, getGarageQuickStats, getActiveUsers } from "@/actions/garage";
import { getAllActiveTimers } from "@/actions/time-entries";
import { auth } from "@/lib/auth";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { GarageTodayClient } from "./today-client";

export default async function GaragePage() {
  // Belt + braces: the layout already shows <GarageLoginForm/> when
  // the cookie is missing, but Next App Router still kicks off the
  // page render in parallel. Without this guard, the data fetches
  // below throw 'Unauthorized' and the error.tsx fallback renders on
  // top of the login screen for a flash. Returning null here is
  // harmless because the layout never renders this child if !authed.
  const [authed, session] = await Promise.all([isGarageAuthenticated(), auth()]);
  if (!authed && !session?.user) return null;

  const [repairs, stats, activeTimers, allUsers] = await Promise.all([
    getGarageRepairsToday(),
    getGarageQuickStats(),
    getAllActiveTimers(),
    getActiveUsers(),
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
