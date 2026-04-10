import { getGarageRepairDetail, garageAutoStart } from "@/actions/garage";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { GarageRepairDetailClient } from "./detail-client";

export default async function GarageRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [repair, session] = await Promise.all([
    getGarageRepairDetail(id),
    auth(),
  ]);

  if (!repair) {
    notFound();
  }

  // Auto-start: move to in_progress when opened
  await garageAutoStart(id);

  return (
    <GarageRepairDetailClient
      repair={repair}
      currentUserId={session?.user?.id ?? ""}
      currentUserName={session?.user?.name ?? ""}
    />
  );
}
