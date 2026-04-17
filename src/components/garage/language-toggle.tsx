"use client";

import { useState, useCallback, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { garageLangManualSessionKey } from "@/lib/garage-lang-by-worker";

export type Language = "en" | "es" | "nl";

type LanguageContextValue = {
  lang: Language;
  /** Sets language + localStorage (e.g. worker-based auto on a repair) */
  setLang: (l: Language) => void;
  /** User picked via flag control — blocks auto language for this repair in the session */
  setGarageLangByUser: (l: Language, repairJobId: string | null) => void;
  t: (en: string, es?: string | null, nl?: string | null) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  setGarageLangByUser: () => {},
  t: (en) => en,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

function readRepairJobIdFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/garage\/repairs\/([^/]+)/);
  return m ? m[1] : null;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("garage-lang") as Language) ?? "en";
    }
    return "en";
  });

  const applyLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem("garage-lang", l);
  }, []);

  const handleSetLang = useCallback(
    (l: Language) => {
      applyLang(l);
    },
    [applyLang]
  );

  const setGarageLangByUser = useCallback(
    (l: Language, repairJobId: string | null) => {
      applyLang(l);
      if (repairJobId) {
        try {
          sessionStorage.setItem(garageLangManualSessionKey(repairJobId), "1");
        } catch {
          // ignore quota / private mode
        }
      }
    },
    [applyLang]
  );

  function t(en: string, es?: string | null, nl?: string | null) {
    if (lang === "es" && es) return es;
    if (lang === "nl" && nl) return nl;
    return en;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, setGarageLangByUser, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

const LANG_OPTIONS: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "nl", flag: "🇳🇱", label: "NL" },
];

/** Compact inline toggle – shows current flag, taps to cycle */
export function LanguageToggle() {
  const pathname = usePathname();
  const repairJobId = readRepairJobIdFromPathname(pathname);
  const { lang, setGarageLangByUser } = useLanguage();
  const next = LANG_OPTIONS[(LANG_OPTIONS.findIndex((l) => l.code === lang) + 1) % LANG_OPTIONS.length];

  return (
    <button
      type="button"
      onClick={() => setGarageLangByUser(next.code, repairJobId)}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-all duration-150"
    >
      {LANG_OPTIONS.find((l) => l.code === lang)?.flag}
    </button>
  );
}

/** Big segmented bar – all 3 flags visible, direct tap */
export function LanguageBar() {
  const pathname = usePathname();
  const repairJobId = readRepairJobIdFromPathname(pathname);
  const { lang, setGarageLangByUser } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1">
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setGarageLangByUser(opt.code, repairJobId)}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-semibold transition-all duration-150 ${
            lang === opt.code
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
