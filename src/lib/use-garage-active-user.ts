"use client";

import { useCallback, useEffect, useState } from "react";

export type GarageActiveUser = {
  id: string;
  name: string;
  preferredLanguage: "en" | "es" | "nl";
};

const STORAGE_KEY = "garage:active-user";

function readStored(): GarageActiveUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GarageActiveUser>;
    if (!parsed?.id || !parsed?.name) return null;
    const lang = (parsed.preferredLanguage ?? "en") as GarageActiveUser["preferredLanguage"];
    return { id: parsed.id, name: parsed.name, preferredLanguage: lang };
  } catch {
    return null;
  }
}

/**
 * Persistent "who is using this iPad" profile. One localStorage entry,
 * mirrored to React state so callers can rerender on switch. Callers
 * use this as the source of authorship for timers, messages and
 * findings — no more ad-hoc WorkerPicker popups per action.
 */
/**
 * The iPad defaults to Spanish because the shop-floor workforce is
 * predominantly Spanish-speaking. Rolf and Mark (the Dutch-speaking
 * office/owner profiles) are the only named exceptions — when they're
 * the active iPad profile the UI flips back to Dutch. Consumers call
 * `preferredLangForWorker(activeUser.name)` and pipe the result into
 * `setDeviceLang` in a useEffect. Centralising the rule here so we
 * only ever change the exception list in one place.
 */
export function preferredLangForWorker(name: string | null | undefined): "nl" | "es" {
  if (!name) return "es";
  const firstToken = name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return firstToken === "rolf" || firstToken === "mark" ? "nl" : "es";
}

export function useGarageActiveUser() {
  const [user, setUser] = useState<GarageActiveUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(readStored());
    setHydrated(true);
  }, []);

  const pick = useCallback((next: GarageActiveUser) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    setUser(next);
  }, []);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
  }, []);

  return { user, hydrated, pick, clear };
}
