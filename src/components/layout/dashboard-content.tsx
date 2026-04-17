"use client";

import type { ReactNode } from "react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

export function DashboardContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col transition-[padding] duration-300 ease-in-out",
        "pl-0",
        "lg:pl-[60px]",
        !collapsed && "lg:pl-60"
      )}
    >
      {children}
    </div>
  );
}
