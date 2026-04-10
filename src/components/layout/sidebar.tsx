"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Truck,
  Settings,
  MessageSquare,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Receipt,
  Trash2,
  CalendarDays,
  Warehouse,
  ExternalLink,
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
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { label: "Repairs", href: "/repairs", icon: <Wrench className="h-[18px] w-[18px]" /> },
  { label: "Planning", href: "/planning", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
  { label: "Contacts", href: "/customers", icon: <Users className="h-[18px] w-[18px]" /> },
  { label: "Units", href: "/units", icon: <Truck className="h-[18px] w-[18px]" /> },
  { label: "Parts", href: "/parts", icon: <Package className="h-[18px] w-[18px]" /> },
  { label: "Quotes / Invoices", href: "/invoices", icon: <Receipt className="h-[18px] w-[18px]" /> },
  { label: "Feedback", href: "/feedback", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
  { label: "Garage", href: "/garage", icon: <Warehouse className="h-[18px] w-[18px]" />, external: true },
  { label: "Settings", href: "/settings", icon: <Settings className="h-[18px] w-[18px]" />, minRole: "admin" },
  { label: "Bin", href: "/repairs/bin", icon: <Trash2 className="h-[18px] w-[18px]" />, bottom: true },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();

  // Hover expand/collapse (desktop only)
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
    if (!supportsHover.current) return;
    if (leaveTimeout.current) clearTimeout(leaveTimeout.current);
    setCollapsed(false);
  }, [setCollapsed]);

  const handleMouseLeave = useCallback(() => {
    if (!supportsHover.current) return;
    leaveTimeout.current = setTimeout(() => setCollapsed(true), 200);
  }, [setCollapsed]);

  // Swipe gesture handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Only trigger on horizontal swipes (dx > 50px, dy < 30px)
    if (Math.abs(dx) > 50 && dy < 30) {
      if (dx < 0) setCollapsed(true);   // swipe left → collapse
      else setCollapsed(false);          // swipe right → expand
    }
  }, [setCollapsed]);

  const filteredItems = navItems.filter(
    (item) => !item.minRole || hasMinRole(userRole, item.minRole)
  );
  const mainItems = filteredItems.filter((item) => !item.bottom);
  const bottomItems = filteredItems.filter((item) => item.bottom);

  function NavLink({ item }: { item: NavItem }) {
    const isActive =
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href);

    const linkProps = item.external ? { target: "_blank", rel: "noopener" } : {};

    return (
      <Link
        href={item.href}
        title={item.label}
        {...linkProps}
        className={cn(
          "group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-200",
          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-white/10 text-white shadow-sm shadow-black/10"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white/90 active:scale-[0.98]"
        )}
      >
        <span className={cn("shrink-0 transition-colors", isActive ? "text-white" : "text-white/50 group-hover:text-white/80")}>{item.icon}</span>
        {!collapsed && (
          <span className="flex items-center gap-1.5">
            {item.label}
            {item.external && <ExternalLink className="h-3 w-3 opacity-50" />}
          </span>
        )}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-3 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lg z-50 whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 delay-75">
            {item.label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[oklch(0.16_0.025_260)] transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-60 shadow-2xl shadow-black/30"
      )}
    >
      <div className={cn(
        "flex items-center border-b border-white/10 transition-all duration-300",
        collapsed ? "h-12 justify-center px-2" : "h-12 gap-3 px-5"
      )}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 shrink-0">
          <Wrench className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <h1 className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">Caravan Repairs</h1>
          </div>
        )}
      </div>

      <nav className={cn(
        "flex-1 space-y-0.5 overflow-y-auto py-3 transition-all duration-300",
        collapsed ? "px-1.5" : "px-3"
      )}>
        {mainItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom items (Bin) + collapse toggle */}
      <div className={cn(
        "border-t border-white/10 py-2 space-y-0.5",
        collapsed ? "px-1.5" : "px-3"
      )}>
        {bottomItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center rounded-lg text-white/40 transition-all hover:bg-white/[0.06] hover:text-white/70",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
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
      </div>
    </aside>
  );
}
