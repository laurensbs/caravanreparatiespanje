import Link from "next/link";
import { Check, Sparkles, Inbox, Rocket, History, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_UPDATES, countProductUpdateBullets } from "@/lib/product-updates";

export interface FeedbackProductUpdatesProps {
  openRequestCount: number;
  doneRequestCount: number;
}

function formatUpdateDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Hero + changelog. The roadmap section was removed because it kept
 * drifting from how the team actually feels about the product. The
 * "new request" call-to-action now lives at the bottom of the page,
 * so this component focuses on celebrating what shipped.
 */
export function FeedbackProductUpdates({
  openRequestCount,
  doneRequestCount,
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
      {/* Hero ----------------------------------------------------------- */}
      <div className="relative overflow-hidden border-b border-border/40 px-5 py-8 sm:px-8 sm:py-12">
        {/* Layered gradient mesh — kept low-opacity so it never fights
            the type. Dark mode uses warmer ambers so the page glows
            instead of feeling cold. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(900px 360px at 12% -10%, oklch(0.72 0.13 60 / 0.18), transparent 55%), radial-gradient(700px 300px at 95% 10%, oklch(0.55 0.18 35 / 0.13), transparent 55%), radial-gradient(600px 280px at 60% 110%, oklch(0.20 0.005 75 / 0.10), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_70%,hsl(var(--background)/0.6))]"
        />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="animate-scale-in inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-400" aria-hidden />
              Product
            </div>
            <h2
              id="product-updates-heading"
              className="animate-slide-up mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl"
              style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
            >
              Wat is er nieuw
            </h2>
            <p
              className="animate-slide-up mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground"
              style={{ animationDelay: "100ms", animationFillMode: "backwards" }}
            >
              Wat we recent hebben verbeterd, in gewone taal. Alles wat hieronder staat zit nu live in de app.
              {latest ? (
                <>
                  {" "}Laatste release op{" "}
                  <span className="font-medium text-foreground">{formatUpdateDate(latest.date)}</span>.
                </>
              ) : null}
            </p>
            <div
              className="animate-slide-up mt-5 flex flex-wrap items-center gap-2"
              style={{ animationDelay: "140ms", animationFillMode: "backwards" }}
            >
              <Link
                href="#feedback-form"
                className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground/15 bg-background/70 px-4 text-sm font-medium text-foreground/85 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-background hover:text-foreground hover:shadow-md"
              >
                Mis je iets?
                <ArrowDown className="h-3.5 w-3.5 transition-transform group-hover:translate-y-0.5" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-2.5 sm:gap-3 lg:w-auto lg:max-w-none lg:shrink-0">
            <MetricTile icon={Inbox} label="Open" value={openRequestCount} tone="primary" delay="160ms" />
            <MetricTile icon={Check} label="Resolved" value={doneRequestCount} tone="emerald" delay="220ms" />
            <MetricTile icon={Rocket} label="Shipped" value={bulletTotal} tone="amber" delay="280ms" />
          </div>
        </div>
      </div>

      {/* Changelog ------------------------------------------------------- */}
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
            <History className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Release timeline</h3>
            <p className="text-xs text-muted-foreground">Nieuwste eerst</p>
          </div>
        </div>

        <ol className="relative space-y-10 pl-6 sm:pl-8">
          {/* Vertical rail */}
          <span
            aria-hidden
            className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-border/0 via-border to-border/0 sm:left-[11px]"
          />

          {grouped.map((group, gi) => (
            <li
              key={group.date}
              className="animate-slide-up relative"
              style={{ animationDelay: `${120 + gi * 60}ms`, animationFillMode: "backwards" }}
            >
              {/* Date dot */}
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

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
  delay,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber";
  delay: string;
}) {
  return (
    <div
      className={cn(
        "animate-scale-in group relative overflow-hidden rounded-2xl border border-border/50 bg-background/70 p-3 text-center backdrop-blur-md transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)]",
      )}
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          tone === "primary" && "bg-gradient-to-br from-foreground/[0.04] to-transparent",
          tone === "emerald" && "bg-gradient-to-br from-emerald-500/[0.10] to-transparent",
          tone === "amber" && "bg-gradient-to-br from-amber-500/[0.12] to-transparent",
        )}
      />
      <Icon
        className={cn(
          "relative mx-auto mb-1.5 h-4 w-4",
          tone === "primary" && "text-foreground/75",
          tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
        aria-hidden
      />
      <p className="relative font-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-foreground">
        {value}
      </p>
      <p className="relative mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
