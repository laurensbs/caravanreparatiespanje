"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ThemeToggle } from "@/components/theme-toggle";

type Account = {
  name: string;
  email: string;
  /** Tailwind gradient classes for the avatar disc. Deliberately no
   *  cyan/sky tints — the new identity is warm + neutral with a few
   *  saturated personality picks. */
  color: string;
  role: string;
};

const ACCOUNTS: Account[] = [
  { name: "Jake", email: "jake", color: "from-indigo-500 to-blue-600", role: "Admin" },
  { name: "Johan", email: "johan", color: "from-violet-500 to-fuchsia-500", role: "Admin" },
  { name: "Laurens", email: "laurensbos@hotmail.com", color: "from-emerald-500 to-teal-600", role: "Owner" },
  { name: "Noah", email: "noah@caravanrepairspain.com", color: "from-amber-500 to-orange-500", role: "Admin" },
];

type Stage = "pick" | "password" | "success";

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Account | null>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (stage === "password") {
      const t = setTimeout(() => passwordRef.current?.focus(), 220);
      return () => clearTimeout(t);
    }
  }, [stage]);

  function pickAccount(acc: Account) {
    setSelected(acc);
    setStage("password");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email: selected.email.trim(),
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Onjuist wachtwoord");
      setLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      passwordRef.current?.select();
      return;
    }

    setStage("success");
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 700);
  }

  function reset() {
    setStage("pick");
    setPassword("");
    setError("");
    setShowPassword(false);
    setCapsLock(false);
    setTimeout(() => setSelected(null), 250);
  }

  return (
    <div className="relative w-full max-w-md px-6">
      {/* Theme toggle pinned to the top-right of the viewport, not the
          card, so it never overlaps the form on small screens. */}
      <div className="fixed right-4 top-4 z-30">
        <div className="rounded-full border border-border/60 bg-card/70 p-0.5 shadow-sm backdrop-blur-md">
          <ThemeToggle />
        </div>
      </div>

      {/* Ambient gradient blobs voor diepte. Two of them, drifting
          gently in opposite directions, give the canvas a sense of
          depth without being noisy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-foreground/[0.05] blur-3xl animate-[drift_18s_ease-in-out_infinite]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 -z-10 h-[20rem] w-[20rem] rounded-full bg-amber-500/10 blur-3xl animate-[drift2_22s_ease-in-out_infinite] dark:bg-amber-500/[0.06]"
      />

      <div className="mb-10 flex flex-col items-center text-center">
        <Image
          src="/favicon.png"
          alt="Reparatie Panel"
          width={200}
          height={140}
          className="mb-4 object-contain dark:invert animate-[logoFloat_4s_ease-in-out_infinite]"
          priority
        />
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Reparatie Panel</h1>
        <p
          key={`subtitle-${stage}-${selected?.email ?? "none"}`}
          className="mt-1.5 text-sm text-muted-foreground animate-[fadeIn_300ms_ease-out]"
        >
          {stage === "success"
            ? `Welkom, ${selected?.name}`
            : stage === "password"
            ? `Welkom terug, ${selected?.name}`
            : "Kies je account om door te gaan"}
        </p>
      </div>

      {/* Stage container met cross-fade */}
      <div className="relative min-h-[200px]">
        {/* Stage: pick */}
        <div
          className={`transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            stage === "pick"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-2 pointer-events-none absolute inset-0"
          }`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ACCOUNTS.map((acc, i) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => pickAccount(acc)}
                style={{ animationDelay: `${i * 70}ms` }}
                className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 opacity-0 shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_1px_0_0_rgba(255,255,255,0.6)_inset] animate-[fadeUp_450ms_ease-[cubic-bezier(0.16,1,0.3,1)]_forwards] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
              >
                {/* Top accent line in account colour, fades in on hover. */}
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${acc.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${acc.color} text-lg font-semibold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.18),inset_0_1px_0_0_rgba(255,255,255,0.18)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110 group-hover:rotate-[-2deg] group-active:scale-95`}
                >
                  {acc.name.charAt(0)}
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-medium tracking-[-0.005em]">{acc.name}</span>
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                    {acc.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Stage: password */}
        <div
          className={`transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            stage === "password"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-0"
          }`}
        >
          {selected && (
            <form
              onSubmit={handleSubmit}
              className={`space-y-4 ${shake ? "animate-[shake_0.45s_ease-in-out]" : ""}`}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
                <div className="relative">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${selected.color} text-base font-semibold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.18),inset_0_1px_0_0_rgba(255,255,255,0.18)]`}
                  >
                    {selected.name.charAt(0)}
                  </div>
                  {loading && (
                    <span
                      aria-hidden
                      className={`absolute inset-0 rounded-full ring-2 ring-offset-2 ring-offset-background bg-gradient-to-br ${selected.color} opacity-0 animate-[pulseRing_1.4s_ease-out_infinite]`}
                    />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium leading-tight tracking-[-0.005em]">
                    {selected.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected.role} · {selected.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  aria-label="Andere gebruiker"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Wachtwoord"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={(e) => {
                      if ("getModifierState" in e) {
                        setCapsLock(e.getModifierState("CapsLock"));
                      }
                    }}
                    onKeyDown={(e) => {
                      if ("getModifierState" in e) {
                        setCapsLock(e.getModifierState("CapsLock"));
                      }
                    }}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="h-11 rounded-xl pr-10 text-base tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Two stacked status lines — caps lock + error. Each stays
                    at the same height so the layout never shifts. */}
                <div className="grid h-4 grid-cols-2 gap-2 px-1 text-[11px]">
                  <p
                    className={`text-amber-600 transition-opacity duration-200 dark:text-amber-400 ${
                      capsLock && !error ? "opacity-100" : "opacity-0"
                    }`}
                    aria-live="polite"
                  >
                    {capsLock ? "Caps Lock staat aan" : "\u00A0"}
                  </p>
                  <p
                    className={`text-right text-destructive transition-opacity duration-200 ${
                      error ? "opacity-100" : "opacity-0"
                    }`}
                    aria-live="polite"
                  >
                    {error || "\u00A0"}
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-medium tracking-[-0.005em] transition-all active:scale-[0.98]"
                disabled={loading || !password}
              >
                {loading ? (
                  <>
                    <Spinner className="mr-2" />
                    Bezig met inloggen…
                  </>
                ) : (
                  "Inloggen"
                )}
              </Button>
            </form>
          )}
        </div>

        {/* Stage: success */}
        <div
          className={`transition-all duration-500 ease-out ${
            stage === "success"
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none absolute inset-0"
          }`}
        >
          {selected && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div
                className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${selected.color} text-white shadow-[0_8px_20px_-6px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)]`}
              >
                <Check
                  className="h-8 w-8 animate-[checkPop_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
                  strokeWidth={3}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${selected.color} animate-[successRing_700ms_ease-out]`}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${selected.color} animate-[successRing_900ms_ease-out_150ms]`}
                />
              </div>
              <p className="text-sm text-muted-foreground tracking-[-0.005em]">
                Dashboard wordt geladen…
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes pulseRing {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.7); }
        }
        @keyframes checkPop {
          0% { opacity: 0; transform: scale(0.3); }
          60% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes successRing {
          0% { opacity: 0.5; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.8); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes drift {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50% { transform: translate(calc(-50% + 24px), 18px) scale(1.05); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-22px, -16px) scale(1.07); }
        }
      `}</style>
    </div>
  );
}
