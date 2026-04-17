"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { garageLogin } from "@/actions/garage-auth";
import { useLanguage } from "@/components/garage/language-toggle";
import { Delete, Wrench } from "lucide-react";

const PIN_LENGTH = 4;

export function GarageLoginForm() {
  const router = useRouter();
  const { t, lang, setGarageLangByUser } = useLanguage();
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submitPin = useCallback(
    (pinValue: string) => {
      setError("");
      startTransition(async () => {
        const result = await garageLogin(pinValue);
        if (result.success) {
          router.refresh();
        } else {
          setError(t("Incorrect PIN", "PIN incorrecto", "Onjuiste pincode"));
          setShake(true);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([12, 80, 12, 80, 24]);
          }
          setTimeout(() => {
            setShake(false);
            setDigits([]);
          }, 500);
        }
      });
    },
    [router, t, startTransition]
  );

  function handleDigit(d: string) {
    if (isPending || digits.length >= PIN_LENGTH) return;
    const next = [...digits, d];
    setDigits(next);
    setError("");
    if (next.length === PIN_LENGTH) {
      submitPin(next.join(""));
    }
  }

  function handleDelete() {
    if (isPending) return;
    setDigits((prev) => prev.slice(0, -1));
    setError("");
  }

  const langs: { code: "en" | "es" | "nl"; flag: string }[] = [
    { code: "en", flag: "🇬🇧" },
    { code: "es", flag: "🇪🇸" },
    { code: "nl", flag: "🇳🇱" },
  ];

  const padBtn =
    "relative flex items-center justify-center aspect-square rounded-2xl bg-white/[0.08] text-2xl font-medium text-white transition-all active:scale-95 active:bg-white/[0.2] hover:bg-white/[0.12] disabled:opacity-40 sm:text-3xl md:text-[2rem]";

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white select-none"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Ambient gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/10 blur-3xl"
      />

      {/* Language toggle (top-right, overlaid) */}
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        {langs.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setGarageLangByUser(l.code, null)}
            className={`h-10 w-10 rounded-full text-base flex items-center justify-center transition-all ${
              lang === l.code
                ? "bg-white/20 ring-1 ring-white/40"
                : "bg-white/5 hover:bg-white/10"
            }`}
            aria-label={`Language ${l.code}`}
          >
            {l.flag}
          </button>
        ))}
      </div>

      {/* App "frame" — tablet-sized on desktop, flexible on phones. */}
      <div className="relative w-full h-full max-h-[calc(100dvh-2rem)] flex items-center justify-center px-4 py-6 sm:py-10">
        <div
          className={[
            "w-full h-full max-h-full flex flex-col",
            // Portrait-ish / narrow screens — stack vertically, centered.
            "items-center justify-center gap-8",
            // Tablet/desktop landscape — side-by-side inside a bounded card.
            "sm:landscape:flex-row sm:landscape:items-stretch sm:landscape:justify-center sm:landscape:gap-10 sm:landscape:p-8",
            "sm:landscape:max-w-3xl sm:landscape:max-h-[640px] sm:landscape:rounded-[2rem] sm:landscape:border sm:landscape:border-white/[0.06] sm:landscape:bg-white/[0.02] sm:landscape:backdrop-blur-xl sm:landscape:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]",
            // Vertical layout on narrow screens also benefits from a capped width on desktop portrait.
            "sm:max-w-sm sm:mx-auto",
          ].join(" ")}
        >
          {/* ── Branding + PIN dots ─────────────────────────────────────── */}
          <div className="flex flex-col items-center justify-center text-center sm:landscape:flex-1 sm:landscape:justify-center">
            <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5 sm:h-20 sm:w-20 sm:rounded-3xl">
              <Wrench className="h-8 w-8 text-white/80 sm:h-10 sm:w-10" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-white/90 sm:text-2xl">
              {t("Garage Portal", "Portal del Taller", "Garage Portaal")}
            </h1>
            <p className="text-sm text-white/40 mt-1.5 sm:text-base">
              {t("Enter PIN to continue", "Introduce el PIN", "Voer pincode in")}
            </p>

            <div
              className={`mt-8 flex gap-4 sm:mt-10 sm:gap-5 transition-transform ${
                shake ? "animate-[shake_0.4s_ease-in-out]" : ""
              }`}
            >
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full transition-all duration-200 sm:h-5 sm:w-5 ${
                    i < digits.length
                      ? error
                        ? "bg-red-400 scale-110"
                        : "bg-white scale-110"
                      : "bg-white/20"
                  }`}
                />
              ))}
            </div>
            <p
              className={`mt-4 text-center text-sm text-red-400 font-medium sm:text-base max-w-xs transition-opacity duration-200 ${
                error ? "opacity-100" : "opacity-0"
              }`}
              aria-live="polite"
            >
              {error || "\u00A0"}
            </p>
          </div>

          {/* ── Numpad ──────────────────────────────────────────────────── */}
          <div className="w-full max-w-[360px] sm:max-w-[400px] sm:landscape:flex-1 sm:landscape:max-w-[320px] sm:landscape:self-center">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleDigit(String(n))}
                  disabled={isPending}
                  className={padBtn}
                >
                  {n}
                </button>
              ))}
              {/* Empty slot to mirror Apple-style keypad (left of the 0). */}
              <div aria-hidden className="aspect-square" />
              <button
                type="button"
                onClick={() => handleDigit("0")}
                disabled={isPending}
                className={padBtn}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending || digits.length === 0}
                className={`${padBtn} text-white/70 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-white/[0.08]`}
                aria-label={t("Delete digit", "Borrar", "Wissen")}
              >
                <Delete className="h-7 w-7 sm:h-8 sm:w-8" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(12px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
