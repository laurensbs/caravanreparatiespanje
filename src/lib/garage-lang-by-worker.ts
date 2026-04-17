/** Garage UI languages */
export type GarageLanguage = "en" | "es" | "nl";

const SPANISH_FIRST_NAMES = new Set(["felipe", "josue", "michael"]);
const DUTCH_FIRST_NAMES = new Set(["mark", "rolf"]);

export function garageLangManualSessionKey(repairJobId: string): string {
  return `garage-lang-manual-${repairJobId}`;
}

/** First word of display name, lowercased */
function firstNameToken(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const t = fullName.trim().split(/\s+/)[0]?.toLowerCase();
  return t || null;
}

/** Default garage language for the active worker, or null → do not change */
export function inferGarageLanguageFromWorkerName(fullName: string | null | undefined): GarageLanguage | null {
  const first = firstNameToken(fullName);
  if (!first) return null;
  if (SPANISH_FIRST_NAMES.has(first)) return "es";
  if (DUTCH_FIRST_NAMES.has(first)) return "nl";
  return null;
}
