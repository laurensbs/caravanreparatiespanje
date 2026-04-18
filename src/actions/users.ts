"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { userSchema } from "@/lib/validators";
import { createAuditLog } from "./audit";

export async function getUsers() {
  await requireRole("admin");
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.name);
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "manager" | "staff" | "technician" | "viewer";
}) {
  const session = await requireRole("admin");
  const validated = userSchema.parse(data);
  const hashedPassword = await hash(validated.password!, 12);

  const [user] = await db
    .insert(users)
    .values({
      name: validated.name,
      email: validated.email,
      passwordHash: hashedPassword,
      role: validated.role,
    })
    .returning({ id: users.id });

  await createAuditLog("create", "user", user.id, { name: validated.name, role: validated.role });
  revalidatePath("/settings/users");
  return user;
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; role?: "admin" | "manager" | "staff" | "technician" | "viewer"; active?: boolean; password?: string }
) {
  await requireRole("admin");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.password) updateData.passwordHash = await hash(data.password, 12);

  await db.update(users).set(updateData).where(eq(users.id, id));
  await createAuditLog("update", "user", id, { fields: Object.keys(updateData) });
  revalidatePath("/settings/users");
}

/**
 * Soft-disable a user. We never hard-delete the row because audit_logs,
 * repair_jobs, and similar tables foreign-key into users — wiping a row
 * would orphan history. `active=false` revokes login (auth.ts already
 * checks `user.active`) without losing the trail.
 */
export async function deactivateUser(id: string) {
  await requireRole("admin");
  await db.update(users).set({ active: false }).where(eq(users.id, id));
  await createAuditLog("update", "user", id, { fields: ["active"], to: false });
  revalidatePath("/settings/users");
}

export async function activateUser(id: string) {
  await requireRole("admin");
  await db.update(users).set({ active: true }).where(eq(users.id, id));
  await createAuditLog("update", "user", id, { fields: ["active"], to: true });
  revalidatePath("/settings/users");
}

/** Force a password reset by setting a new bcrypt hash. */
export async function resetUserPassword(id: string, newPassword: string) {
  await requireRole("admin");
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const hashed = await hash(newPassword, 12);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, id));
  await createAuditLog("update", "user", id, { fields: ["passwordHash"], reason: "admin_reset" });
  revalidatePath("/settings/users");
}
