import { DashboardListSkeleton } from "@/components/ui/skeleton";

export default function BinLoading() {
  return <DashboardListSkeleton rowCount={5} showStats={false} />;
}
