"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Truck,
  FileSpreadsheet,
  Settings,
  Shield,
  Building2,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
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
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Repairs", href: "/repairs", icon: <Wrench className="h-5 w-5" /> },
  { label: "Customers", href: "/customers", icon: <Users className="h-5 w-5" /> },
  { label: "Units", href: "/units", icon: <Truck className="h-5 w-5" /> },
  { label: "Feedback", href: "/feedback", icon: <MessageSquare className="h-5 w-5" /> },
  { label: "Import", href: "/import", icon: <FileSpreadsheet className="h-5 w-5" />, minRole: "admin" },
  { label: "Audit Log", href: "/audit", icon: <Shield className="h-5 w-5" />, minRole: "admin" },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, minRole: "admin" },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, setCollapsed } = useSidebar();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const filteredItems = navItems.filter(
    (item) => !item.minRole || hasMinRole(userRole, item.minRole)
  );

  function NavLink({ item }: { item: NavItem }) {
    const isActive =
      item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href);

    return (
      <Link
        href={item.href}
        title={item.label}
        className={cn(
          "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150",
          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-primary/10 text-primary shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]"
        )}
      >
        <span className="shrink-0">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
        {/* Tooltip on collapsed */}
        {collapsed && (
          <span className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md border group-hover:block z-50 whitespace-nowrap">
            {item.label}
          </span>
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border bg-background shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar - always expanded */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r bg-card transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-6">
          <Wrench className="h-7 w-7 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight">Caravan Repairs</h1>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-md p-1.5 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {filteredItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
        <div className="border-t px-3 py-4">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Desktop sidebar - collapsible */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col border-r bg-card transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn(
          "flex h-16 items-center border-b transition-all duration-300",
          collapsed ? "justify-center px-2" : "gap-3 px-6"
        )}>
          <Wrench className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">Caravan Repairs</h1>
            </div>
          )}
        </div>

        <nav className={cn(
          "flex-1 space-y-1 overflow-y-auto py-4 transition-all duration-300",
          collapsed ? "px-2" : "px-3"
        )}>
          {filteredItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="border-t px-2 py-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    </>
  );
}
