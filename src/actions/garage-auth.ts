"use server";

import { verifyGaragePin, clearGarageSession } from "@/lib/garage-auth";

export async function garageLogin(pin: string): Promise<{ success: boolean }> {
  const ok = await verifyGaragePin(pin);
  return { success: ok };
}

export async function garageLock(): Promise<void> {
  await clearGarageSession();
}
