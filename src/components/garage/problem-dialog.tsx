"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-w-md bg-gray-900 border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">
            {t("Report Problem", "Reportar Problema", "Probleem Melden")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <p className="text-sm text-white/40">
            {t("What's the problem?", "¿Cuál es el problema?", "Wat is het probleem?")}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                  category === cat
                    ? "border-red-400/40 bg-red-400/10 ring-1 ring-red-400/20"
                    : "border-white/[0.06] hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                <span className="font-medium text-sm text-white/80">
                  {t(PROBLEM_CATEGORY_LABELS[cat], CATEGORY_ES[cat], CATEGORY_NL[cat])}
                </span>
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Additional details...", "Detalles adicionales...", "Extra details...")}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-sm text-white placeholder:text-white/20 h-24 resize-none focus:outline-none focus:ring-2 focus:ring-white/10"
          />

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-12 rounded-xl border border-white/[0.08] text-white/60 font-medium text-sm transition-all hover:bg-white/[0.04] active:scale-[0.97] disabled:opacity-40"
            >
              {t("Cancel", "Cancelar", "Annuleren")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!category || isPending}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white font-semibold text-sm transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {isPending
                ? t("Sending...", "Enviando...", "Versturen...")
                : t("Report", "Reportar", "Melden")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
