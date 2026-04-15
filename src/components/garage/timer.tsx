"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { toast } from "sonner";

interface GarageTimerProps {
  repairJobId: string;
  currentUserId: string;
  currentUserName: string;
  activeTimers: {
    id: string;
    userId: string;
    userName: string | null;
    startedAt: Date | string;
  }[];
  t: (en: string, es: string, nl: string) => string;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function GarageTimer({ repairJobId, currentUserId, currentUserName, activeTimers, t }: GarageTimerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const myTimer = activeTimers.find((t) => t.userId === currentUserId);
  const otherTimers = activeTimers.filter((t) => t.userId !== currentUserId);
  const isRunning = !!myTimer;

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!myTimer) {
      setElapsed(0);
      return;
    }
    const start = new Date(myTimer.startedAt).getTime();

    function tick() {
      setElapsed(Date.now() - start);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [myTimer]);

  function handleStart() {
    startTransition(async () => {
      await startTimer(repairJobId);
      toast.success(t("Timer started", "Temporizador iniciado", "Timer gestart"));
      router.refresh();
    });
  }

  function handleStop() {
    startTransition(async () => {
      await stopTimer(repairJobId);
      toast.success(t("Timer stopped", "Temporizador detenido", "Timer gestopt"));
      router.refresh();
    });
  }

  return (
    <div className={`rounded-2xl px-4 py-4 ${
      isRunning
        ? "bg-emerald-50 border border-emerald-100"
        : "bg-sky-50 border border-sky-100"
    }`}>
      <p className={`text-xs uppercase tracking-wide font-semibold mb-3 ${
        isRunning ? "text-emerald-700" : "text-sky-700"
      }`}>
        {isRunning
          ? t("Working now", "Trabajando ahora", "Nu bezig")
          : t("Work timer", "Temporizador", "Werktimer")}
      </p>

      {/* Timer display when running */}
      {isRunning && (
        <div className="mb-3">
          <div className="text-lg font-semibold tabular-nums text-gray-900">
            {formatElapsed(elapsed)}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentUserName}
          </p>
        </div>
      )}

      {/* Start / Stop */}
      {isRunning ? (
        <button
          onClick={handleStop}
          disabled={isPending}
          className="w-full rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
        >
          {t("Stop Timer", "Detener", "Stop Timer")}
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={isPending}
          className="w-full rounded-xl bg-[#0CC0DF] text-white px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {t("Start working", "Empezar a trabajar", "Start werken")}
        </button>
      )}

      {/* Other technicians */}
      {otherTimers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("Also working", "También trabajando", "Ook bezig")}
          </p>
          {otherTimers.map((timer) => (
            <div key={timer.id} className="flex items-center gap-2 text-sm">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-sky-500 text-[10px] font-bold text-white">
                {(timer.userName ?? "?").charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-gray-700">{timer.userName}</span>
              <span className="text-xs text-gray-400">
                <LiveElapsed startedAt={timer.startedAt} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveElapsed({ startedAt }: { startedAt: Date | string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    function tick() {
      const ms = Date.now() - start;
      const mins = Math.floor(ms / 60000);
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(hrs > 0 ? `${hrs}h ${m}m` : `${m}m`);
    }
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <>{elapsed}</>;
}
