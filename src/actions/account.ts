"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function updateOwnProfile(data: { name?: string }) {
  const session = await requireAuth();

  const updateData: Record<string, unknown> = {};
  if (data.name?.trim()) updateData.name = data.name.trim();

  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData).where(eq(users.id, session.user.id));
    revalidatePath("/settings/account");
  }
}

export async function changeOwnPassword(data: { currentPassword: string; newPassword: string }) {
  const session = await requireAuth();

  if (!data.newPassword || data.newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) throw new Error("User not found");

  const isValid = await compare(data.currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");

  const hashedPassword = await hash(data.newPassword, 12);
  await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, session.user.id));

  revalidatePath("/settings/account");
}
