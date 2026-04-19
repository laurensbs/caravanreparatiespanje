import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGarageAuthenticated } from "@/lib/garage-auth";
import {
  getGarageRepairsToday,
  getGarageQuickStats,
  getActiveUsers,
} from "@/actions/garage";
import { getAllActiveTimers } from "@/actions/time-entries";

/**
 * Diagnostic endpoint for the elusive /garage 500. When the page
 * crashes in production, the React Server Components error swallows
 * the actual reason and only surfaces a digest. This route runs the
 * same data fetches as the page individually, captures errors per
 * step, and returns plain JSON so we can see which one blew up.
 *
 * Open in a browser: /api/garage/diag (works for any authed admin
 * or any session with a valid garage cookie).
 */
export const dynamic = "force-dynamic";

type StepResult =
  | { ok: true; ms: number; sample?: unknown }
  | { ok: false; ms: number; error: string; stack?: string };

async function timed<T>(fn: () => Promise<T>, sampleFn?: (v: T) => unknown): Promise<StepResult> {
  const t = Date.now();
  try {
    const v = await fn();
    return {
      ok: true,
      ms: Date.now() - t,
      sample: sampleFn ? sampleFn(v) : undefined,
    };
  } catch (err) {
    const e = err as Error;
    return {
      ok: false,
      ms: Date.now() - t,
      error: e?.message ?? String(err),
      stack: e?.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }
}

export async function GET() {
  const startedAt = Date.now();

  const authStep = await timed(() => auth(), (s) => ({
    hasSession: !!s?.user,
    userId: s?.user?.id ?? null,
  }));
  const garageCookieStep = await timed(isGarageAuthenticated, (v) => ({ authed: v }));

  const repairsStep = await timed(getGarageRepairsToday, (v) => ({ count: v.length }));
  const statsStep = await timed(getGarageQuickStats, (v) => v);
  const timersStep = await timed(getAllActiveTimers, (v) => ({ count: v.length }));
  const usersStep = await timed(getActiveUsers, (v) => ({ count: v.length }));

  return NextResponse.json(
    {
      totalMs: Date.now() - startedAt,
      env: {
        node: process.versions.node,
        nextRuntime: process.env.NEXT_RUNTIME ?? "unknown",
        vercelEnv: process.env.VERCEL_ENV ?? "unknown",
      },
      steps: {
        auth: authStep,
        garageCookie: garageCookieStep,
        repairs: repairsStep,
        stats: statsStep,
        timers: timersStep,
        users: usersStep,
      },
    },
    { status: 200 },
  );
}
