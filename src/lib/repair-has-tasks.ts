import { db } from "@/lib/db";
import { repairTasks } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

/** True if the repair has at least one task row (workshop checklist). */
export async function repairJobHasTasks(repairJobId: string): Promise<boolean> {
  const [row] = await db
    .select({ total: count() })
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId));
  return (row?.total ?? 0) > 0;
}
