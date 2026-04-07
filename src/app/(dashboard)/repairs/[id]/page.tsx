import { getRepairJobById } from "@/actions/repairs";
import { getCommunicationLogs } from "@/actions/communications";
import { notFound } from "next/navigation";
import { RepairDetail } from "@/components/repairs/repair-detail";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RepairDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [job, communicationLogs] = await Promise.all([
    getRepairJobById(id),
    getCommunicationLogs(id),
  ]);
  if (!job) notFound();

  return <RepairDetail job={job} communicationLogs={communicationLogs} backTo={sp.backTo} />;
}
