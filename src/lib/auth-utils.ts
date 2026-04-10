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
