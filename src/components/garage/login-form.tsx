"use client";

import { useState, useRef, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { garageLogin } from "@/actions/garage-auth";
import { useLanguage } from "@/components/garage/language-toggle";
import { LanguageToggle } from "@/components/garage/language-toggle";
import Image from "next/image";

const PIN_LENGTH = 4;

export function GarageLoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pin = digits.join("");
  const isComplete = pin.length === PIN_LENGTH && digits.every((d) => d !== "");

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const submitPin = useCallback((pinValue: string) => {
    setError("");
    startTransition(async () => {
      const result = await garageLogin(pinValue);
      if (result.success) {
        router.refresh();
      } else {
        setError(t(
          "Incorrect PIN. Try again.",
          "PIN incorrecto. Inténtalo de nuevo.",
          "Onjuiste pincode. Probeer opnieuw."
        ));
        setDigits(Array(PIN_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
      }
    });
  }, [router, t, startTransition]);

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");

    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === PIN_LENGTH - 1) {
      const fullPin = next.join("");
      if (fullPin.length === PIN_LENGTH) {
        submitPin(fullPin);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      } else {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      }
      e.preventDefault();
    }
    if (e.key === "Enter" && isComplete) {
      submitPin(pin);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length === PIN_LENGTH) {
      submitPin(pasted);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isComplete) submitPin(pin);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-6">
      {/* Language toggle */}
      <div className="fixed top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-10 space-y-8">
          {/* Logo + title */}
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Image src="/favicon.png" alt="Logo" width={40} height={40} className="rounded-lg" />
            </div>
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                {t("Garage Access", "Acceso al garaje", "Garage toegang")}
              </h1>
              <p className="text-sm text-gray-500">
                {t(
                  "Enter the PIN to open the garage workspace",
                  "Introduce el PIN para abrir el espacio de trabajo del garaje",
                  "Voer de pincode in om de garagewerkplek te openen"
                )}
              </p>
            </div>
          </div>

          {/* PIN input */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={isPending}
                  autoComplete="one-time-code"
                  className="h-16 w-16 rounded-xl border border-gray-200 bg-white text-center text-2xl font-semibold text-gray-900 outline-none transition-all focus:ring-2 focus:ring-[#0CC0DF]/20 focus:border-[#0CC0DF]/50 disabled:opacity-50 placeholder:text-gray-200"
                  placeholder="·"
                />
              ))}
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={!isComplete || isPending}
              className="w-full h-12 rounded-xl bg-[#0CC0DF] text-white text-sm font-semibold shadow-sm hover:bg-[#0BB0CC] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {isPending
                ? t("Checking...", "Verificando...", "Controleren...")
                : t("Enter Garage", "Entrar al garaje", "Garage openen")}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          {t(
            "Enter the 4-digit PIN to unlock the garage workspace",
            "Introduce el PIN de 4 dígitos para desbloquear el garaje",
            "Voer de 4-cijferige pincode in om de garage te ontgrendelen"
          )}
        </p>
      </div>
    </div>
  );
}
