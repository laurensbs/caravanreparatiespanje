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
}

const navItems: NavItem[] = [
  // OPERATIONS
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-[18px] w-[18px]" />, group: "Operations" },
  { label: "Work Orders", href: "/repairs", icon: <ClipboardList className="h-[18px] w-[18px]" />, group: "Operations" },
  { label: "Planning", href: "/planning", icon: <CalendarDays className="h-[18px] w-[18px]" />, group: "Operations" },
  { label: "Garage", href: "/api/garage-reset", icon: <Warehouse className="h-[18px] w-[18px]" />, group: "Operations" },
  // DATA
  { label: "Contacts", href: "/customers", icon: <Users className="h-[18px] w-[18px]" />, group: "Data" },
  { label: "Units", href: "/units", icon: <Truck className="h-[18px] w-[18px]" />, group: "Data" },
  { label: "Parts", href: "/parts", icon: <Package className="h-[18px] w-[18px]" />, group: "Data" },
  // FINANCE
  { label: "Quotes / Invoices", href: "/invoices", icon: <Receipt className="h-[18px] w-[18px]" />, group: "Finance" },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
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

    return (
      <Link
        href={item.href}
        title={item.label}
        {...linkProps}
        className={cn(
          "group relative flex items-center rounded-lg text-[13px] font-medium tracking-[-0.005em] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          effectiveCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
          isActive
            ? "bg-card text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.06),0_1px_0_0_rgba(255,255,255,0.6)_inset] dark:bg-white/[0.06] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] dark:ring-1 dark:ring-white/[0.04]"
            : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground active:scale-[0.98] dark:hover:bg-white/[0.04]",
        )}
      >
        {/* Active indicator: subtle vertical bar that slides in. */}
        {isActive && !effectiveCollapsed && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 h-4 w-[3px] -translate-x-1.5 -translate-y-1/2 rounded-full bg-foreground/80 dark:bg-white/70"
          />
        )}
        <span
          className={cn(
            "icon-pop shrink-0 transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground/80 group-hover:text-foreground",
          )}
        >
          {item.icon}
        </span>
        {!effectiveCollapsed && (
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.external && <ExternalLink className="h-3 w-3 opacity-50" />}
          </span>
        )}
        {effectiveCollapsed && isLg && (
          <span className="pointer-events-none absolute left-full z-50 ml-3 -translate-x-1 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] ring-1 ring-foreground/10 transition-all delay-75 duration-150 group-hover:translate-x-0 group-hover:opacity-100">
            {item.label}
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
          "fixed left-0 top-0 z-40 flex h-screen flex-col bg-secondary/80 backdrop-blur-md transition-[transform,width,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-sidebar/95 border-r border-border/50",
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "lg:translate-x-0",
          effectiveCollapsed ? "w-60 lg:w-[60px]" : "w-60 lg:w-60",
          effectiveCollapsed ? "lg:shadow-none" : "lg:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] dark:lg:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center border-b border-border/50 transition-all duration-300",
            effectiveCollapsed ? "h-16 px-2 lg:h-16" : "h-28 px-4 sm:h-32 lg:h-36",
          )}
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
            width={effectiveCollapsed ? 44 : 220}
            height={effectiveCollapsed ? 30 : 160}
            className="object-contain transition-all duration-300 dark:invert"
            priority
          />
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
                        "mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60",
                        effectiveCollapsed ? "hidden" : "",
                      )}
                    >
                      {item.group}
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
