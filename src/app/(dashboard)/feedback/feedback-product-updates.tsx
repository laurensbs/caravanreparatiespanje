import Link from "next/link";
import { Check, Sparkles, History, ArrowDown } from "lucide-react";
import { PRODUCT_UPDATES, countProductUpdateBullets } from "@/lib/product-updates";

export interface FeedbackProductUpdatesProps {
  openRequestCount: number;
  doneRequestCount: number;
}

function formatUpdateDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Hero + changelog. We deliberately dropped the duplicate metric tiles
 * (Open / Resolved / Shipped) — those numbers already live in the page
 * header, and repeating them here just doubled the visual weight of an
 * intro that should fade behind the timeline. The page now reads:
 * compact intro → timeline → open/resolved list → new request CTA.
 */
export function FeedbackProductUpdates({
  openRequestCount: _open,
  doneRequestCount: _done,
}: FeedbackProductUpdatesProps) {
  const sorted = [...PRODUCT_UPDATES].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const bulletTotal = countProductUpdateBullets(PRODUCT_UPDATES);
  const latest = sorted[0];

  // Group consecutive updates that share a date so the timeline reads
  // like a journal entry: one date header, multiple shipped items
  // beneath it. Keeps the eye anchored to the date column.
  const grouped: { date: string; items: typeof sorted }[] = [];
  for (const u of sorted) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === u.date) {
      last.items.push(u);
    } else {
      grouped.push({ date: u.date, items: [u] });
    }
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_24px_48px_-24px_rgba(0,0,0,0.6)]"
      aria-labelledby="product-updates-heading"
    >
      {/* Hero — compacter dan voorheen. Geen tegels rechts meer; die
          herhaalden de page-header. Eén tagline, één CTA. */}
      <div className="relative overflow-hidden border-b border-border/40 px-5 py-6 sm:px-7 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(700px 280px at 10% -10%, oklch(0.72 0.13 60 / 0.16), transparent 55%), radial-gradient(560px 240px at 95% 10%, oklch(0.55 0.18 35 / 0.10), transparent 55%)",
          }}
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" aria-hidden />
              What&apos;s new
            </div>
            <h2
              id="product-updates-heading"
              className="mt-2 text-balance text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[26px]"
            >
              Recent improvements
            </h2>
            <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Everything below is live in the app right now.{" "}
              <span className="text-foreground/80">{bulletTotal} shipped</span>
              {latest ? (
                <>
                  {" "}· last release{" "}
                  <span className="font-medium text-foreground">
                    {formatUpdateDate(latest.date)}
                  </span>
                </>
              ) : null}
              .
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="#feedback-form"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-background/70 px-3.5 text-sm font-medium text-foreground/85 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-background hover:text-foreground hover:shadow-md"
            >
              Missing something?
              <ArrowDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Changelog ------------------------------------------------------- */}
      <div className="px-4 py-6 sm:px-8 sm:py-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background shadow-sm">
            <History className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
              Release timeline
            </h3>
            <p className="text-xs text-muted-foreground">Newest first</p>
          </div>
        </div>

        <ol className="relative space-y-9 pl-6 sm:pl-8">
          <span
            aria-hidden
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-border/0 via-border to-border/0 sm:left-[11px]"
          />

          {grouped.map((group) => (
            <li key={group.date} className="relative">
              <span
                aria-hidden
                className="absolute -left-6 top-1.5 flex h-3.5 w-3.5 items-center justify-center sm:-left-8"
              >
                <span className="absolute h-3.5 w-3.5 animate-ping rounded-full bg-amber-500/30 [animation-duration:2.4s]" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-background dark:bg-amber-400" />
              </span>

              <time
                dateTime={group.date}
                className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground"
              >
                {formatUpdateDate(group.date)}
              </time>

              <div className="mt-3 space-y-5">
                {group.items.map((update) => (
                  <article key={update.id} className="group/u">
                    <h4 className="text-[15px] font-semibold leading-snug tracking-[-0.005em] text-foreground">
                      {update.title}
                    </h4>
                    <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-muted-foreground">
                      {update.bullets.map((line, j) => (
                        <li
                          key={`${update.id}-${j}`}
                          className="flex gap-2.5 transition-colors group-hover/u:text-foreground/90"
                        >
                          <Check
                            className="mt-[3px] h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-hidden
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
