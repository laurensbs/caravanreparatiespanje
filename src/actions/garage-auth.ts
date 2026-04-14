"use server";

import { verifyGaragePassword } from "@/lib/garage-auth";

export async function garageLogin(password: string): Promise<{ success: boolean }> {
  const ok = await verifyGaragePassword(password);
  return { success: ok };
}
