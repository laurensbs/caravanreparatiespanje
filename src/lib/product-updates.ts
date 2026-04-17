/**
 * Changelog for the Feedback page (plain English).
 * Add a new object at the top when you ship something users will notice.
 * `date`: YYYY-MM-DD
 */

export type ProductUpdate = {
  id: string;
  date: string;
  title: string;
  bullets: string[];
};

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "holded-customer-resolve-2026-04",
    date: "2026-04-17",
    title: "Holded invoices & quotes link more reliably",
    bullets: [
      "If a customer had no Holded contact ID in our system, automatic invoice discovery skipped them entirely.",
      "The sync job can now resolve the Holded contact by email or name and backfill the contact ID when it is safe (single match).",
      "Invoice search text also uses the Holded contact name, so matching by title or description works more often.",
    ],
  },
  {
    id: "feedback-header-nav-2026-04",
    date: "2026-04-17",
    title: "Feedback & Audit in the top bar",
    bullets: [
      "Feedback and Audit moved to the header so the sidebar stays focused on day-to-day work.",
      "On phones and tablets you still reach them from the icons next to search — no need to open the side menu for those two.",
    ],
  },
  {
    id: "mobile-nav-dashboard-2026-04",
    date: "2026-04-17",
    title: "Better layout on phone and tablet",
    bullets: [
      "The menu button opens the full navigation drawer; the main content uses the full width on small screens.",
      "Dashboard status chips scroll horizontally when they do not fit; recent activity stacks more cleanly on narrow screens.",
    ],
  },
  {
    id: "customer-reply-not-required",
    date: "2026-04-10",
    title: "Customer response: “No reply expected”",
    bullets: [
      "Use when you are waiting on the customer but do not need a reply for this job.",
      "Those jobs stay out of follow-up and “no response” lists.",
    ],
  },
  {
    id: "feedback-unread-dot",
    date: "2026-04-08",
    title: "Unread reply indicator",
    bullets: [
      "When a manager replies to your feedback, a dot appears on the Feedback icon in the header until you open the Feedback page.",
    ],
  },
];

export function countProductUpdateBullets(updates: ProductUpdate[]): number {
  return updates.reduce((n, u) => n + u.bullets.length, 0);
}
