"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from "@/types";
import type { RepairStatus, Priority } from "@/types";
import {
  Search,
  Wrench,
  Users,
  Truck,
  ArrowRight,
  Loader2,
  LayoutDashboard,
  Settings,
  X,
} from "lucide-react";

interface SearchResult {
  type: "repair" | "customer" | "unit";
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  priority?: string;
}

interface RecentEntry {
  type: "repair" | "customer" | "unit";
  id: string;
  title: string;
  subtitle?: string;
  ts: number;
}

const RECENTS_KEY = "command-palette.recents";
const RECENTS_MAX = 6;

function loadRecents(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(entry: Omit<RecentEntry, "ts">) {
  if (typeof window === "undefined") return;
  try {
    const current = loadRecents().filter((r) => !(r.type === entry.type && r.id === entry.id));
    current.unshift({ ...entry, ts: Date.now() });
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(current.slice(0, RECENTS_MAX)));
  } catch {
    // ignore
  }
}

interface QuickAction {
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const quickActions: QuickAction[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-4 w-4" />, shortcut: "D" },
  { label: "All Repairs", href: "/repairs", icon: <Wrench className="h-4 w-4" />, shortcut: "R" },
  { label: "New Repair", href: "/repairs/new", icon: <Wrench className="h-4 w-4" />, shortcut: "N" },
  { label: "Contacts", href: "/customers", icon: <Users className="h-4 w-4" />, shortcut: "C" },
  { label: "Units", href: "/units", icon: <Truck className="h-4 w-4" />, shortcut: "U" },
  { label: "Kanban Board", href: "/repairs/board", icon: <LayoutDashboard className="h-4 w-4" />, shortcut: "B" },
  { label: "Settings", href: "/settings/locations", icon: <Settings className="h-4 w-4" /> },
];

const TYPE_ICONS = {
  repair: <Wrench className="h-4 w-4" />,
  customer: <Users className="h-4 w-4" />,
  unit: <Truck className="h-4 w-4" />,
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Global keyboard shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset on open + load recents from localStorage
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setRecents(loadRecents());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search with debounce
  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
          setActiveIndex(0);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    []
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  }

  function navigate(href: string, recent?: Omit<RecentEntry, "ts">) {
    setOpen(false);
    if (recent) pushRecent(recent);
    router.push(href);
  }

  // Filter quick actions by query
  const filteredActions = query.trim()
    ? quickActions.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      )
    : quickActions;

  // Combined list for keyboard nav
  const allItems = [
    ...results.map((r) => ({
      key: `${r.type}-${r.id}`,
      href:
        r.type === "repair"
          ? `/repairs/${r.id}`
          : r.type === "customer"
            ? `/customers/${r.id}`
            : `/units/${r.id}`,
    })),
    ...filteredActions.map((a) => ({ key: a.label, href: a.href })),
  ];

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && allItems[activeIndex]) {
      e.preventDefault();
      navigate(allItems[activeIndex].href);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        Mobile: full-dvh sheet anchored to the top so the iOS keyboard can
        sit flush against the bottom without pushing the entire sheet
        off-screen (the earlier bottom-sheet layout left only the search
        field visible once the keyboard opened).
        Desktop: keep the classic centered palette.
      */}
      <DialogContent
        className="!flex !flex-col !gap-0 !inset-0 !top-0 !bottom-0 !left-0 !right-0 !h-[100dvh] !max-h-none !w-full max-w-lg overflow-hidden !rounded-none !p-0 [&>button]:max-sm:hidden sm:!inset-auto sm:!left-[50%] sm:!top-[50%] sm:!h-auto sm:!max-h-[min(85dvh,720px)] sm:!w-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-2xl"
        style={{ paddingBottom: "0" }}
      >
        <div
          className="flex items-center gap-2 border-b border-border/70 bg-card px-3 sm:px-4"
          style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
        >
          <Search className="ml-1 h-[18px] w-[18px] shrink-0 text-muted-foreground sm:h-4 sm:w-4" />
          <Input
            ref={inputRef}
            placeholder="Search repairs, contacts, units…"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-12 border-0 px-1 text-[16px] shadow-none focus-visible:ring-0 sm:h-12 sm:text-sm"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close search"
            className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 sm:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain sm:max-h-[360px]" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {/* Recent — only when no query typed */}
          {!query.trim() && recents.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                Recent
              </p>
              {recents.map((entry) => (
                <button
                  key={`recent-${entry.type}-${entry.id}`}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-foreground/90 transition-colors hover:bg-muted"
                  onClick={() =>
                    navigate(
                      entry.type === "repair"
                        ? `/repairs/${entry.id}`
                        : entry.type === "customer"
                          ? `/customers/${entry.id}`
                          : `/units/${entry.id}`,
                      { type: entry.type, id: entry.id, title: entry.title, subtitle: entry.subtitle },
                    )
                  }
                >
                  <span className="text-muted-foreground/70">{TYPE_ICONS[entry.type]}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.title}</span>
                  {entry.subtitle ? (
                    <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                      {entry.subtitle}
                    </span>
                  ) : null}
                  <ArrowRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Results
              </p>
              {results.map((result, idx) => {
                const itemIdx = idx;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      activeIndex === itemIdx
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() =>
                      navigate(
                        result.type === "repair"
                          ? `/repairs/${result.id}`
                          : result.type === "customer"
                            ? `/customers/${result.id}`
                            : `/units/${result.id}`,
                        { type: result.type, id: result.id, title: result.title, subtitle: result.subtitle },
                      )
                    }
                    onMouseEnter={() => setActiveIndex(itemIdx)}
                  >
                    <div className="text-muted-foreground">
                      {TYPE_ICONS[result.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{result.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {result.subtitle}
                      </p>
                    </div>
                    {result.status && (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${STATUS_COLORS[result.status as RepairStatus] ?? ""}`}
                      >
                        {STATUS_LABELS[result.status as RepairStatus] ?? result.status}
                      </Badge>
                    )}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Quick actions */}
          {filteredActions.length > 0 && (
            <div className="border-t p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {query.trim() ? "Actions" : "Quick Actions"}
              </p>
              {filteredActions.map((action, idx) => {
                const itemIdx = results.length + idx;
                return (
                  <button
                    key={action.label}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      activeIndex === itemIdx
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => navigate(action.href)}
                    onMouseEnter={() => setActiveIndex(itemIdx)}
                  >
                    <div className="text-muted-foreground">{action.icon}</div>
                    <span className="flex-1">{action.label}</span>
                    {action.shortcut && (
                      <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query.trim().length >= 2 &&
            !loading &&
            results.length === 0 &&
            filteredActions.length === 0 && (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No results for <span className="font-mono">&ldquo;{query}&rdquo;</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a different word, or search by customer, city, or public code.
                </p>
              </div>
            )}
        </div>

        {/* Keyboard hints footer — desktop only; meaningless on mobile. */}
        <div className="hidden items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2 sm:flex">
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <kbd className="rounded bg-card px-1.5 py-0.5 font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded bg-card px-1.5 py-0.5 font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">↵</kbd>
            <span>open</span>
            <kbd className="rounded bg-card px-1.5 py-0.5 font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">esc</kbd>
            <span>close</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setTimeout(() => {
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", shiftKey: true }));
              }, 100);
            }}
            className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Shortcuts <kbd className="ml-1 rounded bg-card px-1.5 py-0.5 font-mono shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">?</kbd>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
