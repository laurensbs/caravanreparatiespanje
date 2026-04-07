"use client";

import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DashboardContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex flex-1 flex-col transition-all duration-300",
        collapsed ? "lg:pl-16" : "lg:pl-64"
      )}
    >
      {children}
    </div>
  );
}
