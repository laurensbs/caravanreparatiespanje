"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Me" on the shared garage iPad.
 *
 * The garage portal is authenticated with a shared 4-digit PIN — we do not
 * know which specific worker is in front of the iPad. To make the UI feel
 * personal (timers pre-filled, handover instant, language auto-switched)
 * we let workers tap "This is me" once at the start of their shift. The
 * choice sticks per-device in localStorage so the iPad remembers across
 * refreshes, idle-locks and navigations.
 *
 * - `id` is the `users.id` UUID from getSelectableGarageUsers.
 * - `name` is the display name we last saw for them.
 *
 * The chip is a soft hint, not an identity boundary. Anything that actually
 * matters for audit (timers, comments, findings) still runs through the
 * proper server-side worker selection and writes the picked user to the
 * DB — this helper just pre-fills the picker.
 */

const STORAGE_KEY = "garage_me_v1";

export type GarageMe = {
  id: string;
  name: string;
  /** When set, auto-clear at this timestamp (ms since epoch). Undefined = never expires. */
  expiresAt?: number;
};

type StoredMe = GarageMe | null;

function readStored(): StoredMe {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GarageMe;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.name) {
      return null;
    }
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(me: StoredMe) {
  if (typeof window === "undefined") return;
  try {
    if (me) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent("garage-me-changed"));
  } catch {
    // ignore quota / private mode
  }
}

/** Read + react to the currently-selected garage worker on this device. */
export function useGarageMe(): {
  me: GarageMe | null;
  setMe: (me: GarageMe | null) => void;
  clear: () => void;
} {
  const [me, setMeState] = useState<GarageMe | null>(null);

  useEffect(() => {
    setMeState(readStored());
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setMeState(readStored());
    }
    function onCustom() {
      setMeState(readStored());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("garage-me-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("garage-me-changed", onCustom);
    };
  }, []);

  const setMe = useCallback((next: GarageMe | null) => {
    writeStored(next);
    setMeState(next);
  }, []);

  const clear = useCallback(() => {
    writeStored(null);
    setMeState(null);
  }, []);

  return { me, setMe, clear };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
