"use client";

import { SmartSuggestions, type Suggestion } from "@/components/smart-suggestions";

interface DashboardSuggestionsProps {
  data: {
    completedNoInvoice: number;
    noEstimate: number;
    stale: number;
    unassignedUrgent: number;
    noCustomer: number;
    draftInvoices: number;
    waitingApproval: number;
    waitingParts: number;
    blockedRepairs: number;
    noResponseFollowUp: number;
    quoteNoInvoice: number;
    overdueRepairs: number;
  };
}

export function DashboardSuggestions({ data }: DashboardSuggestionsProps) {
  const suggestions: Suggestion[] = [];

  // Critical: overdue repairs
  if (data.overdueRepairs > 0) {
    suggestions.push({
      id: "overdue",
      level: "warning",
      title: `${data.overdueRepairs} repair${data.overdueRepairs !== 1 ? "s" : ""} past due date`,
      description: "These repairs have passed their deadline. Prioritize or reschedule.",
      href: "/repairs?sort=dueDate&dir=asc",
    });
  }

  // Revenue: completed not invoiced
  if (data.completedNoInvoice > 0) {
    suggestions.push({
      id: "completed-no-invoice",
      level: "action",
      title: `${data.completedNoInvoice} completed repair${data.completedNoInvoice !== 1 ? "s" : ""} not invoiced`,
      description: "Create invoices in Holded for completed work to get paid faster.",
      href: "/repairs?status=completed&invoiceStatus=not_invoiced",
    });
  }

  // Revenue: draft invoices not sent
  if (data.draftInvoices > 0) {
    suggestions.push({
      id: "draft-invoices",
      level: "action",
      title: `${data.draftInvoices} draft invoice${data.draftInvoices !== 1 ? "s" : ""} ready to send`,
      description: "Review and send draft invoices to customers.",
      href: "/repairs?invoiceStatus=draft",
    });
  }

  // Blocked pipeline
  if (data.blockedRepairs > 0) {
    suggestions.push({
      id: "blocked",
      level: "warning",
      title: `${data.blockedRepairs} repair${data.blockedRepairs !== 1 ? "s" : ""} blocked`,
      description: "Unblock these to keep your pipeline moving.",
      href: "/repairs?status=blocked",
    });
  }

  if (data.unassignedUrgent > 0) {
    suggestions.push({
      id: "unassigned-urgent",
      level: "warning",
      title: `${data.unassignedUrgent} urgent/high repair${data.unassignedUrgent !== 1 ? "s" : ""} unassigned`,
      description: "Assign someone to handle these priority repairs.",
      href: "/repairs?priority=urgent",
    });
  }

  // Customer communication
  if (data.noResponseFollowUp > 0) {
    suggestions.push({
      id: "no-response",
      level: "action",
      title: `${data.noResponseFollowUp} customer${data.noResponseFollowUp !== 1 ? "s" : ""} not responding`,
      description: "Follow up — these customers haven't responded.",
      href: "/repairs?customerResponseStatus=no_response",
    });
  }

  if (data.waitingApproval > 0) {
    suggestions.push({
      id: "waiting-approval",
      level: "action",
      title: `${data.waitingApproval} quote${data.waitingApproval !== 1 ? "s" : ""} waiting for approval (3+ days)`,
      description: "Check in with customers about pending quotes.",
      href: "/repairs?status=waiting_approval",
    });
  }

  // Pipeline health
  if (data.waitingParts > 0) {
    suggestions.push({
      id: "waiting-parts",
      level: "info",
      title: `${data.waitingParts} repair${data.waitingParts !== 1 ? "s" : ""} waiting for parts`,
      description: "Check if parts have arrived or need to be ordered.",
      href: "/repairs?status=waiting_parts",
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

  // All clear!
  if (suggestions.length === 0) {
    suggestions.push({
      id: "all-clear",
      level: "success",
      title: "All caught up!",
      description: "No urgent actions needed. Great work keeping everything on track.",
    });
  }

  return <SmartSuggestions suggestions={suggestions} maxVisible={8} />;
}
