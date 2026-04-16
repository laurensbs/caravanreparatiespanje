import { db } from "@/lib/db";
import { repairJobs } from "@/lib/db/schema";
import { isNull, and, gte, lte, sql } from "drizzle-orm";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const authenticated = await isGarageAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const repairId = searchParams.get("repairId");

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (repairId) {
    // Detail page: check single repair's updatedAt
    const [row] = await db
      .select({
        lastUpdate: sql<string>`coalesce(${repairJobs.updatedAt}, ${repairJobs.createdAt})::text`,
      })
      .from(repairJobs)
      .where(sql`${repairJobs.id} = ${repairId}`);

    return NextResponse.json(
      { lastUpdate: row?.lastUpdate ?? null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Today page: max updatedAt across today's repairs
  const [row] = await db
    .select({
      lastUpdate: sql<string>`max(coalesce(${repairJobs.updatedAt}, ${repairJobs.createdAt}))::text`,
      count: sql<number>`count(*)`,
    })
    .from(repairJobs)
    .where(
      and(
        isNull(repairJobs.deletedAt),
        isNull(repairJobs.archivedAt),
        gte(repairJobs.dueDate, startOfDay),
        lte(repairJobs.dueDate, endOfDay)
      )
    );

  return NextResponse.json(
    { lastUpdate: row?.lastUpdate ?? null, count: Number(row?.count ?? 0) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
