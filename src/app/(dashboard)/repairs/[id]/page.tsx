import { getRepairJobById } from "@/actions/repairs";
import { notFound } from "next/navigation";
import { RepairDetail } from "@/components/repairs/repair-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RepairDetailPage({ params }: Props) {
  const { id } = await params;
  const job = await getRepairJobById(id);
  if (!job) notFound();

  return <RepairDetail job={job} />;
}
