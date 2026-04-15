"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startTimer, stopTimer } from "@/actions/time-entries";
import { toast } from "sonner";
import { Play, Square } from "lucide-react";

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
    <div className="flex items-center gap-2 flex-wrap">
      {/* Start / Stop button */}
      {isRunning ? (
        <button
          onClick={handleStop}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 pl-3 pr-3.5 py-1.5 text-sm font-medium text-emerald-700 transition-all active:scale-[0.97] disabled:opacity-50"
        >
          <Square className="h-3 w-3 fill-current" />
          <span className="tabular-nums font-semibold">{formatElapsed(elapsed)}</span>
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#0CC0DF]/10 border border-[#0CC0DF]/20 pl-3 pr-3.5 py-1.5 text-sm font-medium text-[#0AA8C4] transition-all active:scale-[0.97] disabled:opacity-50"
        >
          <Play className="h-3 w-3 fill-current" />
          {t("Start", "Iniciar", "Start")}
        </button>
      )}

      {/* Other technicians working */}
      {otherTimers.map((timer) => (
        <span
          key={timer.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs text-gray-500"
        >
          <span className="flex items-center justify-center h-4 w-4 rounded-full bg-sky-500 text-[9px] font-bold text-white">
            {(timer.userName ?? "?").charAt(0).toUpperCase()}
          </span>
          {timer.userName}
          <LiveElapsed startedAt={timer.startedAt} />
        </span>
      ))}
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

  return <span className="tabular-nums text-gray-400">{elapsed}</span>;
}
