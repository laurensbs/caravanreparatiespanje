import { getPlannedRepairs, getPlanningUsers, getPlanningLocations } from "@/actions/planning";
import { PlanningCalendar } from "@/components/planning/planning-calendar";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Planning" };

function getWeekBounds(offset = 0) {
  const now = new Date();
  // Monday of current week
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday.toISOString(), end: sunday.toISOString() };
}

export default async function PlanningPage() {
  const bounds = getWeekBounds(0);
  const [repairs, staff, locs] = await Promise.all([
    getPlannedRepairs(bounds.start, bounds.end),
    getPlanningUsers(),
    getPlanningLocations(),
  ]);

  return (
    <PlanningCalendar
      initialRepairs={repairs}
      initialWeekStart={bounds.start}
      initialWeekEnd={bounds.end}
      staff={staff}
      locations={locs}
    />
  );
}
