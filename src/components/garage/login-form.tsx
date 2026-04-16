"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { garageLogin } from "@/actions/garage-auth";
import { useLanguage } from "@/components/garage/language-toggle";
import { Delete, Wrench } from "lucide-react";

const PIN_LENGTH = 4;

export function GarageLoginForm() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
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

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-between bg-gray-950 text-white select-none">
      {/* Language toggle */}
      <div className="absolute top-6 right-6 flex gap-1.5 z-10">
        {langs.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code as any)}
            className={`h-8 w-8 rounded-full text-base flex items-center justify-center transition-all ${
              lang === l.code
                ? "bg-white/20 ring-1 ring-white/40"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {l.flag}
          </button>
        ))}
      </div>

      {/* Branding */}
      <div className="flex-1 flex flex-col items-center justify-end pb-8 pt-16">
        <div className="h-16 w-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-5">
          <Wrench className="h-8 w-8 text-white/80" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-white/90">
          {t("Garage Portal", "Portal del Taller", "Garage Portaal")}
        </h1>
        <p className="text-sm text-white/40 mt-1.5">
          {t("Enter PIN to continue", "Introduce el PIN", "Voer pincode in")}
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex flex-col items-center gap-6 py-6">
        <div
          className={`flex gap-4 transition-transform ${
            shake ? "animate-[shake_0.4s_ease-in-out]" : ""
          }`}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              className={`h-4 w-4 rounded-full transition-all duration-200 ${
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
          <p className="text-sm text-red-400 font-medium animate-in fade-in-0 duration-200">
            {error}
          </p>
        )}
      </div>

      {/* Numpad */}
      <div className="w-full max-w-[320px] px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleDigit(String(n))}
              disabled={isPending}
              className="h-[72px] rounded-2xl bg-white/[0.08] text-2xl font-medium text-white transition-all active:scale-95 active:bg-white/[0.15] hover:bg-white/[0.12] disabled:opacity-40"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit("0")}
            disabled={isPending}
            className="h-[72px] rounded-2xl bg-white/[0.08] text-2xl font-medium text-white transition-all active:scale-95 active:bg-white/[0.15] hover:bg-white/[0.12] disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending || digits.length === 0}
            className="h-[72px] rounded-2xl flex items-center justify-center text-white/60 transition-all active:scale-95 hover:bg-white/[0.06] disabled:opacity-20"
          >
            <Delete className="h-6 w-6" />
          </button>
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
