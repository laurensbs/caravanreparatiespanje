"use client";

import { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Account | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected) {
      passwordRef.current?.focus();
    }
  }, [selected]);

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
      return;
    }

    router.push("/");
    router.refresh();
  }

  function reset() {
    setSelected(null);
    setPassword("");
    setError("");
  }

  return (
    <div className="w-full max-w-md px-6">
      <div className="mb-10 flex flex-col items-center text-center">
        <Image
          src="/favicon.png"
          alt="Reparatie Panel"
          width={180}
          height={130}
          className="mb-4 object-contain dark:invert"
          priority
        />
        <h1 className="text-2xl font-semibold tracking-tight">Reparatie Panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {selected ? `Welkom terug, ${selected.name}` : "Kies je account om door te gaan"}
        </p>
      </div>

      {!selected ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => setSelected(acc)}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${acc.color} text-lg font-semibold text-white shadow-sm transition-transform group-hover:scale-105`}
              >
                {acc.name.charAt(0)}
              </div>
              <span className="text-sm font-medium">{acc.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${selected.color} text-base font-semibold text-white`}
            >
              {selected.name.charAt(0)}
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
              className="h-11 rounded-xl"
            />
            {error && (
              <p className="px-1 text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full rounded-xl text-sm font-medium"
            disabled={loading || !password}
          >
            {loading ? <Spinner className="mr-2" /> : null}
            Inloggen
          </Button>
        </form>
      )}
    </div>
  );
}
