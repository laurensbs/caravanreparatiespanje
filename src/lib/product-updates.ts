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
    id: "repair-client-vs-profile-2026-04",
    date: "2026-04-17",
    title: "Repairs: one job vs the whole client card",
    bullets: [
      "What went wrong in plain words: the small pencil under Customer edits the shared client in your address book. Every repair that still points at that client gets the new name or phone — it is not limited to the repair you had open.",
      "That is why changing “Carlos” to “Naomi” there looked like it moved every job: you were updating one client record that several repairs shared.",
      "Fix: on the repair page there is now a clear button, “Use a different client for this repair only”, which only switches this repair to another existing client (for example Naomi’s own card). The pencil is labelled as editing the shared card, with a short reminder in the panel.",
    ],
  },
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
    title: "Feedback in the header, Audit under Settings",
    bullets: [
      "Feedback stays one tap away in the top bar; the audit log lives under Settings → Audit log (admins).",
      "Old /audit links still redirect to the new location.",
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
