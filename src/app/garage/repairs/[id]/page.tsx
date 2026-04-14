import { getGarageRepairDetail, garageAutoStart, getRepairFindings, getRepairBlockers } from "@/actions/garage";
import { getPartCategories } from "@/actions/parts";
import { getJobActiveTimers } from "@/actions/time-entries";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { GarageRepairDetailClient } from "./detail-client";

export default async function GarageRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [repair, session, findings, blockers, partCategories, activeTimers] = await Promise.all([
    getGarageRepairDetail(id),
    auth(),
    getRepairFindings(id),
    getRepairBlockers(id),
    getPartCategories(),
    getJobActiveTimers(id),
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
    />
  );
}
