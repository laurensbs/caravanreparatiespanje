"use client";

import { SmartSuggestions, type Suggestion } from "@/components/smart-suggestions";

interface DashboardSuggestionsProps {
  data: {
    completedNoInvoice: number;
    noEstimate: number;
    stale: number;
    unassignedUrgent: number;
    noCustomer: number;
  };
}

export function DashboardSuggestions({ data }: DashboardSuggestionsProps) {
  const suggestions: Suggestion[] = [];

  if (data.completedNoInvoice > 0) {
    suggestions.push({
      id: "completed-no-invoice",
      level: "action",
      title: `${data.completedNoInvoice} completed repair${data.completedNoInvoice !== 1 ? "s" : ""} not invoiced`,
      description: "Create invoices in Holded for completed work.",
      href: "/repairs?status=completed&invoiceStatus=not_invoiced",
    });
  }

  if (data.unassignedUrgent > 0) {
    suggestions.push({
      id: "unassigned-urgent",
      level: "warning",
      title: `${data.unassignedUrgent} urgent/high priority repair${data.unassignedUrgent !== 1 ? "s" : ""} unassigned`,
      description: "Assign someone to handle these priority repairs.",
      href: "/repairs?priority=urgent",
    });
  }

  if (data.noEstimate > 0) {
    suggestions.push({
      id: "no-estimate",
      level: "action",
      title: `${data.noEstimate} active repair${data.noEstimate !== 1 ? "s" : ""} without cost estimate`,
      description: "Add cost estimates to in-progress repairs.",
      href: "/repairs?status=in_progress",
    });
  }

  if (data.stale > 0) {
    suggestions.push({
      id: "stale",
      level: "warning",
      title: `${data.stale} repair${data.stale !== 1 ? "s" : ""} stale for 2+ weeks`,
      description: "These repairs haven't been updated recently — check if still active.",
      href: "/repairs?sort=updatedAt&dir=asc",
    });
  }

  if (data.noCustomer > 0) {
    suggestions.push({
      id: "no-customer",
      level: "info",
      title: `${data.noCustomer} repair${data.noCustomer !== 1 ? "s" : ""} without a customer`,
      description: "Link customers for communication and invoicing.",
      href: "/repairs",
    });
  }

  return <SmartSuggestions suggestions={suggestions} />;
}
