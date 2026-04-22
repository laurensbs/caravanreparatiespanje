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
