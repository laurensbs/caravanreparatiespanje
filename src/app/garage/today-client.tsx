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
  parts: { total: number; received: number; pending: number };
  workers: string[];
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
    { key: "in_progress", label: t("In Progress", "En Progreso", "Bezig"), items: inProgress, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500", lightBg: "bg-blue-50 dark:bg-blue-950/30", emoji: "🔧" },
    { key: "todo", label: t("To Do", "Por Hacer", "Te Doen"), items: todo, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500", lightBg: "bg-purple-50 dark:bg-purple-950/30", emoji: "📋" },
    { key: "scheduled", label: t("Scheduled", "Programado", "Gepland"), items: scheduled, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500", lightBg: "bg-indigo-50 dark:bg-indigo-950/30", emoji: "📅" },
    { key: "final_check", label: t("Final Check", "Control Final", "Natest"), items: finalCheck, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", lightBg: "bg-amber-50 dark:bg-amber-950/30", emoji: "🔍" },
    { key: "waiting", label: t("Waiting / Blocked", "Esperando", "Wacht / Geblokkeerd"), items: waiting, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500", lightBg: "bg-orange-50 dark:bg-orange-950/30", emoji: "⏳" },
    { key: "done", label: t("Done", "Completado", "Klaar"), items: done, color: "text-green-600 dark:text-green-400", bg: "bg-green-500", lightBg: "bg-green-50 dark:bg-green-950/30", emoji: "✅" },
  ];

  // Overall stats
  const totalTasks = repairs.reduce((sum, r) => sum + r.tasks.total, 0);
  const doneTasks = repairs.reduce((sum, r) => sum + r.tasks.done, 0);
  const problemTasks = repairs.reduce((sum, r) => sum + r.tasks.problem, 0);
  const overallProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const activeRepairs = repairs.length - done.length;
  const urgentCount = repairs.filter((r) => r.priority === "urgent" || r.priority === "high").length;

  const firstName = userName.split(" ")[0];
  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return t("Good morning", "Buenos días", "Goedemorgen");
    if (h < 18) return t("Good afternoon", "Buenas tardes", "Goedemiddag");
    return t("Good evening", "Buenas noches", "Goedenavond");
  })();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-background to-blue-50/30 dark:from-slate-950 dark:via-background dark:to-blue-950/10">
      {/* Header — compact, modern */}
      <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-b border-border/50">
        <div className="flex items-center justify-between px-5 py-3.5">
          <div>
            <p className="text-sm text-muted-foreground">{greeting}, <span className="font-semibold text-foreground">{firstName}</span></p>
            <div className="flex items-baseline gap-2.5 mt-0.5">
              <h1 className="text-2xl font-extrabold tracking-tight">{today}</h1>
              <span className="text-lg tabular-nums text-muted-foreground/60 font-medium">{clock}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <button
              onClick={() => router.refresh()}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-lg active:bg-muted/80 transition-all hover:bg-muted/50"
              title={t("Refresh", "Actualizar", "Vernieuwen")}
            >
              ↻
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-sm font-bold bg-primary/10 text-primary active:bg-primary/20 transition-all"
              title={t("Sign out", "Cerrar sesión", "Uitloggen")}
            >
              {firstName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* Stats + Weather hero */}
      <div className="px-5 pt-5 pb-2 space-y-4">
        {/* Stats grid */}
        {repairs.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white dark:bg-card border border-border/50 p-4 shadow-sm">
              <p className="text-2xl font-extrabold tabular-nums">{activeRepairs}</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {t("Active", "Activas", "Actief")}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-card border border-border/50 p-4 shadow-sm">
              <p className="text-2xl font-extrabold tabular-nums text-green-600">{done.length}</p>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {t("Done", "Hechas", "Klaar")}
              </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-card border border-border/50 p-4 shadow-sm">
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-extrabold tabular-nums">{doneTasks}</p>
                <p className="text-sm text-muted-foreground">/{totalTasks}</p>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                {t("Tasks", "Tareas", "Taken")}
              </p>
            </div>
          </div>
        ) : null}

        {/* Progress bar (only when there's work) */}
        {totalTasks > 0 && (
          <div className="rounded-2xl bg-white dark:bg-card border border-border/50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("Day Progress", "Progreso del Día", "Dagvoortgang")}
              </span>
              <span className="text-sm font-bold tabular-nums">{overallProgress}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-green-500 transition-all duration-700 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            {(problemTasks > 0 || urgentCount > 0) && (
              <div className="flex gap-3 mt-2">
                {problemTasks > 0 && (
                  <span className="text-xs text-red-500 font-semibold">⚠ {problemTasks} {t("problems", "problemas", "problemen")}</span>
                )}
                {urgentCount > 0 && (
                  <span className="text-xs text-orange-500 font-semibold">🔴 {urgentCount} {t("urgent", "urgente", "spoed")}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Status pills — scrollable */}
        {repairs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-none">
            {groups.filter(g => g.items.length > 0).map((g) => (
              <div key={g.key} className={`flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${g.color} ${g.lightBg} border border-transparent`}>
                <span className="text-base">{g.emoji}</span>
                <span className="font-extrabold">{g.items.length}</span>
                <span className="font-medium opacity-70">{g.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Weather */}
        <WeatherWidget />
      </div>

      {/* Repair groups */}
      <div className="flex-1 px-5 pb-8 space-y-6 mt-2">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.key}>
              <div className="flex items-center gap-2.5 mb-3">
                <span className="text-xl">{g.emoji}</span>
                <h2 className={`text-xs font-extrabold uppercase tracking-widest ${g.color}`}>
                  {g.label}
                </h2>
                <div className="flex-1 h-px bg-border/50" />
                <span className={`flex items-center justify-center h-6 min-w-6 px-1 rounded-full text-xs font-bold text-white ${g.bg}`}>
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
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 flex items-center justify-center mb-5">
              <span className="text-4xl">🎉</span>
            </div>
            <p className="text-xl font-bold">{t("No repairs today!", "¡Sin reparaciones hoy!", "Geen reparaties vandaag!")}</p>
            <p className="text-sm text-muted-foreground mt-1.5">{t("Enjoy your day", "Disfruta el día", "Geniet van je dag")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
