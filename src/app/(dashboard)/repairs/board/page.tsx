import { getRepairJobs } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { KanbanBoard } from "./kanban-board";

export default async function RepairBoardPage() {
  const [jobsResult, locations] = await Promise.all([
    getRepairJobs({ limit: 200 }),
    getLocations(),
  ]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold tracking-tight">Repair Board</h1>
        <p className="text-sm text-muted-foreground">
          Drag and drop jobs between status columns.
        </p>
      </div>
      <KanbanBoard jobs={jobsResult.jobs} />
    </div>
  );
}
