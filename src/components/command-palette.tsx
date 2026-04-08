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
  Shield,
} from "lucide-react";

interface SearchResult {
  type: "repair" | "customer" | "unit";
  id: string;
  title: string;
  subtitle: string;
  status?: string;
  priority?: string;
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
  { label: "Settings", href: "/settings", icon: <Settings className="h-4 w-4" /> },
  { label: "Audit Log", href: "/audit", icon: <Shield className="h-4 w-4" /> },
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

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
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

  function navigate(href: string) {
    setOpen(false);
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
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="flex items-center border-b px-4">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search repairs, contacts, units or type a command..."
            className="border-0 shadow-none focus-visible:ring-0 h-12"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
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
                            : `/units/${result.id}`
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
              <div className="p-8 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}
        </div>

        <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
          <div className="flex gap-2 text-[10px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">↵</kbd>
            <span>open</span>
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">esc</kbd>
            <span>close</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">⌘K</kbd>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
