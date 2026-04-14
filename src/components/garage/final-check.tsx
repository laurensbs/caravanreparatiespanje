"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/garage/language-toggle";
import { completeFinalCheck, failFinalCheck } from "@/actions/garage";

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
      resetAndClose();
      onComplete();
    });
  }

  function handleFail() {
    if (!notes.trim()) return;
    startTransition(async () => {
      await failFinalCheck(repairJobId, notes);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {t("Final Check", "Control Final", "Natest")}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-500">
              {t(
                "All tasks are complete. Perform final check.",
                "Todas las tareas completadas. Realizar control final.",
                "Alle taken zijn klaar. Voer de natest uit."
              )}
            </p>
            <button
              onClick={() => setMode("pass")}
              className="w-full rounded-xl bg-green-500 p-4 text-white font-semibold text-base active:bg-green-600 transition-colors"
            >
              ✓ {t("Passed — Ready for delivery", "Aprobado — Listo para entrega", "Goedgekeurd — Klaar voor uitlevering")}
            </button>
            <button
              onClick={() => setMode("fail")}
              className="w-full rounded-xl bg-red-100 border border-red-300 p-4 text-red-700 font-semibold text-base active:bg-red-200 transition-colors"
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
              className="w-full rounded-xl border border-gray-200 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("choose")} className="flex-1 h-12 rounded-xl" disabled={isPending}>
                {t("Back", "Atrás", "Terug")}
              </Button>
              <Button onClick={handlePass} disabled={isPending} className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white">
                {isPending ? "..." : t("Confirm Pass", "Confirmar", "Bevestig Goedkeuring")}
              </Button>
            </div>
          </div>
        )}

        {mode === "fail" && (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-500">
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
              className="w-full rounded-xl border border-red-300 p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("choose")} className="flex-1 h-12 rounded-xl" disabled={isPending}>
                {t("Back", "Atrás", "Terug")}
              </Button>
              <Button
                onClick={handleFail}
                disabled={!notes.trim() || isPending}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? "..." : t("Send Back", "Devolver", "Terugsturen")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
