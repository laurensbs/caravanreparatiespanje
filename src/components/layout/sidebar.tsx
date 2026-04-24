"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Truck,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Receipt,
  CalendarDays,
  Warehouse,
  ExternalLink,
  ClipboardList,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { UserRole } from "@/types";
import { hasMinRole } from "@/lib/auth-utils";
import { useSidebar } from "./sidebar-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  minRole?: UserRole;
  bottom?: boolean;
  external?: boolean;
  group?: string;
  /** Key into SidebarCounts — drives the count badge on the right of the row. */
  countKey?: "workOrdersOpen" | "planning" | "contacts" | "units" | "parts" | "invoices" | "messages";
  /** Key into SidebarCounts that, if > 0, shows a small red attention dot
   *  (currently only used for urgent work orders). */
  attentionKey?: "workOrdersUrgent";
  /** Key into SidebarCounts that, if > 0, shows a small amber attention dot
   *  (currently used for ready_for_check repairs). */
  checkKey?: "readyForCheck";
}

const navItems: NavItem[] = [
  // OPERATIONS
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-[18px] w-[18px]" />, group: "Operations" },
  { label: "Work Orders", href: "/repairs", icon: <ClipboardList className="h-[18px] w-[18px]" />, group: "Operations", countKey: "workOrdersOpen", attentionKey: "workOrdersUrgent", checkKey: "readyForCheck" },
  { label: "Planning", href: "/planning", icon: <CalendarDays className="h-[18px] w-[18px]" />, group: "Operations", countKey: "planning" },
  { label: "Garage", href: "/api/garage-reset", icon: <Warehouse className="h-[18px] w-[18px]" />, group: "Operations" },
  { label: "Messages", href: "/messages", icon: <MessageSquare className="h-[18px] w-[18px]" />, group: "Operations", countKey: "messages" },
  // DATA
  { label: "Contacts", href: "/customers", icon: <Users className="h-[18px] w-[18px]" />, group: "Data" },
  { label: "Units", href: "/units", icon: <Truck className="h-[18px] w-[18px]" />, group: "Data" },
  // Parts keeps its count: it represents pending part requests, an
  // actionable signal (not just 'how many records exist').
  { label: "Parts", href: "/parts", icon: <Package className="h-[18px] w-[18px]" />, group: "Data", countKey: "parts" },
  { label: "Services", href: "/services", icon: <Sparkles className="h-[18px] w-[18px]" />, group: "Data" },
  // FINANCE
  { label: "Quotes / Invoices", href: "/invoices", icon: <Receipt className="h-[18px] w-[18px]" />, group: "Finance" },
];

export type SidebarCounts = {
  workOrdersOpen: number;
  workOrdersUrgent: number;
  planning: number;
  contacts: number;
  units: number;
  parts: number;
  invoices: number;
  messages: number;
  readyForCheck: number;
};

interface SidebarProps {
  userRole: UserRole;
  counts?: SidebarCounts;
}

