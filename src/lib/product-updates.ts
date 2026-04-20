/**
 * Changelog for the Feedback page (plain English).
 * Add a new object at the top when you ship something users will notice.
 * `date`: YYYY-MM-DD
 *
 * Tone: write like you would tell a colleague at the coffee machine.
 * Skip jargon. One bullet = one thing the user will actually feel.
 */

export type ProductUpdate = {
  id: string;
  date: string;
  title: string;
  bullets: string[];
};

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "mobile-pwa-2026-04-19",
    date: "2026-04-19",
    title: "Feels like a real app on iPhone and iPad",
    bullets: [
      "The top bar on iPhone is no longer a clump of tiny icons — everything is properly tappable now (44 px tap target) and the less-used buttons live behind a single clear ⋯ menu.",
      "When you add the admin app to your home screen you get a real icon instead of a white square (no more 404 in the console).",
      "The garage tablet has its own ‘app’ with an amber icon, so the workshop can’t confuse it with the admin app on a shared device. Saving it from /garage opens straight into the garage shell.",
    ],
  },
  {
    id: "garage-presence-thread-2026-04-19",
    date: "2026-04-19",
    title: "Live chat with the garage per repair",
    bullets: [
      "‘Conversation with garage’ refreshes automatically every 8 seconds (and pauses when your tab is in the background). A new message from the workshop fires a toast and a blinking dot.",
      "Above the thread you can see live who is physically working on the vehicle right now, based on the active timer — e.g. ‘Jake is in the garage · 23m’.",
      "The separate ‘Pin a banner message’ block is gone: the latest thread message is automatically the banner. One place, no duplicate channels.",
    ],
  },
  {
    id: "first-login-password-2026-04-19",
    date: "2026-04-19",
    title: "First-time login: pick your own password",
    bullets: [
      "Admins (Jake, Johan, Noah) pick a new password on their first login without needing to know the old one. Same look and feel as the regular login.",
      "Workshop staff keep logging in with their PIN — they don’t have to reset anything.",
    ],
  },
  {
    id: "work-orders-overview-2026-04-19",
    date: "2026-04-19",
    title: "Work Orders: one clear focus bar at the top",
    bullets: [
      "The two separate rows of filter chips (date + status) are merged into one bar: ‘When | My work | Waiting on’.",
      "Each chip now shows how many jobs sit in that bucket — Today, This week, Overdue, In Garage, Waiting for Parts, etc.",
      "‘In Progress’ is now called ‘In Garage’, because that’s literally what it means: the vehicle is in the workshop.",
      "Chip colours match the status pills in the table itself — no more confusion about what amber or orange stands for.",
    ],
  },
  {
    id: "repair-client-vs-profile-2026-04-17",
    date: "2026-04-17",
    title: "Repairs: a single job vs the full client card",
    bullets: [
      "What went wrong in plain terms: the little pencil under ‘Customer’ edits the shared client card in your address book. Every repair pointing to that client therefore picked up the new name or phone number — not just that one job.",
      "That’s why changing ‘Carlos’ to ‘Naomi’ seemed to ripple everywhere: you were editing one client record that several repairs shared.",
      "Now the repair page has a clear button: ‘Use a different client for this repair only’. The pencil is clearly labelled as ‘edits the shared card’.",
    ],
  },
  {
    id: "holded-customer-resolve-2026-04-17",
    date: "2026-04-17",
    title: "Holded invoices and quotes link up more reliably",
    bullets: [
      "Customers without a Holded contact ID were previously skipped by the automatic invoice matcher.",
      "The sync now also looks by email or name and fills in the ID afterwards when there’s a single unambiguous match.",
      "The search text now also uses the Holded contact name, so matching by title or description works more often.",
    ],
  },
  {
    id: "feedback-header-nav-2026-04-17",
    date: "2026-04-17",
    title: "Feedback in the header, Audit under Settings",
    bullets: [
      "Feedback stays one tap away from the top bar; the audit log lives under Settings → Audit log (admins only).",
      "Old /audit links redirect to the new location automatically.",
    ],
  },
  {
    id: "mobile-nav-dashboard-2026-04-17",
    date: "2026-04-17",
    title: "Better overview on phone and tablet",
    bullets: [
      "The menu button opens the full navigation panel; content uses the full width on small screens.",
      "Status chips on the dashboard scroll horizontally when they don’t fit; recent activity stacks neatly on narrow screens.",
    ],
  },
  {
    id: "per-page-declutter-2026-04-18",
    date: "2026-04-18",
    title: "Cleaner pages: Work Orders, Planning, Contacts, Parts",
    bullets: [
      "Filter menus and modals nobody used were removed. Clicking in lists now takes you straight to the detail page.",
      "On the repair detail the sticky right rail is replaced by a calmer summary at the top.",
      "The dashboard now has a ‘today’ briefing card at the top and the sidebar counts live per category.",
    ],
  },
  {
    id: "smart-assistant-2026-04-18",
    date: "2026-04-18",
    title: "Smart Assistant and search improved",
    bullets: [
      "The assistant reveals topics progressively now — no more wall-of-grid.",
      "Inbox + assistant sit behind a single icon in the header (with a badge for urgent items and a neutral total).",
      "The command palette (⌘K) remembers recently used items so you can jump through faster.",
    ],
  },
  {
    id: "design-system-2026-04-18",
    date: "2026-04-18",
    title: "New visual style and typography",
    bullets: [
      "Geist Sans/Mono as the default font — tighter and more modern than before.",
      "Warm monochrome stone palette (no more cold cyan/blue) for a calmer, premium feel.",
      "Page transitions, spring physics on buttons and a subtle sound opt-in for optimistic UI.",
    ],
  },
  {
    id: "garage-shell-2026-04-18",
    date: "2026-04-18",
    title: "Garage shell sharpened for the iPad",
    bullets: [
      "The PIN screen is always stacked vertically — feels like a proper app.",
      "The /garage routes are locked down: even if a worker accidentally taps an admin link, they stay inside their own environment.",
      "Dark background throughout the garage flow for fewer distractions on a shared screen.",
    ],
  },
  {
    id: "login-redesign-2026-04-18",
    date: "2026-04-18",
    title: "Redesigned login screen",
    bullets: [
      "Tappable account tiles: pick who you are, type your password, done.",
      "Role names removed (no ‘admin/manager/staff’ labels on the login screen), soft cross-fade between steps, gentle shake on a wrong password.",
      "Idle timeout raised to 30 minutes so you don’t have to log back in all the time.",
    ],
  },
  {
    id: "customer-reply-not-required-2026-04-10",
    date: "2026-04-10",
    title: "Customer response: ‘No reply needed’",
    bullets: [
      "Use it when you’re waiting on the customer but don’t actually need a reply for this job.",
      "Those jobs stay out of follow-up and ‘no response’ lists.",
    ],
  },
  {
    id: "feedback-unread-dot-2026-04-08",
    date: "2026-04-08",
    title: "Unread dot for replies",
    bullets: [
      "When a manager replies to your feedback a red dot appears on the Feedback icon in the header until you open the page.",
    ],
  },
];

export function countProductUpdateBullets(updates: ProductUpdate[]): number {
  return updates.reduce((n, u) => n + u.bullets.length, 0);
}
