import { NextResponse } from "next/server";
import { purgeOldDeletedRepairs } from "@/actions/repairs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeOldDeletedRepairs();

  return NextResponse.json({
    purged: result.purged,
    timestamp: new Date().toISOString(),
  });
}
