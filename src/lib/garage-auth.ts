import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { auth } from "@/lib/auth";

const GARAGE_PIN = "1234";
const COOKIE_NAME = "garage_auth";
const SESSION_DURATION = 4 * 60 * 60; // 4 hours in seconds

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

/** Verify the garage PIN and set a signed session cookie (4 hours) */
export async function verifyGaragePin(pin: string): Promise<boolean> {
  if (pin !== GARAGE_PIN) return false;

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

  // Verify signature
  const expectedSig = sign(`garage:${timestamp}`);
  if (providedSig !== expectedSig) return false;

  // Check expiry (4 hours)
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

/** Require garage authentication — throws if not authenticated */
export async function requireGarageAuth(): Promise<void> {
  const ok = await isGarageAuthenticated();
  if (!ok) throw new Error("Garage authentication required");
}

/** Auth context returned by requireAnyAuth */
export type AuthContext = {
  userId: string | null;
  userName: string;
};

/** Require either NextAuth session OR valid garage cookie */
export async function requireAnyAuth(): Promise<AuthContext> {
  const session = await auth();
  if (session?.user) {
    return { userId: session.user.id, userName: session.user.name };
  }
  const garageOk = await isGarageAuthenticated();
  if (garageOk) {
    return { userId: null, userName: "Garage" };
  }
  throw new Error("Unauthorized");
}
