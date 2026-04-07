"use server";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { auth } from "@/lib/auth";

export async function createAuditLog(
  action: string,
  entityType: string,
  entityId: string | null,
  changes?: Record<string, unknown>
) {
  const session = await auth();
  await db.insert(auditLogs).values({
    userId: session?.user?.id ?? null,
    action,
    entityType,
    entityId,
    changes: changes ?? null,
  });
}
