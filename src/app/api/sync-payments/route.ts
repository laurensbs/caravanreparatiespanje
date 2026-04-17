import { NextResponse } from "next/server";
import { isHoldedConfigured } from "@/lib/holded/client";
import { executeHoldedPaymentSync } from "@/lib/holded/execute-payment-sync";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isHoldedConfigured()) {
    return NextResponse.json({ message: "Holded not configured" });
  }

  try {
    const stats = await executeHoldedPaymentSync();
    return NextResponse.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
