import { NextRequest, NextResponse } from "next/server";
import { verifyGaragePin } from "@/lib/garage-auth";

/**
 * Mirrors what the garageLogin server action does, but as a plain
 * REST endpoint so we can probe it from curl. Reports the exact
 * error message instead of the opaque RSC 500.
 *
 * POST /api/garage/diag-login   body: { pin: "1234" }
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { pin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.pin) {
    return NextResponse.json({ ok: false, error: "Missing pin" }, { status: 400 });
  }

  try {
    const ok = await verifyGaragePin(body.pin);
    return NextResponse.json({ ok: true, accepted: ok });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? String(err),
        stack: e?.stack?.split("\n").slice(0, 8).join("\n"),
      },
      { status: 200 },
    );
  }
}

export async function GET() {
  // Quick env probe — never reveals the actual values, only whether
  // they are set.
  return NextResponse.json({
    hasGaragePin: !!process.env.GARAGE_PIN,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
