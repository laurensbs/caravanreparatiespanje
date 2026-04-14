"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { garageLogin } from "@/actions/garage-auth";
import Image from "next/image";

export function GarageLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await garageLogin(password);
      if (result.success) {
        router.refresh();
      } else {
        setError("Wrong password");
        setPassword("");
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9FAFB] px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/favicon.png"
            alt="Logo"
            width={64}
            height={64}
            className="rounded-2xl"
          />
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Garage Portal
          </h1>
          <p className="text-sm text-gray-500">
            Enter the garage password to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0CC0DF] focus:border-transparent transition-all"
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-500 text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={!password || isPending}
            className="w-full rounded-2xl bg-[#0CC0DF] px-4 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#0BB0CC] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isPending ? "Checking..." : "Enter Garage"}
          </button>
        </form>
      </div>
    </div>
  );
}
