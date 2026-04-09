"use client";

import type { ReactNode } from "react";

export function DashboardContent({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pl-[60px]">
      {children}
    </div>
  );
}
