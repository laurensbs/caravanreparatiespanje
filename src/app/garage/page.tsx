import { getGarageRepairsToday } from "@/actions/garage";
import { auth } from "@/lib/auth";
import { GarageTodayClient } from "./today-client";

export default async function GaragePage() {
  const session = await auth();
  const repairs = await getGarageRepairsToday();

  return (
    <GarageTodayClient
      repairs={repairs}
      userName={session?.user?.name ?? "Garage"}
    />
  );
}
