"use client";

import { useRouter } from "next/navigation";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { RepairCard } from "@/components/garage/repair-card";
import { signOut } from "next-auth/react";

type RepairItem = {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: Date | string | null;
  customerName: string | null;
  unitRegistration: string | null;
  unitBrand: string | null;
  unitModel: string | null;
  assignedUserName: string | null;
  finalCheckStatus: string | null;
  tasks: { total: number; done: number; problem: number };
};

interface Props {
  repairs: RepairItem[];
  userName: string;
}

export function GarageTodayClient({ repairs, userName }: Props) {
  const { t } = useLanguage();
  const router = useRouter();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Group repairs by status
  const todo = repairs.filter((r) => ["new", "todo", "in_inspection", "quote_needed", "waiting_approval"].includes(r.status));
  const scheduled = repairs.filter((r) => r.status === "scheduled");
  const inProgress = repairs.filter((r) => r.status === "in_progress");
  const waiting = repairs.filter((r) => ["waiting_customer", "waiting_parts", "blocked"].includes(r.status));
  const finalCheck = repairs.filter(
    (r) => r.status === "completed" && r.finalCheckStatus === "pending"
  );
  const done = repairs.filter(
    (r) => (r.status === "completed" && r.finalCheckStatus !== "pending") || r.status === "invoiced"
  );

  const groups = [
    { key: "in_progress", label: t("In Progress", "En Progreso", "Bezig"), items: inProgress, color: "text-blue-600" },
    { key: "todo", label: t("To Do", "Por Hacer", "Te Doen"), items: todo, color: "text-purple-600" },
    { key: "scheduled", label: t("Scheduled", "Programado", "Gepland"), items: scheduled, color: "text-indigo-600" },
    { key: "final_check", label: t("Final Check", "Control Final", "Natest"), items: finalCheck, color: "text-amber-600" },
    { key: "waiting", label: t("Waiting / Blocked", "Esperando", "Wacht / Geblokkeerd"), items: waiting, color: "text-orange-600" },
    { key: "done", label: t("Done", "Completado", "Klaar"), items: done, color: "text-green-600" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card/80 backdrop-blur-xl px-4 py-3">
        <div>
          <h1 className="text-lg font-bold">{t("Today", "Hoy", "Vandaag")}</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            onClick={() => router.refresh()}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-lg active:bg-muted"
            title={t("Refresh", "Actualizar", "Vernieuwen")}
          >
            ↻
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="h-10 px-3 flex items-center justify-center rounded-lg text-sm text-muted-foreground active:bg-muted"
          >
            {userName.split(" ")[0]} ↗
          </button>
        </div>
      </header>

      {/* Count summary */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {groups.filter(g => g.items.length > 0).map((g) => (
          <div key={g.key} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${g.color}`}>
            <span className="font-bold">{g.items.length}</span>
            <span>{g.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium whitespace-nowrap">
          <span className="font-bold">{repairs.length}</span>
          <span>{t("total", "total", "totaal")}</span>
        </div>
      </div>

      {/* Repair groups */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key}>
              <h2 className={`text-sm font-bold uppercase tracking-wide mb-2 ${g.color}`}>
                {g.label} ({g.items.length})
              </h2>
              <div className="space-y-3">
                {g.items.map((repair) => (
                  <RepairCard key={repair.id} repair={repair} />
                ))}
              </div>
            </section>
          ))}

        {repairs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <span className="text-4xl mb-3">🎉</span>
            <p className="text-lg font-medium">{t("No repairs today", "Sin reparaciones", "Geen reparaties vandaag")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
