"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe, LogOut, Check } from "lucide-react";
import { hapticTap, hapticSuccess } from "@/lib/haptic";
import { useLanguage, type Language } from "@/components/garage/language-toggle";
import { useGarageMe, initials, type GarageMe } from "@/lib/garage-me";
import { garageLock } from "@/actions/garage-auth";
import { inferGarageLanguageFromWorkerName } from "@/lib/garage-lang-by-worker";

type Props = {
  open: boolean;
  onClose: () => void;
  users: { id: string; name: string | null; role: string | null }[];
};

const LANGS: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
  { code: "nl", flag: "🇳🇱", label: "NL" },
];

/**
 * Bottom sheet that handles the three shared-iPad questions in one place:
 *   1. "Who am I right now?" — pick a worker; pre-fills timers & haptics.
 *   2. "Switch language" — the flag of whoever is at the iPad right now.
 *   3. "Someone else is coming, lock this" — one-tap PIN lock.
 *
 * Opened by tapping the "Me" chip in the Today header.
 */
export function GarageMeSheet({ open, onClose, users }: Props) {
  const router = useRouter();
  const { t, lang, setGarageLangByUser } = useLanguage();
  const { me, setMe, clear } = useGarageMe();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function pickMe(user: { id: string; name: string | null }) {
    if (!user.name) return;
    hapticSuccess();
    const next: GarageMe = { id: user.id, name: user.name };
    setMe(next);
    const inferred = inferGarageLanguageFromWorkerName(user.name);
    if (inferred) setGarageLangByUser(inferred, null);
    onClose();
  }

  async function handleLock() {
    hapticTap();
    clear();
    await garageLock();
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="motion-safe:animate-slide-up mx-0 w-full max-w-md rounded-t-3xl border border-white/10 bg-gray-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:mx-4 sm:rounded-2xl sm:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 mt-2 h-1 w-10 rounded-full bg-white/10 sm:hidden" />

        <div className="px-5 pt-3 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">
            {t("Who is at the iPad?", "¿Quién está en el iPad?", "Wie is aan de iPad?")}
          </p>
        </div>

        {/* Worker grid */}
        <div className="grid grid-cols-3 gap-2 px-4 py-2 sm:grid-cols-4">
          {users.map((u) => {
            const active = me?.id === u.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => pickMe(u)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-white transition-all active:scale-[0.97] ${
                  active
                    ? "bg-teal-500/15 ring-1 ring-teal-400/40"
                    : "bg-white/[0.04] hover:bg-white/[0.07]"
                }`}
              >
                <span
                  className={`relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${
                    active
                      ? "bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_0_0_3px_rgba(20,184,166,0.25)]"
                      : "bg-gradient-to-br from-teal-500/40 to-teal-600/20"
                  }`}
                >
                  {initials(u.name ?? "?")}
                  {active ? (
                    <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-gray-900">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate text-[12px] font-semibold">
                  {u.name?.split(" ")[0] ?? "?"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Language row */}
        <div className="px-4 pt-2 pb-1">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">
            <Globe className="h-3 w-3" />
            {t("Language", "Idioma", "Taal")}
          </p>
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] p-1">
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setGarageLangByUser(l.code, null);
                  }}
                  className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/45 hover:text-white"
                  }`}
                >
                  <span className="text-base">{l.flag}</span>
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-col gap-2 px-4 pb-2">
          <button
            type="button"
            onClick={handleLock}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-500/15 text-sm font-semibold text-red-300 ring-1 ring-red-500/25 transition-all active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            {t("Lock iPad (PIN)", "Bloquear iPad (PIN)", "Vergrendel iPad (PIN)")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl text-[13px] font-medium text-white/55 transition-colors hover:bg-white/[0.04]"
          >
            {t("Close", "Cerrar", "Sluiten")}
          </button>
        </div>
      </div>
    </div>
  );
}
