"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wrench,
  Users,
  Truck,
  MapPin,
  FileSpreadsheet,
  Settings,
  Shield,
  Package,
  Building2,
} from "lucide-react";
import type { UserRole } from "@/types";
import { hasMinRole } from "@/lib/auth-utils";

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
  { label: "Import", href: "/import", icon: <FileSpreadsheet className="h-5 w-5" />, minRole: "admin" },
  { label: "Audit Log", href: "/audit", icon: <Shield className="h-5 w-5" />, minRole: "admin" },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, minRole: "admin" },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.minRole || hasMinRole(userRole, item.minRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <Wrench className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-lg font-bold tracking-tight">Repair Admin</h1>
          <p className="text-[11px] text-muted-foreground">Caravan & Trailer Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {filteredItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
