import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";

const roleHierarchy: Record<UserRole, number> = {
  viewer: 0,
  technician: 1,
  staff: 1,
  manager: 2,
  admin: 3,
};

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireRole(minRole: UserRole) {
  const session = await requireAuth();
  if (roleHierarchy[session.user.role] < roleHierarchy[minRole]) {
    throw new Error("Forbidden");
  }
  return session;
}

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

export function canEdit(role: UserRole): boolean {
  return hasMinRole(role, "staff");
}

export function canCreate(role: UserRole): boolean {
  return hasMinRole(role, "manager");
}

export function canDelete(role: UserRole): boolean {
  return hasMinRole(role, "admin");
}

export function canManageUsers(role: UserRole): boolean {
  return hasMinRole(role, "admin");
}

export function canExport(role: UserRole): boolean {
  return hasMinRole(role, "manager");
}

export function canImport(role: UserRole): boolean {
  return hasMinRole(role, "admin");
}

/**
 * The "owner" — a single person who sees the workspace activity portal
 * and (in the future) any owner-only billing screens. We don't have a
 * dedicated DB role for this yet; for now it's identified by email.
 *
 * If you ever change owner, swap the constant or move this to a settings
 * row. Lower-cased + trimmed compare, so casing in the DB doesn't break
 * the match.
 */
export const OWNER_EMAIL = "laurensbos@hotmail.com";

export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === OWNER_EMAIL;
}

export async function requireOwner() {
  const session = await requireAuth();
  if (!isOwner(session.user.email)) {
    throw new Error("Forbidden");
  }
  return session;
}
