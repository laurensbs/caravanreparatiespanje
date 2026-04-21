import Link from "next/link";

/**
 * Tones zijn afgestemd op de status-pills in de tabel (zie STATUS_COLORS in
 * `src/types`). Zo herkent een werker dezelfde kleur op de chip én op de
 * pill een paar pixels lager. `solid` is de donker-op-licht variant die we
 * gebruiken voor de actieve "In Workshop"-status — staat tussen lichte chips
 * meteen op als ankerpunt.
 */
type Tone = "amber" | "orange" | "emerald" | "destructive" | "solid";
type Group = "when" | "mine" | "waiting";

export type FocusChip = {
  group: Group;
  key: string;
  label: string;
  /** `null` betekent "geen badge tonen" — handig voor toggles als "My work"
   *  waar een count geen extra info geeft. `0` toont juist wél een rustige
   *  nul, zodat een vaste anker-chip (bv. To Do) ook bij leegte zichtbaar
   *  blijft als ijkpunt. */
  count: number | null;
  href: string;
  isActive: boolean;
  tone?: Tone;
  /** Verberg de chip volledig zodra de count 0 is. Gebruikt voor
   *  "achtergrond"-statussen (Waiting for Parts, Quote Needed, Overdue)
   *  die alleen ruis worden zodra ze leeg zijn. */
  hideIfEmpty?: boolean;
};

interface Props {
  chips: FocusChip[];
  filters: { status?: string; dueWithin?: string; mine?: string };
}

export function RepairFocusBar({ chips }: Props) {
  // Filter de uit-te-laten chips er nu uit zodat we de scheidingsstreepjes
  // alleen tonen tussen blokken die ook werkelijk iets bevatten.
  const visible = chips.filter((c) => !(c.hideIfEmpty && (c.count ?? 0) === 0));

  // Group preserves order: when → mine → waiting.
  const order: Group[] = ["when", "mine", "waiting"];
  const grouped = order
    .map((g) => ({ group: g, items: visible.filter((c) => c.group === g) }))
    .filter((b) => b.items.length > 0);

  return (
    <div className="-mx-1 flex snap-x snap-mandatory items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
      {grouped.map((block, blockIdx) => (
        <div
          key={block.group}
          className="flex shrink-0 items-center gap-1.5 sm:shrink"
        >
          {blockIdx > 0 && (
            <span
              aria-hidden
              className="mx-1 hidden h-5 w-px shrink-0 bg-border/70 sm:block"
            />
          )}
          {block.items.map((chip) => (
            <FocusChipPill key={chip.key} chip={chip} />
          ))}
        </div>
      ))}
    </div>
  );
}

function FocusChipPill({ chip }: { chip: FocusChip }) {
  const { label, count, href, isActive, tone } = chip;
  const target = isActive ? "/repairs" : href;

  // De "solid" tone is altijd donker — ook als hij niet actief is — zodat
  // hij zich onderscheidt als anker voor de huidige werkstroom (In Workshop).
  // Bij actief krijgt hij dezelfde donkere kleur, dus de classes vallen samen.
  const baseChip =
    tone === "solid"
      ? "border-foreground/15 bg-foreground text-background shadow-[0_2px_8px_-2px_rgba(0,0,0,0.18)]"
      : isActive
        ? tone === "destructive"
          ? "border-red-300 bg-red-50 text-red-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
          : tone === "amber"
            ? "border-amber-300 bg-amber-50 text-amber-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
            : tone === "orange"
              ? "border-orange-300 bg-orange-50 text-orange-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200"
              : tone === "emerald"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10)] dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                : "border-foreground/20 bg-foreground text-background shadow-[0_2px_8px_-2px_rgba(0,0,0,0.18)]"
        : tone === "destructive"
          ? "border-border/60 bg-card text-red-700/80 hover:border-red-300/60 hover:text-red-700 dark:text-red-300/80 dark:hover:text-red-300"
          : tone === "amber"
            ? "border-border/60 bg-card text-amber-700/90 hover:border-amber-300/60 hover:text-amber-700 dark:text-amber-300/90 dark:hover:text-amber-300"
            : tone === "orange"
              ? "border-border/60 bg-card text-orange-700/90 hover:border-orange-300/60 hover:text-orange-700 dark:text-orange-300/90 dark:hover:text-orange-300"
              : tone === "emerald"
                ? "border-border/60 bg-card text-emerald-700/90 hover:border-emerald-300/60 hover:text-emerald-700 dark:text-emerald-300/90 dark:hover:text-emerald-300"
                : "border-border/60 bg-card text-muted-foreground hover:border-foreground/15 hover:text-foreground";

  // Badge volgt de chip-kleur. Voor "solid" zit hij altijd op een donkere
  // achtergrond, dus dan een lichte transparante badge die op zwart leest.
  const badge =
    tone === "solid"
      ? "bg-background/15 text-background"
      : isActive
        ? tone === "destructive"
          ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
          : tone === "amber"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
            : tone === "orange"
              ? "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200"
              : tone === "emerald"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                : "bg-background/15 text-background"
        : tone === "destructive"
          ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
          : tone === "amber"
            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
            : tone === "orange"
              ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
              : tone === "emerald"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-muted/60 text-foreground/70 dark:bg-foreground/10 dark:text-foreground/70";

  return (
    <Link href={target} className="shrink-0 snap-start touch-manipulation">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium tracking-[-0.005em] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px ${baseChip}`}
      >
        <span>{label}</span>
        {count !== null && (
          <span
            className={`tabular-nums rounded-full px-1.5 py-px text-[10.5px] leading-none ${badge}`}
          >
            {count}
          </span>
        )}
      </span>
    </Link>
  );
}
