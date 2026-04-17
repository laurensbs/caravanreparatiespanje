"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 touch-manipulation rounded-lg"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-muted-foreground transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground transition-transform duration-200 hover:-rotate-12" />
      )}
    </Button>
  );
}
