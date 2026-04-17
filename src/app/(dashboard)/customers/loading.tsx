import { DashboardListSkeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return <DashboardListSkeleton rowCount={8} showStats={false} />;
}
