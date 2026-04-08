"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AssistantContextValue {
  repairContext: any | null;
  setRepairContext: (ctx: any | null) => void;
}

const AssistantContext = createContext<AssistantContextValue>({
  repairContext: null,
  setRepairContext: () => {},
});

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [repairContext, setRepairContext] = useState<any | null>(null);
  return (
    <AssistantContext.Provider value={{ repairContext, setRepairContext }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  return useContext(AssistantContext);
}
