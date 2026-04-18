"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Global keyboard shortcuts: register handlers and an `?` cheat sheet.
 *
 * Shortcut philosophy (Linear/Notion-style):
 *  - Single-key when no field is focused (j/k/g/?, etc.)
 *  - Global modifier (⌘/Ctrl) for actions that should always work
 *  - We never trap inside <input> / <textarea> / contentEditable
 *  - The cheat sheet is opened with `?` (or shift+/), closed with Esc
 */

type Shortcut = {
  keys: string[];
  label: string;
  group: "Navigation" | "Actions" | "Help";
};

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], label: "Open command palette", group: "Actions" },
  { keys: ["?"], label: "Show keyboard shortcuts", group: "Help" },
  { keys: ["G", "D"], label: "Go to dashboard", group: "Navigation" },
  { keys: ["G", "R"], label: "Go to repairs", group: "Navigation" },
  { keys: ["G", "B"], label: "Go to kanban board", group: "Navigation" },
  { keys: ["G", "C"], label: "Go to customers", group: "Navigation" },
  { keys: ["G", "U"], label: "Go to units", group: "Navigation" },
  { keys: ["G", "P"], label: "Go to planning", group: "Navigation" },
  { keys: ["N"], label: "New repair", group: "Actions" },
  { keys: ["Esc"], label: "Close dialogs / clear focus", group: "Actions" },
];

function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showSheet, setShowSheet] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  useEffect(() => {
    const timeout: { id: ReturnType<typeof setTimeout> | null } = { id: null };

    function clearG() {
      setPendingG(false);
      if (timeout.id) clearTimeout(timeout.id);
    }

    function handler(e: KeyboardEvent) {
      // Modifier-based shortcuts work even in fields (except ⌘K which the
      // palette handles itself). Single-key shortcuts only fire when not
      // typing.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingInField(e.target)) {
        if (e.key === "Escape" && (e.target as HTMLElement)?.blur) {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Help sheet
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowSheet((s) => !s);
        return;
      }

      // Two-key "go" prefix (Linear-style: g then d/r/b/c/u/p)
      if (pendingG) {
        const map: Record<string, string> = {
          d: "/",
          r: "/repairs",
          b: "/repairs/board",
          c: "/customers",
          u: "/units",
          p: "/planning",
        };
        const dest = map[e.key.toLowerCase()];
        clearG();
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }

      if (e.key === "g") {
        e.preventDefault();
        setPendingG(true);
        timeout.id = setTimeout(clearG, 1500);
        return;
      }

      // Single-key shortcuts
      if (e.key === "n") {
        e.preventDefault();
        router.push("/repairs/new");
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timeout.id) clearTimeout(timeout.id);
    };
  }, [pendingG, router]);

  const grouped = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    acc[s.group] = [...(acc[s.group] ?? []), s];
    return acc;
  }, {});

  return (
    <>
      {/* Tiny G-prefix indicator at the bottom-left, fades in/out */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed bottom-3 left-3 z-[60] rounded-lg border border-border/60 bg-card/90 px-2 py-1 font-mono text-[10px] tracking-wider text-muted-foreground shadow-md backdrop-blur transition-all duration-150",
          pendingG ? "opacity-100 translate-y-0" : "translate-y-1 opacity-0",
        )}
      >
        Go to … <span className="text-foreground/70">d r b c u p</span>
      </div>

      <Dialog open={showSheet} onOpenChange={setShowSheet}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sneltoetsen</DialogTitle>
            <DialogDescription>
              Tip: <Kbd>?</Kbd> opent dit venster, <Kbd>Esc</Kbd> sluit het.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 sm:grid-cols-2">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group}
                </p>
                <ul className="space-y-1.5">
                  {items.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <span className="text-foreground/90">{s.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k, i) => (
                          <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[20px] items-center justify-center rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
      {children}
    </kbd>
  );
}