export function Sidebar({ userRole, counts }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [isLg, setIsLg] = useState(true);

  const effectiveCollapsed = isLg ? collapsed : false;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      const next = mq.matches;
      setIsLg(next);
      if (next) setMobileOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [setMobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Hover expand/collapse (desktop rail only)
  const supportsHover = useRef(true);
  const leaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(hover: hover)");
    supportsHover.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      supportsHover.current = e.matches;
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isLg || !supportsHover.current) return;
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    setCollapsed(false);
  }, [isLg, setCollapsed]);

  const handleMouseLeave = useCallback(() => {
    if (!isLg || !supportsHover.current) return;
    leaveTimeout.current = setTimeout(() => setCollapsed(true), 200);
  }, [isLg, setCollapsed]);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (Math.abs(dx) <= 50 || dy >= 30) return;
      if (!isLg) {
        if (dx < 0) setMobileOpen(false);
        return;
      }
      if (dx < 0) setCollapsed(true);
      else setCollapsed(false);
    },
    [isLg, setCollapsed, setMobileOpen],
  );

  const filteredItems = navItems.filter(
    (item) => !item.minRole || hasMinRole(userRole, item.minRole),
  );
  const mainItems = filteredItems.filter((item) => !item.bottom);
  const bottomItems = filteredItems.filter((item) => item.bottom);

  function NavLink({ item }: { item: NavItem }) {
    const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

    const linkProps = item.external ? { target: "_blank", rel: "noopener" } : {};

    const count = item.countKey && counts ? counts[item.countKey] : undefined;
    const attention = item.attentionKey && counts ? counts[item.attentionKey] : 0;
    const checkAttention = item.checkKey && counts ? counts[item.checkKey] : 0;
    const showCount = typeof count === "number" && count > 0;

    return (
      <Link
        href={item.href}
        title={item.label}
        {...linkProps}
        className={cn(
          "group relative flex items-center rounded-xl text-[14px] font-medium tracking-[-0.005em] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] lg:text-[13px] lg:rounded-lg",
          // Ruimere tap-target op telefoon/tablet, strakker op desktop.
          effectiveCollapsed
            ? "justify-center p-2.5"
            : "gap-3 px-3 py-2.5 lg:py-2",
          isActive
            ? "bg-gradient-to-b from-card to-card/80 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(255,255,255,0.7)_inset] ring-1 ring-border/40 dark:from-card/[0.08] dark:to-card/[0.04] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] dark:ring-white/[0.06]"
            : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground active:scale-[0.98] dark:hover:bg-card/[0.05]",
        )}
      >
        {/* Active indicator: subtle vertical bar that slides in. */}
        {isActive && !effectiveCollapsed && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-x-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-foreground/90 to-foreground/60 dark:from-card dark:to-card/60"
          />
        )}
        <span
          className={cn(
            "icon-pop relative shrink-0 transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground",
          )}
        >
          {item.icon}
          {/* Attention dot — small red signal in the icon corner when
              urgent items exist. Visible in both expanded and collapsed
              modes; that's the whole point of a status indicator. */}
          {attention > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-card dark:ring-sidebar" />
            </span>
          )}
          {/* Check dot — amber signal when repairs are waiting for admin
              review (ready_for_check), positioned bottom-right. */}
          {checkAttention > 0 && attention <= 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-card dark:ring-sidebar" />
            </span>
          )}
          {checkAttention > 0 && attention > 0 && (
            <span
              aria-hidden
              className="absolute -left-0.5 -bottom-0.5 flex h-2 w-2 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 ring-2 ring-card dark:ring-sidebar" />
            </span>
          )}
        </span>
        {!effectiveCollapsed && (
          <>
            <span className="flex items-center gap-1.5">
              {item.label}
              {item.external && <ExternalLink className="h-3 w-3 opacity-50" />}
            </span>
            {showCount && (
              <span
                className={cn(
                  "ml-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums ring-1 transition-colors",
                  isActive
                    ? "bg-foreground/10 text-foreground ring-border/40 dark:bg-foreground/[0.08] dark:ring-white/[0.06]"
                    : "bg-background/80 text-muted-foreground ring-border/40 group-hover:bg-foreground/[0.06] group-hover:text-foreground dark:bg-card/[0.04] dark:ring-white/[0.04]",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </>
        )}
        {effectiveCollapsed && isLg && (
          <span className="pointer-events-none absolute left-full z-50 ml-3 inline-flex items-center gap-1.5 -translate-x-1 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-foreground/10 transition-all delay-75 duration-150 group-hover:translate-x-0 group-hover:opacity-100">
            {item.label}
            {showCount && (
              <span className="rounded-full bg-background/15 px-1.5 py-0 font-mono text-[10px] tabular-nums">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-[35] bg-foreground/30 backdrop-blur-[6px] lg:hidden animate-[fadeIn_220ms_ease-out]"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border/50 bg-gradient-to-b from-secondary/85 via-secondary/75 to-secondary/65 backdrop-blur-xl transition-[transform,width,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:from-sidebar dark:via-sidebar/95 dark:to-sidebar/90",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "lg:translate-x-0",
          effectiveCollapsed ? "w-60 lg:w-[60px]" : "w-60 lg:w-60",
          effectiveCollapsed
            ? "lg:shadow-none"
            : "shadow-[0_20px_40px_-16px_rgba(0,0,0,0.20)] lg:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] dark:lg:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-end border-b border-border/50 transition-all duration-300",
            effectiveCollapsed ? "h-16 px-2 lg:h-16" : "px-4 pb-4 pt-2 sm:pt-3",
          )}
          style={
            effectiveCollapsed
              ? undefined
              : { paddingTop: "max(12px, calc(env(safe-area-inset-top) + 8px))" }
          }
        >
          {/*
            The logo source is a pure-black silhouette on a transparent background.
            For dark mode we invert it via CSS so it renders as a clean white mark
            without needing a separate asset (and without a hard-coded recolor that
            could miss future logo updates).
          */}
          <Image
            src="/favicon.png"
            alt="Logo"
            width={effectiveCollapsed ? 44 : 160}
            height={effectiveCollapsed ? 30 : 112}
            className="object-contain transition-all duration-300 dark:invert"
            priority
          />
          {!effectiveCollapsed && (
            <div className="mt-1 flex flex-col items-center">
              <p className="text-[12px] font-semibold tracking-[-0.005em] text-foreground/90">
                Caravanstalling Spanje
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
                Repair panel
              </p>
            </div>
          )}
        </div>

        <nav
          className={cn(
            "flex-1 space-y-0.5 overflow-y-auto overscroll-contain py-3 transition-all duration-300",
            effectiveCollapsed ? "px-1.5 lg:px-1.5" : "px-3",
          )}
        >
          {(() => {
            let lastGroup: string | undefined;
            return mainItems.map((item) => {
              const showGroup = !effectiveCollapsed && item.group && item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.href}>
                  {showGroup && (
                    <p
                      className={cn(
                        "mb-1 mt-4 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60",
                        effectiveCollapsed ? "hidden" : "",
                      )}
                    >
                      <span>{item.group}</span>
                      <span aria-hidden className="h-px flex-1 bg-border/50" />
                    </p>
                  )}
                  <NavLink item={item} />
                </div>
              );
            });
          })()}
        </nav>

        <div
          className={cn(
            "space-y-0.5 border-t border-border/50 py-2",
            effectiveCollapsed ? "px-1.5 lg:px-1.5" : "px-3",
          )}
          style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        >
          {bottomItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
          {isLg ? (
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "flex w-full items-center rounded-lg text-muted-foreground/80 transition-all hover:bg-foreground/[0.04] hover:text-foreground active:scale-[0.98]",
                effectiveCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
              )}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronsLeft className="h-4 w-4" />
                  <span className="text-[13px] font-medium">Collapse</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-all hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <ChevronsLeft className="h-4 w-4" />
              Close menu
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
