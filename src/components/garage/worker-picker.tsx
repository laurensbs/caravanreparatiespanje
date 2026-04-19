"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useLanguage, type Language } from "./language-toggle";
import { getSelectableGarageUsers } from "@/lib/garage-workers";

export type WorkerOption = {
  id: string;
  name: string | null;
  role: string | null;
  preferredLanguage?: Language | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen technician when a tile is tapped. */
  onPick: (worker: WorkerOption) => void;
  workers: WorkerOption[];
  /** Optional title — defaults to "Who's starting this?" */
  title?: string;
  /** Show a small subtitle, e.g. "Beading repair · WR-XP-88" */
  subtitle?: string;
};

const PALETTE = [
  "from-sky-500/30 to-sky-500/10 ring-sky-400/30",
  "from-amber-500/30 to-amber-500/10 ring-amber-400/30",
  "from-emerald-500/30 to-emerald-500/10 ring-emerald-400/30",
  "from-fuchsia-500/30 to-fuchsia-500/10 ring-fuchsia-400/30",
  "from-rose-500/30 to-rose-500/10 ring-rose-400/30",
  "from-indigo-500/30 to-indigo-500/10 ring-indigo-400/30",
  "from-teal-500/30 to-teal-500/10 ring-teal-400/30",
  "from-orange-500/30 to-orange-500/10 ring-orange-400/30",
];

function colourFor(name: string | null | undefined): string {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const FLAG: Record<Language, string> = { en: "🇬🇧", es: "🇪🇸", nl: "🇳🇱" };

/**
 * Bottom-sheet "Who's about to do this?" picker. Used everywhere a
 * server action needs to know which technician is responsible (timer
 * start, etc.). The full-screen sheet with big tiles is intentional:
 * a glove-friendly tap target on a workshop iPad is the whole point.
 */
export function WorkerPicker({
  open,
  onClose,
  onPick,
  workers,
  title,
  subtitle,
}: Props) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  // Reset search when the sheet re-opens so the previous person's
  // half-typed query doesn't follow the next user around.
  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  // Lock body scroll while open so the sheet feels modal on iPad.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const visible = useMemo(() => {
    const filtered = getSelectableGarageUsers(workers).sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? ""),
    );
    if (!search.trim()) return filtered;
    const q = search.trim().toLowerCase();
    return filtered.filter((w) => (w.name ?? "").toLowerCase().includes(q));
  }, [workers, search]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-3xl bg-stone-900 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {title ?? t("Who is doing this?", "¿Quién lo va a hacer?", "Wie gaat dit doen?")}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/[0.08] active:bg-white/[0.15]"
            aria-label={t("Close", "Cerrar", "Sluiten")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {workers.length > 6 ? (
          <div className="px-5 pt-3">
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              placeholder={t("Search name…", "Buscar…", "Zoek naam…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl bg-white/[0.06] px-4 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          {visible.map((w) => {
            const lang = (w.preferredLanguage ?? "en") as Language;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  onPick(w);
                  onClose();
                }}
                className={`group flex aspect-square min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-br p-3 ring-1 transition-all duration-150 active:scale-[0.97] ${colourFor(w.name)}`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-xl font-semibold tracking-wide shadow-inner ring-1 ring-white/20">
                  {initialsFor(w.name)}
                </div>
                <div className="flex items-center gap-1.5 text-base font-medium text-white">
                  <span className="truncate max-w-[8rem]">{w.name ?? "—"}</span>
                  <span aria-hidden className="text-sm opacity-70">
                    {FLAG[lang]}
                  </span>
                </div>
              </button>
            );
          })}

          {visible.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-white/40">
              {t("No one matches.", "Nadie coincide.", "Geen overeenkomst.")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
