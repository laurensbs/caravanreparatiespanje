import { getDeletedRepairJobs } from "@/actions/repairs";
import { BinClient } from "./bin-client";

export default async function RepairBinPage() {
  const deletedJobs = await getDeletedRepairJobs();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Bin</h1>
        <p className="text-xs text-muted-foreground">
          {deletedJobs.length} deleted repair{deletedJobs.length !== 1 ? "s" : ""}. Items are permanently removed after 30 days.
        </p>
      </div>

      <BinClient jobs={deletedJobs} />
    </div>
  );
}
