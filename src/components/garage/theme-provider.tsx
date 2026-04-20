"use client";

/**
 * Garage theme system — two modes (`dark`, `light`) that flip a CSS class
 * on the garage root container. The rest of the garage UI is styled with
 * a bunch of hard-coded dark utilities (bg-stone-950, text-white, …); the
 * companion stylesheet at `src/app/garage/garage-theme.css` scopes overrides
 * under `.garage-light` so we don't need to rewrite every component.
 *
 * Choice is persisted in localStorage so the shared iPad remembers what
 * the garage team picked. Defaults to `dark` (the original look).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { hapticTap } from "@/lib/haptic";
import { Moon, Sun } from "lucide-react";
import { useLanguage } from "./language-toggle";

export type GarageTheme = "dark" | "light";

const STORAGE_KEY = "garage-theme";
const DEFAULT_THEME: GarageTheme = "dark";

type ThemeContextValue = {
  theme: GarageTheme;
  setTheme: (t: GarageTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useGarageTheme() {
  return useContext(ThemeContext);
}

export function GarageThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<GarageTheme>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    const stored = window.localStorage.getItem(STORAGE_KEY) as GarageTheme | null;
    if (stored === "light" || stored === "dark") return stored;
    return DEFAULT_THEME;
  });

  // Keep the `<html>` color-scheme in sync so the browser picks sensible
  // form control + scrollbar colors without us having to theme each one.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.colorScheme = theme;
    return () => {
      document.documentElement.style.colorScheme = "";
    };
  }, [theme]);

  const setTheme = useCallback((next: GarageTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode / quota — the live state is still updated.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: GarageTheme = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div
        data-garage-theme={theme}
        className={
          theme === "light"
            ? "garage-light flex min-h-screen flex-col bg-stone-50 text-stone-900"
            : "flex min-h-screen flex-col bg-stone-950 text-white"
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Compact sun/moon toggle — tap flips the theme instantly. */
export function GarageThemeToggle() {
  const { theme, toggleTheme } = useGarageTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        hapticTap();
        toggleTheme();
      }}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-white/70 transition-all duration-150 hover:bg-white/[0.06] active:bg-white/[0.1]"
      aria-label={
        isDark
          ? t("Switch to light mode", "Cambiar a modo claro", "Wissel naar lichte modus")
          : t("Switch to dark mode", "Cambiar a modo oscuro", "Wissel naar donkere modus")
      }
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
