import { getGarageRepairDetail, garageAutoStart } from "@/actions/garage";
import { notFound } from "next/navigation";
import { GarageRepairDetailClient } from "./detail-client";

export default async function GarageRepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repair = await getGarageRepairDetail(id);

  if (!repair) {
    notFound();
  }

  // Auto-start: move to in_progress when opened
  await garageAutoStart(id);

  return <GarageRepairDetailClient repair={repair} />;
}
