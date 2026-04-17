import { getRepairJobs } from "@/actions/repairs";
import { getLocations } from "@/actions/locations";
import { KanbanBoard } from "./kanban-board";

export default async function RepairBoardPage() {
  const [jobsResult, locations] = await Promise.all([
    getRepairJobs({ limit: 200 }),
    getLocations(),
  ]);

  return (
    <div className="space-y-4 animate-fade-in sm:space-y-6">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">Repair Board</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag and drop jobs between status columns. Swipe horizontally on smaller screens.
        </p>
      </div>
      <KanbanBoard jobs={jobsResult.jobs} />
    </div>
  );
}
