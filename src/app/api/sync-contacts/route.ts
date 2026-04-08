import { NextResponse } from "next/server";
import { isHoldedConfigured } from "@/lib/holded/client";
import { pullContacts } from "@/lib/holded/sync";

// Vercel cron: runs every 6 hours to sync all Holded contacts → DB

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  try {
    const result = await pullContacts();
    return NextResponse.json({
      message: "Contact sync complete",
      holdedTotal: result.holdedTotal,
      matched: result.matched,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
