"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    // Expand on large screens by default
    const mql = window.matchMedia("(min-width: 1024px)");
    setCollapsed(!mql.matches);
    const handler = (e: MediaQueryListEvent) => setCollapsed(!e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
