import { getUnitById } from "@/actions/units";
import { notFound } from "next/navigation";
import { UnitDetailClient } from "./unit-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UnitDetailPage({ params }: Props) {
  const { id } = await params;
  const unit = await getUnitById(id);
  if (!unit) notFound();

  return <UnitDetailClient unit={unit} />;
}
