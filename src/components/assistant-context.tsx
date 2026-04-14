"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────

export type AssistantPage =
  | "dashboard" | "repairs" | "repair-detail" | "repair-new"
  | "customers" | "parts" | "invoices" | "units" | "settings"
  | "planning" | "audit" | "feedback";

export interface RepairContext {
  job?: any;
  settings?: any;
}

/** Actions the assistant can request from the host page */
export type AssistantAction =
  | { type: "navigate"; href: string }
  | { type: "navigate-filter"; href: string; filters: Record<string, string> }
  | { type: "open-modal"; modal: "new-work-order"; prefill?: Record<string, string> }
  | { type: "open-command-palette" }
  | { type: "confirm"; message: string; onConfirm: () => void };

export interface AssistantContextValue {
  // Page & repair context
  repairContext: RepairContext | null;
  setRepairContext: (ctx: RepairContext | null) => void;

  // Panel open state (replaces window event)
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;

  // Action dispatch — host pages register a handler
  dispatchAction: (action: AssistantAction) => void;
  registerActionHandler: (handler: (action: AssistantAction) => void) => void;
}

const AssistantContext = createContext<AssistantContextValue>({
  repairContext: null,
  setRepairContext: () => {},
  open: false,
  setOpen: () => {},
  toggle: () => {},
  dispatchAction: () => {},
  registerActionHandler: () => {},
});

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [repairContext, setRepairContext] = useState<RepairContext | null>(null);
  const [open, setOpen] = useState(false);
  const [actionHandler, setActionHandler] = useState<((a: AssistantAction) => void) | null>(null);

  const toggle = useCallback(() => setOpen((p) => !p), []);

  const dispatchAction = useCallback(
    (action: AssistantAction) => {
      if (actionHandler) actionHandler(action);
    },
    [actionHandler],
  );

  const registerActionHandler = useCallback(
    (handler: (a: AssistantAction) => void) => {
      setActionHandler(() => handler);
    },
    [],
  );

  return (
    <AssistantContext.Provider
      value={{
        repairContext,
        setRepairContext,
        open,
        setOpen,
        toggle,
        dispatchAction,
        registerActionHandler,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistantContext() {
  return useContext(AssistantContext);
}
