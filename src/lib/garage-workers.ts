export type GarageUserOption = {
  id: string;
  name: string | null;
  role: string | null;
  preferredLanguage?: "en" | "es" | "nl" | null;
};

const EXCLUDED_WORKER_NAMES = new Set(["laurens", "jake", "johan"]);

export function getSelectableGarageUsers<T extends GarageUserOption>(users: T[]): T[] {
  return users.filter((user) => {
    if (!user.name) return false;
    if (user.role === "admin") return false;
    const normalized = user.name.trim().toLowerCase();
    if (!normalized) return false;
    return !EXCLUDED_WORKER_NAMES.has(normalized);
  });
}
