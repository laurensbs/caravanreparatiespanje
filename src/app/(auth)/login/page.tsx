"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Account = {
  name: string;
  email: string;
  color: string;
};

const ACCOUNTS: Account[] = [
  { name: "Jake", email: "jake", color: "from-sky-500 to-cyan-500" },
  { name: "Johan", email: "johan", color: "from-violet-500 to-fuchsia-500" },
  { name: "Laurens", email: "laurensbos@hotmail.com", color: "from-emerald-500 to-teal-500" },
  { name: "Noah", email: "noah@caravanrepairspain.com", color: "from-amber-500 to-orange-500" },
];

type Stage = "pick" | "password" | "success";

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Account | null>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [password, setPassword] = useState("");
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
    }, 650);
  }

  function reset() {
    setStage("pick");
    setPassword("");
    setError("");
    setTimeout(() => setSelected(null), 250);
  }

  return (
    <div className="relative w-full max-w-md px-6">
      {/* Ambient gradient blobs voor diepte */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="mb-10 flex flex-col items-center text-center">
        <Image
          src="/favicon.png"
          alt="Reparatie Panel"
          width={180}
          height={130}
          className="mb-4 object-contain dark:invert animate-[logoFloat_4s_ease-in-out_infinite]"
          priority
        />
        <h1 className="text-2xl font-semibold tracking-tight">Reparatie Panel</h1>
        <p
          key={`subtitle-${stage}-${selected?.email ?? "none"}`}
          className="mt-1 text-sm text-muted-foreground animate-[fadeIn_300ms_ease-out]"
        >
          {stage === "success"
            ? `Welkom, ${selected?.name}`
            : stage === "password"
            ? `Welkom terug, ${selected?.name}`
            : "Kies je account om door te gaan"}
        </p>
      </div>

      {/* Stage container met cross-fade */}
      <div className="relative min-h-[180px]">
        {/* Stage: pick */}
        <div
          className={`transition-all duration-300 ease-out ${
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
                style={{ animationDelay: `${i * 60}ms` }}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 opacity-0 animate-[fadeUp_400ms_ease-out_forwards] transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${acc.color} text-lg font-semibold text-white shadow-sm transition-transform duration-300 group-hover:scale-110 group-active:scale-95`}
                >
                  {acc.name.charAt(0)}
                </div>
                <span className="text-sm font-medium">{acc.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stage: password */}
        <div
          className={`transition-all duration-300 ease-out ${
            stage === "password"
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-2 pointer-events-none absolute inset-0"
          }`}
        >
          {selected && (
            <form onSubmit={handleSubmit} className={`space-y-4 ${shake ? "animate-[shake_0.45s_ease-in-out]" : ""}`}>
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                <div className="relative">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${selected.color} text-base font-semibold text-white shadow-sm`}
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
                  <div className="text-sm font-medium leading-tight">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">Ingelogd als admin</div>
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
                <Input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  placeholder="Wachtwoord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="h-11 rounded-xl text-base tracking-wide"
                />
                <p
                  className={`px-1 text-xs text-destructive transition-opacity duration-200 ${
                    error ? "opacity-100" : "opacity-0"
                  }`}
                  aria-live="polite"
                >
                  {error || "\u00A0"}
                </p>
              </div>

              <Button
                type="submit"
                className="h-11 w-full rounded-xl text-sm font-medium transition-transform active:scale-[0.98]"
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
                className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${selected.color} text-white shadow-lg`}
              >
                <Check
                  className="h-8 w-8 animate-[checkPop_500ms_cubic-bezier(0.34,1.56,0.64,1)]"
                  strokeWidth={3}
                />
                <span
                  aria-hidden
                  className={`absolute inset-0 rounded-full bg-gradient-to-br ${selected.color} animate-[successRing_700ms_ease-out]`}
                />
              </div>
              <p className="text-sm text-muted-foreground">Dashboard wordt geladen…</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
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
      `}</style>
    </div>
  );
}
