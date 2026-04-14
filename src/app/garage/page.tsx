import { getGarageRepairsToday, getGarageQuickStats } from "@/actions/garage";
import { auth } from "@/lib/auth";
import { GarageTodayClient } from "./today-client";

export default async function GaragePage() {
  const session = await auth();
  const [repairs, stats] = await Promise.all([
    getGarageRepairsToday(),
    getGarageQuickStats(),
  ]);

  return (
    <GarageTodayClient
      repairs={repairs}
      stats={stats}
      userName={session?.user?.name ?? "Garage"}
    />
  );
}
