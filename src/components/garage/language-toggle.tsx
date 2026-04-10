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

const FLAGS: Record<Language, string> = { en: "🇬🇧", es: "🇪🇸", nl: "🇳🇱" };

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  const langs: Language[] = ["en", "es", "nl"];
  const next = langs[(langs.indexOf(lang) + 1) % langs.length];

  return (
    <button
      onClick={() => setLang(next)}
      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl active:bg-muted"
    >
      {FLAGS[lang]}
    </button>
  );
}
