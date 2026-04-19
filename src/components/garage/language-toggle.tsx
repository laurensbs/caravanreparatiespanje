"use client";

import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
} from "react";

export type Language = "en" | "es" | "nl";

/**
 * Two-layer language model for the shared garage iPad:
 *
 * 1. **deviceLang** — the UI default for the iPad (or phone). Set once
 *    via the flag toggle in the header. Persisted in localStorage.
 *    Defaults to English so the device feels neutral until configured.
 *
 * 2. **actor language** — the personal preference of whoever just
 *    performed an action (start timer, complete task, …). Looked up
 *    from the `users.preferred_language` column server-side and
 *    passed to the helper `tFor(actorLang, en, es, nl)` for *that
 *    one toast or confirmation*. The UI itself stays in deviceLang
 *    so the iPad is predictable for the next person walking up.
 */
type LanguageContextValue = {
  deviceLang: Language;
  setDeviceLang: (l: Language) => void;
  /** Translate using the device language. */
  t: (en: string, es?: string | null, nl?: string | null) => string;
  /** Translate using a specific actor's preferred language. */
  tFor: (
    actorLang: Language | null | undefined,
    en: string,
    es?: string | null,
    nl?: string | null,
  ) => string;
};

const STORAGE_KEY = "garage-device-lang";
const DEFAULT_LANG: Language = "en";

const LanguageContext = createContext<LanguageContextValue>({
  deviceLang: DEFAULT_LANG,
  setDeviceLang: () => {},
  t: (en) => en,
  tFor: (_a, en) => en,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

function pick(lang: Language, en: string, es?: string | null, nl?: string | null): string {
  if (lang === "es" && es) return es;
  if (lang === "nl" && nl) return nl;
  return en;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Read synchronously on the client so the first paint is in the
  // right language. Falls back to the default on the server.
  const [deviceLang, setLangState] = useState<Language>(() => {
    if (typeof window === "undefined") return DEFAULT_LANG;
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored === "en" || stored === "es" || stored === "nl") return stored;
    return DEFAULT_LANG;
  });

  // One-time migration: previously the key was "garage-lang" with
  // a different lifecycle. Carry it over so we don't reset everyone.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const legacy = localStorage.getItem("garage-lang") as Language | null;
    if (legacy && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, legacy);
      setLangState(legacy);
    }
  }, []);

  const setDeviceLang = useCallback((l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const t = useCallback(
    (en: string, es?: string | null, nl?: string | null) =>
      pick(deviceLang, en, es, nl),
    [deviceLang],
  );

  const tFor = useCallback(
    (
      actorLang: Language | null | undefined,
      en: string,
      es?: string | null,
      nl?: string | null,
    ) => pick(actorLang ?? deviceLang, en, es, nl),
    [deviceLang],
  );

  return (
    <LanguageContext.Provider value={{ deviceLang, setDeviceLang, t, tFor }}>
      {children}
    </LanguageContext.Provider>
  );
}

const LANG_OPTIONS: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "nl", flag: "🇳🇱", label: "NL" },
];

/**
 * Compact flag toggle — taps cycle through EN → ES → NL.
 * Sets the *device* language for everyone using this iPad.
 */
export function LanguageToggle() {
  const { deviceLang, setDeviceLang } = useLanguage();
  const next =
    LANG_OPTIONS[(LANG_OPTIONS.findIndex((l) => l.code === deviceLang) + 1) % LANG_OPTIONS.length];

  return (
    <button
      type="button"
      onClick={() => setDeviceLang(next.code)}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-all duration-150"
      aria-label={`Switch language (currently ${deviceLang.toUpperCase()})`}
    >
      {LANG_OPTIONS.find((l) => l.code === deviceLang)?.flag}
    </button>
  );
}

/** Big segmented bar with all three flags visible. */
export function LanguageBar() {
  const { deviceLang, setDeviceLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1">
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setDeviceLang(opt.code)}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-all duration-150 ${
            deviceLang === opt.code
              ? "bg-white/20 text-white shadow-sm"
              : "text-white/40 active:bg-white/[0.1]"
          }`}
        >
          <span className="text-base">{opt.flag}</span>
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
