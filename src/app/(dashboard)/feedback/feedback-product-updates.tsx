import Link from "next/link";
import { Check, Sparkles, Compass, Inbox, Rocket, Map, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_UPDATES, countProductUpdateBullets } from "@/lib/product-updates";

const ROADMAP: { title: string; hint: string }[] = [
  {
    title: "Email when someone replies",
    hint: "Optional email when a manager replies to your feedback — in addition to the in-app dot.",
  },
  {
    title: "Ideas voting or tags",
    hint: "If the team wants it: vote on ideas or tag requests.",
  },
  {
    title: "Saved filter sets",
    hint: "One-tap saved views on the repairs list for common filters.",
  },
];

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

export function FeedbackProductUpdates({ openRequestCount, doneRequestCount }: FeedbackProductUpdatesProps) {
  const sorted = [...PRODUCT_UPDATES].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const bulletTotal = countProductUpdateBullets(PRODUCT_UPDATES);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
      aria-labelledby="product-updates-heading"
    >
      <div className="relative border-b border-border/40 bg-gradient-to-br from-[#0CC0DF]/12 via-indigo-500/[0.08] to-transparent px-4 py-6 sm:px-6 sm:py-8 dark:from-[#0CC0DF]/10 dark:via-indigo-500/[0.12] dark:to-transparent">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(900px 280px at 20% -20%, rgba(12,192,223,0.25), transparent 55%), radial-gradient(700px 240px at 90% 0%, rgba(99,102,241,0.2), transparent 50%)",
          }}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-900/70 dark:text-cyan-200/80">
              Product
            </p>
            <h2 id="product-updates-heading" className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              What&apos;s new
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Shipped improvements in plain language. Scroll the timeline below for older updates. Your own requests are in{" "}
              <Link href="#feedback-queue" className="font-medium text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-300">
                Open requests
              </Link>
              .
            </p>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-2 sm:max-w-lg sm:gap-3 lg:w-auto lg:max-w-none lg:shrink-0">
            <MetricTile icon={Inbox} label="Open requests" value={openRequestCount} tone="cyan" delay="0ms" />
            <MetricTile icon={Check} label="Resolved" value={doneRequestCount} tone="indigo" delay="45ms" />
            <MetricTile icon={Rocket} label="Shipped bullets" value={bulletTotal} tone="slate" delay="90ms" />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-border/50">
        <div
          className="animate-slide-up border-b border-border/40 p-4 sm:p-6 lg:border-b-0"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/5 text-cyan-700 shadow-sm dark:from-cyan-400/20 dark:to-cyan-500/5 dark:text-cyan-200">
              <History className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Release timeline</h3>
              <p className="text-xs text-muted-foreground">Newest first — scroll for older updates</p>
            </div>
          </div>

          <div
            className={cn(
              "max-h-[min(32rem,65vh)] overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-muted/15 px-3 py-3 shadow-inner sm:px-4 sm:py-4",
              "[scrollbar-width:thin] [scrollbar-color:hsl(var(--muted-foreground)/0.35)_transparent]",
            )}
          >
            <ol className="space-y-6 pr-1">
              {sorted.map((update, i) => (
                <li
                  key={update.id}
                  className="animate-slide-up group relative border-b border-border/30 pb-6 last:border-b-0 last:pb-0"
                  style={{ animationDelay: `${100 + i * 30}ms`, animationFillMode: "backwards" }}
                >
                  <time
                    dateTime={update.date}
                    className="rounded-full bg-muted/90 px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground"
                  >
                    {formatUpdateDate(update.date)}
                  </time>
                  <p className="mt-2 text-sm font-semibold text-foreground">{update.title}</p>
                  <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {update.bullets.map((line, j) => (
                      <li key={`${update.id}-${j}`} className="flex gap-2.5 transition-colors group-hover:text-foreground/90">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" aria-hidden />
            <p>
              Missing something? Start a{" "}
              <Link href="#feedback-queue" className="font-medium text-foreground underline-offset-2 hover:underline">
                new request
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="animate-slide-up p-4 sm:p-6" style={{ animationDelay: "100ms", animationFillMode: "backwards" }}>
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 text-indigo-700 shadow-sm dark:from-indigo-400/20 dark:to-violet-500/10 dark:text-indigo-200">
              <Compass className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">On the roadmap</h3>
              <p className="text-xs text-muted-foreground">Direction — not committed dates</p>
            </div>
          </div>
          <ul className="space-y-3">
            {ROADMAP.map((item, i) => (
              <li
                key={item.title}
                className="animate-slide-up rounded-xl border border-dashed border-indigo-500/20 bg-gradient-to-br from-indigo-500/[0.04] to-transparent px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5 dark:border-indigo-400/25 dark:from-indigo-500/[0.08] sm:px-4"
                style={{ animationDelay: `${140 + i * 50}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-start gap-2">
                  <Map className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500/70 dark:text-indigo-300/70" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.hint}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
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
  tone: "cyan" | "indigo" | "slate";
  delay: string;
}) {
  return (
    <div
      className={cn(
        "animate-scale-in rounded-xl border border-white/60 bg-white/80 px-2.5 py-3 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.06]",
        tone === "cyan" && "ring-1 ring-cyan-500/10",
        tone === "indigo" && "ring-1 ring-indigo-500/10",
        tone === "slate" && "ring-1 ring-black/5 dark:ring-white/10",
      )}
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      <Icon
        className={cn(
          "mx-auto mb-1 h-4 w-4",
          tone === "cyan" && "text-cyan-600 dark:text-cyan-400",
          tone === "indigo" && "text-indigo-600 dark:text-indigo-400",
          tone === "slate" && "text-muted-foreground",
        )}
        aria-hidden
      />
      <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
