"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ClipboardList, Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistantContext } from "@/components/assistant-context";

/**
 * Bottom tab bar for screens below lg. Mirrors the top destinations
 * a phone user actually needs without forcing them to open the
 * hamburger menu every time. The center FAB-style button opens the
 * command palette (which doubles as 'new repair' search), the
 * Sparkles slot opens the smart assistant.
 *
 * Hidden in print + on lg+ (desktop has the sidebar).
 * Padded for iOS safe area on the bottom.
 */
const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "Home", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { href: "/repairs", label: "Work", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpen, setTab } = useAssistantContext();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function openSearch() {
    if (typeof window === "undefined") return;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  function openAssistant() {
    setTab("assistant");
    setOpen(true);
  }

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 px-2 backdrop-blur-xl print:hidden lg:hidden"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 py-1">
        {TABS.slice(0, 1).map((tab) => (
          <BottomTab key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        <BottomTab
          href="#"
          label="Zoek"
          icon={<Search className="h-[18px] w-[18px]" />}
          onClick={(e) => {
            e.preventDefault();
            openSearch();
          }}
          active={false}
        />

        {/* Center prominent 'new repair' FAB */}
        <Link
          href="/repairs/new"
          className={cn(
            "relative -mt-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.30)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-105 active:scale-90",
          )}
          aria-label="Nieuwe reparatie"
        >
          <Plus className="h-5 w-5" />
        </Link>

        {TABS.slice(1).map((tab) => (
          <BottomTab key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        <BottomTab
          href="#"
          label="Assistant"
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          onClick={(e) => {
            e.preventDefault();
            openAssistant();
          }}
          active={false}
        />
      </div>
    </nav>
  );
}

function BottomTab({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex h-11 min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium tracking-[-0.005em] transition-colors duration-150",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-90",
          active && "scale-110",
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
