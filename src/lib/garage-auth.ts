import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { auth } from "@/lib/auth";

const GARAGE_PASSWORD = "C@r@v@n2024!@#";
const COOKIE_NAME = "garage_auth";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

/** Verify that the garage password is correct and set a signed cookie */
export async function verifyGaragePassword(password: string): Promise<boolean> {
  if (password !== GARAGE_PASSWORD) return false;

  const timestamp = Date.now().toString();
  const signature = sign(`garage:${timestamp}`);
  const token = `${timestamp}.${signature}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
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

  // Check expiry
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;
  if (Date.now() - ts > COOKIE_MAX_AGE * 1000) return false;

  return true;
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
