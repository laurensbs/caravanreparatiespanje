"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait for hydration before rendering an icon — the inline bootstrap in
  // app/layout.tsx already set the .dark class so the canvas is right,
  // but resolvedTheme can lag for a tick. Avoids a sun→moon flash.
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="group relative h-8 w-8 shrink-0 touch-manipulation overflow-hidden rounded-full text-muted-foreground transition-all duration-200 hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {/* Render a placeholder during the first paint to avoid hydration
          mismatch on the icon. The button itself stays visible. */}
      {!mounted ? (
        <Sun className="h-4 w-4 opacity-0" />
      ) : (
        <>
          {/* Sun shows in dark mode (click to go light), Moon in light mode.
              Both rotate + crossfade on theme change. The whole button gets
              a subtle scale/spin via active: + group-hover: for tactile
              feedback. */}
          <Sun
            className={`absolute h-4 w-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-45 ${
              isDark
                ? "rotate-0 scale-100 opacity-100"
                : "-rotate-90 scale-50 opacity-0"
            }`}
          />
          <Moon
            className={`absolute h-4 w-4 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-12 ${
              isDark
                ? "rotate-90 scale-50 opacity-0"
                : "rotate-0 scale-100 opacity-100"
            }`}
          />
        </>
      )}
    </Button>
  );
}
