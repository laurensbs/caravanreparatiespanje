"use client";

import { useState, createContext, useContext } from "react";

type Language = "en" | "es" | "nl";

const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: (en: string, es?: string | null, nl?: string | null) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (en) => en,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("garage-lang") as Language) ?? "en";
    }
    return "en";
  });

  function handleSetLang(l: Language) {
    setLang(l);
    localStorage.setItem("garage-lang", l);
  }

  function t(en: string, es?: string | null, nl?: string | null) {
    if (lang === "es" && es) return es;
    if (lang === "nl" && nl) return nl;
    return en;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
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
  const { lang, setLang } = useLanguage();
  const next = LANG_OPTIONS[(LANG_OPTIONS.findIndex((l) => l.code === lang) + 1) % LANG_OPTIONS.length];

  return (
    <button
      onClick={() => setLang(next.code)}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-all duration-150"
    >
      {LANG_OPTIONS.find((l) => l.code === lang)?.flag}
    </button>
  );
}

/** Big segmented bar – all 3 flags visible, direct tap */
export function LanguageBar() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1">
      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          onClick={() => setLang(opt.code)}
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
