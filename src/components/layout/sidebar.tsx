"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  FileText,
  Trash2,
} from "lucide-react";
import type { UserRole } from "@/types";
import { hasMinRole } from "@/lib/auth-utils";
import { useSidebar } from "./sidebar-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  minRole?: UserRole;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { label: "Repairs", href: "/repairs", icon: <Wrench className="h-[18px] w-[18px]" /> },
  { label: "Bin", href: "/repairs/bin", icon: <Trash2 className="h-[18px] w-[18px]" /> },
  { label: "Contacts", href: "/customers", icon: <Users className="h-[18px] w-[18px]" /> },
  { label: "Units", href: "/units", icon: <Truck className="h-[18px] w-[18px]" /> },
  { label: "Parts", href: "/parts", icon: <Package className="h-[18px] w-[18px]" /> },
  { label: "Invoices", href: "/invoices", icon: <Receipt className="h-[18px] w-[18px]" /> },
  { label: "Quotes", href: "/invoices?tab=quotes", icon: <FileText className="h-[18px] w-[18px]" /> },
  { label: "Feedback", href: "/feedback", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-[18px] w-[18px]" />, minRole: "admin" },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { collapsed, setCollapsed } = useSidebar();

  const filteredItems = navItems.filter(
    (item) => !item.minRole || hasMinRole(userRole, item.minRole)
  );

  function NavLink({ item }: { item: NavItem }) {
    const [hrefPath, hrefQuery] = item.href.split("?");
    const hrefParams = new URLSearchParams(hrefQuery ?? "");
    let isActive: boolean;
    if (hrefPath === "/") {
      isActive = pathname === "/";
    } else if (hrefQuery) {
      // Match path AND specific query param (e.g. /invoices?tab=quotes)
      isActive = pathname.startsWith(hrefPath) && [...hrefParams.entries()].every(([k, v]) => searchParams.get(k) === v);
    } else {
      // Match path but NOT if a sibling has the same path with a query param that matches
      isActive = pathname.startsWith(hrefPath) && !navItems.some(
        (other) => other !== item && other.href.startsWith(hrefPath + "?") && (() => {
          const oParams = new URLSearchParams(other.href.split("?")[1] ?? "");
          return [...oParams.entries()].every(([k, v]) => searchParams.get(k) === v);
        })()
      );
    }

    return (
      <Link
        href={item.href}
        title={item.label}
        className={cn(
          "group relative flex items-center rounded-lg text-[13px] font-medium transition-all duration-200",
          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-white/10 text-white shadow-sm shadow-black/10"
            : "text-white/60 hover:bg-white/[0.06] hover:text-white/90 active:scale-[0.98]"
        )}
      >
        <span className={cn("shrink-0 transition-colors", isActive ? "text-white" : "text-white/50 group-hover:text-white/80")}>{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
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
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[oklch(0.16_0.025_260)] transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-60"
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
        {filteredItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="border-t border-white/10 px-2 py-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-white/40 transition-all hover:bg-white/[0.06] hover:text-white/70"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
