"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/components/garage/language-toggle";
import { completeFinalCheck, failFinalCheck } from "@/actions/garage";
import { hapticSuccess, hapticTap } from "@/lib/haptic";

interface FinalCheckProps {
  repairJobId: string;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function FinalCheckDialog({ repairJobId, open, onClose, onComplete }: FinalCheckProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"choose" | "pass" | "fail">("choose");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function handlePass() {
    startTransition(async () => {
      await completeFinalCheck(repairJobId, notes || undefined);
      hapticSuccess();
      resetAndClose();
      onComplete();
    });
  }

  function handleFail() {
    if (!notes.trim()) return;
    startTransition(async () => {
      await failFinalCheck(repairJobId, notes);
      hapticTap();
      resetAndClose();
      onComplete();
    });
  }

  function resetAndClose() {
    setMode("choose");
    setNotes("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="max-w-md bg-foreground border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            {t("Final Check", "Control Final", "Natest")}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-white/40">
              {t(
                "All tasks are complete. Perform final check.",
                "Todas las tareas completadas. Realizar control final.",
                "Alle taken zijn klaar. Voer de natest uit."
              )}
            </p>
            <button
              onClick={() => setMode("pass")}
              className="w-full rounded-xl bg-emerald-500 p-4 text-white font-semibold text-base active:bg-emerald-600 transition-all active:scale-[0.98]"
            >
              ✓ {t("Passed — Ready for delivery", "Aprobado — Listo para entrega", "Goedgekeurd — Klaar voor uitlevering")}
            </button>
            <button
              onClick={() => setMode("fail")}
              className="w-full rounded-xl bg-red-400/10 border border-red-400/20 p-4 text-red-400 font-semibold text-base transition-all active:bg-red-400/20 active:scale-[0.98]"
            >
              ✗ {t("Failed — Send back", "Fallido — Devolver", "Afgekeurd — Terug naar garage")}
            </button>
          </div>
        )}

        {mode === "pass" && (
          <div className="space-y-3 mt-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("Notes (optional)...", "Notas (opcional)...", "Opmerkingen (optioneel)...")}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/20 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-white/10"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMode("choose")}
                disabled={isPending}
                className="flex-1 h-12 rounded-xl border border-white/[0.08] text-white/60 font-medium text-sm transition-all hover:bg-white/[0.04] active:scale-[0.97] disabled:opacity-40"
              >
                {t("Back", "Atrás", "Terug")}
              </button>
              <button
                onClick={handlePass}
                disabled={isPending}
                className="flex-1 h-12 rounded-xl bg-emerald-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {isPending ? "..." : t("Confirm Pass", "Confirmar", "Bevestig Goedkeuring")}
              </button>
            </div>
          </div>
        )}

        {mode === "fail" && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-white/40">
              {t(
                "Describe what needs to be fixed:",
                "Describe qué necesita ser corregido:",
                "Beschrijf wat er gerepareerd moet worden:"
              )}
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("What's wrong?", "¿Qué está mal?", "Wat is er mis?")}
              className="w-full rounded-xl border border-red-400/20 bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/20 h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-400/20"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMode("choose")}
                disabled={isPending}
                className="flex-1 h-12 rounded-xl border border-white/[0.08] text-white/60 font-medium text-sm transition-all hover:bg-white/[0.04] active:scale-[0.97] disabled:opacity-40"
              >
                {t("Back", "Atrás", "Terug")}
              </button>
              <button
                onClick={handleFail}
                disabled={!notes.trim() || isPending}
                className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
              >
                {isPending ? "..." : t("Send Back", "Devolver", "Terugsturen")}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
