"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getActiveReminders,
  getInboxBadgeSummary,
  completeReminder as completeReminderAction,
  dismissReminder as dismissReminderAction,
} from "@/actions/reminders";

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

export type AssistantTab = "inbox" | "assistant";

export type InboxItem = Awaited<ReturnType<typeof getActiveReminders>>[number];

export interface AssistantContextValue {
  // Page & repair context
  repairContext: RepairContext | null;
  setRepairContext: (ctx: RepairContext | null) => void;

  // Panel open state (replaces window event)
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  openWith: (tab: AssistantTab) => void;

  // Active tab
  tab: AssistantTab;
  setTab: (t: AssistantTab) => void;

  // Inbox (smart notifications)
  inboxItems: InboxItem[];
  inboxLoading: boolean;
  inboxBadgeCount: number;   // overdue count, capped at 9 (UI shows 9+ above that)
  inboxTotalCount: number;
  refreshInbox: () => Promise<void>;
  completeInboxItem: (id: string) => Promise<void>;
  dismissInboxItem: (id: string) => Promise<void>;

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
  openWith: () => {},
  tab: "inbox",
  setTab: () => {},
  inboxItems: [],
  inboxLoading: false,
  inboxBadgeCount: 0,
  inboxTotalCount: 0,
  refreshInbox: async () => {},
  completeInboxItem: async () => {},
  dismissInboxItem: async () => {},
  dispatchAction: () => {},
  registerActionHandler: () => {},
});

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [repairContext, setRepairContext] = useState<RepairContext | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AssistantTab>("inbox");
  const [actionHandler, setActionHandler] = useState<((a: AssistantAction) => void) | null>(null);

  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxBadgeCount, setInboxBadgeCount] = useState(0);
  const [inboxTotalCount, setInboxTotalCount] = useState(0);
  const inFlight = useRef(false);

  const toggle = useCallback(() => setOpen((p) => !p), []);

  const openWith = useCallback((nextTab: AssistantTab) => {
    setTab(nextTab);
    setOpen(true);
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const summary = await getInboxBadgeSummary();
      setInboxTotalCount(summary.total);
      setInboxBadgeCount(summary.overdue);
    } catch {
      // silent
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setInboxLoading(true);
    try {
      const data = await getActiveReminders();
      setInboxItems(data);
      const overdue = data.filter((r) => r.dueAt && new Date(r.dueAt).getTime() < Date.now()).length;
      setInboxTotalCount(data.length);
      setInboxBadgeCount(overdue);
    } catch {
      // silent
    } finally {
      setInboxLoading(false);
      inFlight.current = false;
    }
  }, []);

  // Initial badge load + periodic refresh.
  useEffect(() => {
    void refreshBadge();
    const interval = setInterval(() => void refreshBadge(), 60_000);
    return () => clearInterval(interval);
  }, [refreshBadge]);

  // Load full inbox when panel is opened to inbox tab.
  useEffect(() => {
    if (open && tab === "inbox") void refreshInbox();
  }, [open, tab, refreshInbox]);

  const completeInboxItem = useCallback(
    async (id: string) => {
      setInboxItems((prev) => prev.filter((r) => r.id !== id));
      setInboxTotalCount((c) => Math.max(0, c - 1));
      try {
        await completeReminderAction(id);
      } finally {
        void refreshBadge();
      }
    },
    [refreshBadge],
  );

  const dismissInboxItem = useCallback(
    async (id: string) => {
      setInboxItems((prev) => prev.filter((r) => r.id !== id));
      setInboxTotalCount((c) => Math.max(0, c - 1));
      try {
        await dismissReminderAction(id);
      } finally {
        void refreshBadge();
      }
    },
    [refreshBadge],
  );

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
        openWith,
        tab,
        setTab,
        inboxItems,
        inboxLoading,
        inboxBadgeCount,
        inboxTotalCount,
        refreshInbox,
        completeInboxItem,
        dismissInboxItem,
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
