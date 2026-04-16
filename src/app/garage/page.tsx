import { getGarageRepairsToday, getGarageQuickStats, getActiveUsers } from "@/actions/garage";
import { getAllActiveTimers } from "@/actions/time-entries";
import { auth } from "@/lib/auth";
import { GarageTodayClient } from "./today-client";

export default async function GaragePage() {
  const session = await auth();
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
