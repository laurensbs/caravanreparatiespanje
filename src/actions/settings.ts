"use server";

import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { requireRole, requireAuth } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getAppSettings(): Promise<Record<string, string>> {
  await requireAuth();
  const rows = await db.select().from(appSettings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function updateAppSetting(key: string, value: string) {
  await requireRole("admin");

  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  if (existing) {
    await db
      .update(appSettings)
      .set({ value, updatedAt: new Date() })
      .where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value });
  }

  revalidatePath("/settings");
  revalidatePath("/repairs");
  revalidatePath("/parts");
}
