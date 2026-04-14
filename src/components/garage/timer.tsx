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
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
        ⏱ {t("Time", "Tiempo", "Tijd")}
      </h3>

      {/* Timer display when running */}
      {isRunning && (
        <div className="text-center mb-4">
          <div className="text-4xl font-bold tabular-nums text-gray-900 tracking-tight">
            {formatElapsed(elapsed)}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {currentUserName}
          </p>
        </div>
      )}

      {/* Start / Stop — large touch target */}
      <button
        onClick={isRunning ? handleStop : handleStart}
        disabled={isPending}
        className={`w-full rounded-2xl p-4 text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
          isRunning
            ? "bg-red-500 text-white shadow-sm"
            : "border-2 border-dashed border-[#0CC0DF]/30 text-[#0CC0DF] active:bg-sky-50"
        }`}
      >
        {isRunning
          ? `■ ${t("Stop Timer", "Detener", "Stop Timer")}`
          : `▶ ${t("Start Timer", "Iniciar", "Start Timer")}`}
      </button>

      {/* Other technicians */}
      {otherTimers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
            {t("Also working", "También trabajando", "Ook bezig")}
          </p>
          {otherTimers.map((timer) => (
            <div key={timer.id} className="flex items-center gap-2 text-sm">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-sky-500 text-[11px] font-bold text-white">
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
