import { Check, Sparkles, Compass } from "lucide-react";

/** Edit these arrays to update shipped work and the roadmap (single source in code). */
const RELEASES: { period: string; title: string; items: string[] }[] = [
  {
    period: "Apr 2026",
    title: "Panel & mobile",
    items: [
      "Parts, invoices (quotes & overdue), and Feedback tuned for phone and tablet — touch targets, card layouts, scrollable tabs.",
      "Invoices: clearer Holded + repair links; follow-up and uninvoiced quotes easier to act on from small screens.",
      "Feedback uses the same card shell and responsive layout as other dashboard areas.",
    ],
  },
  {
    period: "Apr 2026",
    title: "Repairs & customer contact",
    items: [
      "New customer response: “No reply expected” (`reply_not_required`) — use with “waiting for contact” when no client answer is needed; excluded from follow-up / no-response lists. Requires DB migration `0023_customer-response-reply-not-required.sql`.",
    ],
  },
];

const ROADMAP: { title: string; hint: string }[] = [
  {
    title: "Dashboard & navigation",
    hint: "Optional: collapsible sidebar / drawer on mobile (similar to Vercel), quicker access to saved filters.",
  },
  {
    title: "Richer feedback",
    hint: "Voting on ideas, tags, or a link to Linear/Jira — if the team wants it.",
  },
  {
    title: "Notifications",
    hint: "Browser or email when an admin replies to your feedback item.",
  },
];

export function FeedbackProductUpdates() {
  return (
    <section
      className="rounded-2xl border border-border/60 bg-gradient-to-b from-cyan-500/[0.04] via-background to-muted/20 px-4 py-5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04] sm:px-6 sm:py-6"
      aria-labelledby="product-updates-heading"
    >
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Product</p>
          <h2 id="product-updates-heading" className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            What&apos;s changing
          </h2>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground sm:text-right">
          Short release notes and future direction. Shipped items are maintained here — use{" "}
          <span className="font-medium text-foreground">New</span> below for one-off requests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="rounded-xl border border-border/50 bg-card/90 p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-card/70 dark:shadow-none sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Shipped &amp; improved</h3>
              <p className="text-xs text-muted-foreground">Live in this panel</p>
            </div>
          </div>
          <ul className="space-y-4">
            {RELEASES.map((release) => (
              <li
                key={`${release.period}-${release.title}`}
                className="relative border-l-[3px] border-cyan-500/70 pl-4 dark:border-cyan-400/45"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                    {release.period}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{release.title}</span>
                </div>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  {release.items.map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/90 p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-card/70 dark:shadow-none sm:p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300">
              <Compass className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">On the roadmap</h3>
              <p className="text-xs text-muted-foreground">Not committed — direction only</p>
            </div>
          </div>
          <ul className="space-y-3">
            {ROADMAP.map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-dashed border-indigo-500/15 bg-indigo-500/[0.03] px-3 py-3 dark:border-indigo-400/20 dark:bg-indigo-500/[0.06] sm:px-4"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.hint}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
