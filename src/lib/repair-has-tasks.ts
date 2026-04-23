import { db } from "@/lib/db";
import { repairTasks, serviceRequests } from "@/lib/db/schema";
import { count, eq } from "drizzle-orm";

/**
 * True if the repair has at least one task row (workshop checklist) OR
 * at least one service-request. Service-only jobs have no tasks, so we
 * treat their services as the equivalent "planning is ready" signal —
 * otherwise you can't schedule a pure service-job like Transport cleaning.
 */
export async function repairJobHasTasks(repairJobId: string): Promise<boolean> {
  const [taskRow] = await db
    .select({ total: count() })
    .from(repairTasks)
    .where(eq(repairTasks.repairJobId, repairJobId));
  if ((taskRow?.total ?? 0) > 0) return true;

  const [serviceRow] = await db
    .select({ total: count() })
    .from(serviceRequests)
    .where(eq(serviceRequests.repairJobId, repairJobId));
  return (serviceRow?.total ?? 0) > 0;
}
