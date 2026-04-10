import { getGarageRepairDetail } from "@/actions/garage";
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

  return <GarageRepairDetailClient repair={repair} />;
}
