"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="group relative h-8 w-8 shrink-0 touch-manipulation overflow-hidden rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {/* Both icons are rendered; we crossfade + rotate between them on theme
          change, and add a tiny rotation on hover so the button feels alive. */}
      <Sun
        className={`absolute h-4 w-4 transition-all duration-300 ease-out group-hover:rotate-45 ${
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-75 opacity-0"
        }`}
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ease-out group-hover:-rotate-12 ${
          isDark
            ? "rotate-90 scale-75 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      />
    </Button>
  );
}
