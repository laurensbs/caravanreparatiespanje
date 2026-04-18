import { getGarageRepairDetail, garageAutoStart, getRepairFindings, getRepairBlockers, getActiveUsers } from "@/actions/garage";
import { getPartCategories } from "@/actions/parts";
import { getJobActiveTimers } from "@/actions/time-entries";
import { auth } from "@/lib/auth";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { notFound } from "next/navigation";
import { GarageRepairDetailClient } from "./detail-client";

export default async function GarageRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Same parallel-render guard as /garage page: bail out cleanly if
  // the layout will be showing the PIN screen anyway.
  const [authed, session] = await Promise.all([isGarageAuthenticated(), auth()]);
  if (!authed && !session?.user) return null;

  const [repair, findings, blockers, partCategories, activeTimers, allUsers] = await Promise.all([
    getGarageRepairDetail(id),
    getRepairFindings(id),
    getRepairBlockers(id),
    getPartCategories(),
    getJobActiveTimers(id),
    getActiveUsers(),
  ]);

  if (!repair) {
    notFound();
  }

  // Auto-start: move to in_progress when opened
  await garageAutoStart(id);

  return (
    <GarageRepairDetailClient
      repair={{ ...repair, findings, blockers }}
      currentUserId={session?.user?.id ?? ""}
      currentUserName={session?.user?.name ?? ""}
      partCategories={partCategories}
      activeTimers={activeTimers}
      allUsers={allUsers}
    />
  );
}
