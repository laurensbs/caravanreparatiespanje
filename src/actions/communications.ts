"use server";

import { db } from "@/lib/db";
import { communicationLogs, repairJobs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getCommunicationLogs(repairJobId: string) {
  await requireAuth();

  return db
    .select()
    .from(communicationLogs)
    .where(eq(communicationLogs.repairJobId, repairJobId))
    .orderBy(desc(communicationLogs.contactedAt));
}

export async function addCommunicationLog(data: {
  repairJobId: string;
  contactMethod: string;
  direction: string;
  contactPerson?: string;
  summary: string;
  outcome?: string;
  contactedAt?: Date;
}) {
  const session = await requireAuth();

  await db.insert(communicationLogs).values({
    repairJobId: data.repairJobId,
    userId: session.user.id,
    contactMethod: data.contactMethod as any,
    direction: data.direction as any,
    contactPerson: data.contactPerson,
    summary: data.summary,
    outcome: data.outcome,
    contactedAt: data.contactedAt ?? new Date(),
  });

  // Update lastContactAt on the repair job
  await db
    .update(repairJobs)
    .set({ lastContactAt: new Date(), updatedAt: new Date() })
    .where(eq(repairJobs.id, data.repairJobId));

  revalidatePath(`/repairs/${data.repairJobId}`);
}
