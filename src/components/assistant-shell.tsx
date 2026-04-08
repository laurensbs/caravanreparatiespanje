"use client";

import { usePathname } from "next/navigation";
import { SmartAssistant, type AssistantPage } from "@/components/smart-assistant";
import { useAssistantContext } from "@/components/assistant-context";

function getPageFromPathname(pathname: string): AssistantPage {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/repairs/new")) return "repair-new";
  if (pathname.startsWith("/repairs/") && pathname.split("/").length >= 3) return "repair-detail";
  if (pathname.startsWith("/repairs")) return "repairs";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/units")) return "units";
  if (pathname.startsWith("/parts")) return "parts";
  if (pathname.startsWith("/invoices")) return "invoices";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

export function AssistantShell() {
  const pathname = usePathname();
  const { repairContext } = useAssistantContext();
  const page = getPageFromPathname(pathname);

  return (
    <SmartAssistant
      page={page}
      context={page === "repair-detail" ? repairContext ?? undefined : undefined}
    />
  );
}
