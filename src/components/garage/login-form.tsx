"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { garageLogin } from "@/actions/garage-auth";
import Image from "next/image";
import { useLanguage } from "@/components/garage/language-toggle";
import { Delete } from "lucide-react";

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
    "relative flex aspect-square items-center justify-center rounded-full bg-white/[0.08] text-2xl font-medium text-white transition-all duration-150 hover:bg-white/[0.12] active:scale-95 active:bg-white/[0.2] disabled:opacity-40 sm:text-[1.75rem]";

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

      {/*
        App "frame" — we intentionally *always* stack vertically, on every
        screen. Side-by-side used to kick in on sm:landscape, but on a shared
        iPad in landscape (or on desktop Chrome in a normal aspect ratio) that
        made the keypad float off to the right which didn't feel native. We
        now mimic an iPhone / iPad passcode screen: title & dots on top,
        keypad directly below, one column.
      */}
      <div className="relative flex w-full max-w-sm flex-col items-center justify-center gap-8 px-5 py-8 sm:max-w-[380px] sm:gap-10 sm:py-10">
        {/* ── Branding + PIN dots ─────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] sm:h-20 sm:w-20 sm:rounded-3xl">
            <Image
              src="/favicon.png"
              alt="Reparatie Panel"
              width={48}
              height={48}
              className="h-9 w-9 object-contain invert sm:h-11 sm:w-11"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-white/95 sm:text-2xl">
            {t("Garage Portal", "Portal del Taller", "Garage Portaal")}
          </h1>
          <p className="mt-1.5 text-sm text-white/40 sm:text-base">
            {t("Enter PIN to continue", "Introduce el PIN", "Voer pincode in")}
          </p>

          <div
            className={`mt-7 flex gap-4 transition-transform sm:mt-8 sm:gap-5 ${
              shake ? "animate-[shake_0.4s_ease-in-out]" : ""
            }`}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-all duration-200 sm:h-4 sm:w-4 ${
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
            className={`mt-3 max-w-xs text-center text-sm font-medium text-red-400 transition-opacity duration-200 sm:text-base ${
              error ? "opacity-100" : "opacity-0"
            }`}
            aria-live="polite"
          >
            {error || "\u00A0"}
          </p>
        </div>

        {/* ── Numpad ──────────────────────────────────────────────────── */}
        <div className="w-full">
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
