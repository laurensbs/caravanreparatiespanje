import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

const COOKIE_NAME = "garage_auth";
// Effectief "voor altijd" (1 jaar). De werkplaats-iPad hoort ingelogd
// te blijven zodat werkers nooit midden in een klus terug naar de
// PIN worden gestuurd. Uitloggen kan altijd nog expliciet via de UI
// (zet garage-sessie-cookie leeg).
const SESSION_DURATION = 365 * 24 * 60 * 60;

/**
 * Garage shared PIN. Read from `GARAGE_PIN` env var. In development we
 * fall back to `"1234"` so onboarding stays frictionless; in production
 * we hard-fail if it isn't set so nobody accidentally ships the default.
 */
function getGaragePin(): string {
  const envPin = process.env.GARAGE_PIN?.trim();
  if (envPin) return envPin;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "GARAGE_PIN is not set. Define it in your deployment environment.",
    );
  }
  return "1234";
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  // Pad to equal length so `timingSafeEqual` doesn't throw and so that the
  // comparison cost is constant regardless of where the first mismatch
  // occurs. A length mismatch is still a mismatch but is leaked.
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify the garage PIN and set a signed session cookie (1 year). */
export async function verifyGaragePin(pin: string): Promise<boolean> {
  if (!constantTimeEquals(pin, getGaragePin())) return false;

  const timestamp = Date.now().toString();
  const signature = sign(`garage:${timestamp}`);
  const token = `${timestamp}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/garage",
  });

  return true;
}

/** Check whether the current request has a valid garage auth cookie */
export async function isGarageAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return false;

  const timestamp = token.substring(0, dotIdx);
  const providedSig = token.substring(dotIdx + 1);

  const expectedSig = sign(`garage:${timestamp}`);
  if (!constantTimeEquals(providedSig, expectedSig)) return false;

  // Check expiry against the current session duration (1 year).
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  if (Date.now() - ts > SESSION_DURATION * 1000) return false;

  return true;
}

/** Clear the garage session cookie (lock garage) */
export async function clearGarageSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: COOKIE_NAME, path: "/garage" });
}

/**
 * Best-effort detection of whether the current request originates from
 * the garage PWA. We inspect the `referer` header (set by the browser
 * on every navigation / fetch / form submit) and the Next.js-internal
 * `next-url` header. If either points at `/garage`, the caller is a
 * garage tablet; otherwise we assume the admin portal.
 *
 * Used to decide where to bounce unauthenticated callers: an admin
 * whose session briefly hiccups should land on `/login`, not on the
 * workshop PIN screen.
 */
async function callerIsFromGarage(): Promise<boolean> {
  try {
    const hdrs = await headers();
    const referer = hdrs.get("referer") ?? "";
    const nextUrl = hdrs.get("next-url") ?? "";
    const rscUrl = hdrs.get("rsc") ? hdrs.get("next-router-state-tree") ?? "" : "";
    const candidates = `${referer} ${nextUrl} ${rscUrl}`;
    // Referer can be a full URL (http://…/garage/repairs/…) or just
    // a path depending on the browser; substring match is enough.
    return /\/garage(?:\/|$|\?)/.test(candidates);
  } catch {
    return false;
  }
}

/** Require garage authentication — redirects to /garage if missing */
export async function requireGarageAuth(): Promise<void> {
  const ok = await isGarageAuthenticated();
  if (!ok) redirect("/garage");
}

/** Auth context returned by requireAnyAuth */
export type AuthContext = {
  userId: string | null;
  userName: string;
};

/**
 * Require either NextAuth session OR valid garage cookie.
 *
 * If neither is present we *redirect* the caller instead of throwing,
 * because throwing turned a stale-cookie POST into an opaque 500. The
 * redirect target depends on the caller's origin: requests coming
 * from the garage PWA go back to `/garage` (PIN keypad); everything
 * else goes to `/login`. That last part is critical — without it an
 * admin whose session momentarily hiccups during a server action
 * gets bounced into the workshop PWA, which is confusing and
 * entirely wrong.
 */
export async function requireAnyAuth(): Promise<AuthContext> {
  const session = await auth();
  if (session?.user) {
    return { userId: session.user.id, userName: session.user.name };
  }
  const garageOk = await isGarageAuthenticated();
  if (garageOk) {
    return { userId: null, userName: "Garage" };
  }
  const fromGarage = await callerIsFromGarage();
  redirect(fromGarage ? "/garage" : "/login");
}
