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
import { updateTaskStatus } from "@/actions/garage";
import type { ProblemCategory } from "@/types";
import { PROBLEM_CATEGORY_LABELS } from "@/types";

const CATEGORIES: ProblemCategory[] = [
  "missing_part",
  "extra_damage",
  "unclear_instructions",
  "time_shortage",
  "other",
];

const CATEGORY_ICONS: Record<ProblemCategory, string> = {
  missing_part: "📦",
  extra_damage: "🔨",
  unclear_instructions: "❓",
  time_shortage: "⏰",
  other: "💬",
};

const CATEGORY_ES: Record<ProblemCategory, string> = {
  missing_part: "Falta pieza",
  extra_damage: "Daño extra",
  unclear_instructions: "Instrucciones poco claras",
  time_shortage: "Falta de tiempo",
  other: "Otro",
};

const CATEGORY_NL: Record<ProblemCategory, string> = {
  missing_part: "Onderdeel ontbreekt",
  extra_damage: "Extra schade",
  unclear_instructions: "Onduidelijke instructies",
  time_shortage: "Tijdgebrek",
  other: "Anders",
};

interface ProblemDialogProps {
  open: boolean;
  onClose: () => void;
  taskId: string | null;
  onComplete: () => void;
}

export function ProblemDialog({ open, onClose, taskId, onComplete }: ProblemDialogProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<ProblemCategory | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!taskId || !category) return;
    startTransition(async () => {
      await updateTaskStatus(taskId, "problem", category, note || undefined);
      setCategory(null);
      setNote("");
      onComplete();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {t("Report Problem", "Reportar Problema", "Probleem Melden")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <p className="text-sm text-gray-500">
            {t("What's the problem?", "¿Cuál es el problema?", "Wat is het probleem?")}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.98] ${
                  category === cat
                    ? "border-red-400 bg-red-50 ring-2 ring-red-200"
                    : "hover:bg-gray-50"
                }`}
              >
                <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                <span className="font-medium text-sm">
                  {t(PROBLEM_CATEGORY_LABELS[cat], CATEGORY_ES[cat], CATEGORY_NL[cat])}
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Additional details...", "Detalles adicionales...", "Extra details...")}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl"
              disabled={isPending}
            >
              {t("Cancel", "Cancelar", "Annuleren")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!category || isPending}
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending
                ? t("Sending...", "Enviando...", "Versturen...")
                : t("Report", "Reportar", "Melden")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
