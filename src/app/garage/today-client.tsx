"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LanguageToggle, useLanguage } from "@/components/garage/language-toggle";
import { RepairCard } from "@/components/garage/repair-card";
import { WeatherWidget } from "@/components/garage/weather-widget";
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
  const [time, setTime] = useState(() => new Date());

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const clock = time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
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
    { key: "in_progress", label: t("In Progress", "En Progreso", "Bezig"), items: inProgress, color: "text-blue-600", bg: "bg-blue-500", emoji: "🔧" },
    { key: "todo", label: t("To Do", "Por Hacer", "Te Doen"), items: todo, color: "text-purple-600", bg: "bg-purple-500", emoji: "📋" },
    { key: "scheduled", label: t("Scheduled", "Programado", "Gepland"), items: scheduled, color: "text-indigo-600", bg: "bg-indigo-500", emoji: "📅" },
    { key: "final_check", label: t("Final Check", "Control Final", "Natest"), items: finalCheck, color: "text-amber-600", bg: "bg-amber-500", emoji: "🔍" },
    { key: "waiting", label: t("Waiting / Blocked", "Esperando", "Wacht / Geblokkeerd"), items: waiting, color: "text-orange-600", bg: "bg-orange-500", emoji: "⏳" },
    { key: "done", label: t("Done", "Completado", "Klaar"), items: done, color: "text-green-600", bg: "bg-green-500", emoji: "✅" },
  ];

  // Overall stats
  const totalTasks = repairs.reduce((sum, r) => sum + r.tasks.total, 0);
  const doneTasks = repairs.reduce((sum, r) => sum + r.tasks.done, 0);
  const problemTasks = repairs.reduce((sum, r) => sum + r.tasks.problem, 0);
  const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const activeRepairs = repairs.length - done.length;
  const urgentCount = repairs.filter((r) => r.priority === "urgent" || r.priority === "high").length;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-slate-50 to-background dark:from-slate-950 dark:to-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{t("Today", "Hoy", "Vandaag")}</h1>
              <span className="text-lg tabular-nums text-muted-foreground font-medium">{clock}</span>
            </div>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageToggle />
            <button
              onClick={() => router.refresh()}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-lg active:bg-muted transition-colors"
              title={t("Refresh", "Actualizar", "Vernieuwen")}
            >
              ↻
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="h-10 px-3 flex items-center justify-center rounded-lg text-sm text-muted-foreground active:bg-muted transition-colors"
            >
              {userName.split(" ")[0]} ↗
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard area */}
      <div className="px-4 py-4 space-y-4">
        {/* Progress + Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Overall progress */}
          <div className="rounded-2xl border bg-card p-4 col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t("Day Progress", "Progreso del Día", "Dagvoortgang")}
              </span>
              <span className="text-sm font-bold tabular-nums">{doneTasks}/{totalTasks} {t("tasks", "tareas", "taken")}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{activeRepairs} {t("active", "activas", "actief")}</span>
              <span>{done.length} {t("done", "hechas", "klaar")}</span>
              {problemTasks > 0 && (
                <span className="text-red-500 font-medium">⚠ {problemTasks} {t("problems", "problemas", "problemen")}</span>
              )}
              {urgentCount > 0 && (
                <span className="text-orange-500 font-medium">🔴 {urgentCount} {t("urgent", "urgente", "spoed")}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {groups.filter(g => g.items.length > 0).map((g) => (
            <div key={g.key} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap ${g.color} bg-card`}>
              <span>{g.emoji}</span>
              <span className="font-bold">{g.items.length}</span>
              <span className="hidden sm:inline">{g.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium whitespace-nowrap">
            <span className="font-bold">{repairs.length}</span>
            <span>{t("total", "total", "totaal")}</span>
          </div>
        </div>

        {/* Weather Widget */}
        <WeatherWidget />
      </div>

      {/* Repair groups */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{g.emoji}</span>
                <h2 className={`text-sm font-bold uppercase tracking-wide ${g.color}`}>
                  {g.label}
                </h2>
                <span className={`ml-auto flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white ${g.bg}`}>
                  {g.items.length}
                </span>
              </div>
              <div className="space-y-3">
                {g.items.map((repair) => (
                  <RepairCard key={repair.id} repair={repair} />
                ))}
              </div>
            </section>
          ))}

        {repairs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <span className="text-5xl mb-4">🎉</span>
            <p className="text-xl font-semibold">{t("No repairs today!", "¡Sin reparaciones hoy!", "Geen reparaties vandaag!")}</p>
            <p className="text-sm mt-1">{t("Enjoy your day", "Disfruta el día", "Geniet van je dag")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
