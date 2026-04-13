import { getUnitById } from "@/actions/units";
import { getTags } from "@/actions/tags";
import { notFound } from "next/navigation";
import { UnitDetailClient } from "./unit-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function UnitDetailPage({ params }: Props) {
  const { id } = await params;
  const [unit, allTags] = await Promise.all([
    getUnitById(id),
    getTags(),
  ]);
  if (!unit) notFound();

  return <UnitDetailClient unit={unit} allTags={allTags} />;
}
