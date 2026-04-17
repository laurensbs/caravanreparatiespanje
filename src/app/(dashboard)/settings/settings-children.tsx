"use client";

import { usePathname } from "next/navigation";

export function SettingsChildren({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-safe:animate-slide-up pt-1">
      {children}
    </div>
  );
}
