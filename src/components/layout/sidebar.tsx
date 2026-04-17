"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Truck,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Receipt,
  Trash2,
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
            ? "bg-white text-gray-900 shadow-sm shadow-black/5"
            : "text-gray-500 hover:bg-white/60 hover:text-gray-900 active:scale-[0.98]"
        )}
      >
        <span className={cn("shrink-0 transition-colors", isActive ? "text-gray-900" : "text-gray-400 group-hover:text-gray-700")}>{item.icon}</span>
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
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#EDEEF0] transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-60 shadow-xl shadow-black/8"
      )}
    >
      <div className={cn(
        "flex items-center justify-center border-b border-gray-200 transition-all duration-300",
        collapsed ? "h-16 px-2" : "h-36 px-4"
      )}>
        <Image
          src="/favicon.png"
          alt="Logo"
          width={collapsed ? 44 : 220}
          height={collapsed ? 30 : 160}
          className="object-contain transition-all duration-300"
        />
      </div>

      <nav className={cn(
        "flex-1 space-y-0.5 overflow-y-auto py-3 transition-all duration-300",
        collapsed ? "px-1.5" : "px-3"
      )}>
        {(() => {
          let lastGroup: string | undefined;
          return mainItems.map((item) => {
            const showGroup = !collapsed && item.group && item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.href}>
                {showGroup && (
                  <p className={cn(
                    "text-[10px] font-semibold uppercase tracking-widest text-gray-400 mt-4 mb-1.5",
                    collapsed ? "hidden" : "px-3"
                  )}>
                    {item.group}
                  </p>
                )}
                <NavLink item={item} />
              </div>
            );
          });
        })()}
      </nav>

      {/* Bottom items (Bin) + collapse toggle */}
      <div className={cn(
        "border-t border-gray-200 py-2 space-y-0.5",
        collapsed ? "px-1.5" : "px-3"
      )}>
        {bottomItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex w-full items-center rounded-lg text-gray-400 transition-all hover:bg-white/60 hover:text-gray-700",
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
