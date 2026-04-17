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
          setError(
            t("Incorrect PIN", "PIN incorrecto", "Onjuiste pincode")
          );
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

  const langs: { code: string; flag: string }[] = [
    { code: "en", flag: "🇬🇧" },
    { code: "es", flag: "🇪🇸" },
    { code: "nl", flag: "🇳🇱" },
  ];

  const padBtn =
    "rounded-2xl bg-white/[0.08] text-2xl font-medium text-white transition-all active:scale-95 active:bg-white/[0.15] hover:bg-white/[0.12] disabled:opacity-40 " +
    "h-[72px] min-h-[72px] w-full sm:h-[84px] sm:min-h-[84px] sm:text-3xl md:h-[92px] md:min-h-[92px] md:text-[2rem]";

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh flex-col bg-gray-950 text-white select-none landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-6 landscape:px-4 landscape:py-4 md:landscape:gap-16 md:landscape:px-10 lg:landscape:gap-24">
      {/* Language toggle */}
      <div className="absolute right-0 top-0 z-10 flex gap-2 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))]">
        {langs.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setGarageLangByUser(l.code as "en" | "es" | "nl", null)}
            className={`h-11 w-11 rounded-full text-lg flex items-center justify-center transition-all sm:h-12 sm:w-12 ${
              lang === l.code
                ? "bg-white/20 ring-1 ring-white/40"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {l.flag}
          </button>
        ))}
      </div>

      {/* Branding + PIN (left / top) */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-[max(5rem,env(safe-area-inset-top)+3rem)] landscape:min-w-0 landscape:flex-1 landscape:max-w-[min(100%,20rem)] landscape:justify-center landscape:px-4 landscape:pt-6 landscape:pb-6 md:landscape:max-w-md sm:pt-24">
        <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5 sm:h-20 sm:w-20 sm:rounded-3xl landscape:mb-4">
          <Wrench className="h-8 w-8 text-white/80 sm:h-10 sm:w-10" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white/90 sm:text-2xl">
          {t("Garage Portal", "Portal del Taller", "Garage Portaal")}
        </h1>
        <p className="text-sm text-white/40 mt-1.5 sm:text-base">
          {t("Enter PIN to continue", "Introduce el PIN", "Voer pincode in")}
        </p>

        <div
          className={`mt-8 flex gap-4 sm:gap-5 sm:mt-10 transition-transform ${
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
        {error && (
          <p className="mt-4 text-center text-sm text-red-400 font-medium animate-in fade-in-0 duration-200 sm:text-base max-w-xs">
            {error}
          </p>
        )}
      </div>

      {/* Numpad */}
      <div
        className="w-full shrink-0 flex justify-center px-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 landscape:flex landscape:items-center landscape:pb-[max(1.5rem,env(safe-area-inset-bottom))] landscape:pt-0 sm:pb-8"
      >
        <div className="w-full max-w-[320px] landscape:max-w-[min(100%,20rem)] sm:max-w-[400px] md:max-w-[440px] md:landscape:max-w-[440px]">
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
            <div className="min-h-[72px] sm:min-h-[84px] md:min-h-[92px]" aria-hidden />
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
              className={`${padBtn} flex items-center justify-center text-white/70 hover:bg-white/[0.06] disabled:opacity-20 disabled:hover:bg-white/[0.08]`}
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
